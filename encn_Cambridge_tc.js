/* global api */
class encn_Cambridge_tc_new {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
    }

    async displayName() {
        return '劍橋英漢雙解 (繁體中文)';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample !== undefined ? options.maxexample : 2;
    }

    async findTerm(word) {
        return await this.findCambridge(word);
    }

    static T(node) {
        return node ? node.innerText.trim() : '';
    }

    async findCambridge(word) {
        if (!word) return [];

        const base = 'https://dictionary.cambridge.org/zht/%E8%A9%9E%E5%85%B8/%E8%8B%B1%E8%AA%9E-%E6%BC%A2%E8%AA%9E-%E7%B9%81%E9%AB%94/';
        const url = base + encodeURIComponent(word);
        const T = encn_Cambridge_tc_new.T;

        let data;
        try {
            data = await Promise.race([
                api.fetch(url),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 6000)
                )
            ]);
        } catch (err) {
            if (err.message === 'timeout') {
                console.warn('Cambridge: request timed out');
            } else {
                console.error('Cambridge fetch error:', err);
            }
            return [];
        }

        const doc = new DOMParser().parseFromString(data, 'text/html');
        let entries = doc.querySelectorAll('.pr .entry-body__el');
        if (!entries.length) entries = doc.querySelectorAll('.entry-body__el');

        const notes = [];
        const css = encn_Cambridge_tc_new.CSS;

        for (const entry of entries) {
            const expression = T(entry.querySelector('.headword'));
            if (!expression) continue;

            // 發音
            const readings = entry.querySelectorAll('.pron .ipa');
            let reading = '';
            if (readings.length >= 2) {
                reading = `UK[${T(readings[0])}] US[${T(readings[1])}]`;
            } else if (readings.length === 1) {
                reading = `[${T(readings[0])}]`;
            }

            // 音檔
            const ukSrc = entry.querySelector('.uk.dpron-i source[type="audio/mpeg"]') ||
                           entry.querySelector('.uk.dpron-i source');
            const usSrc = entry.querySelector('.us.dpron-i source[type="audio/mpeg"]') ||
                           entry.querySelector('.us.dpron-i source');
            const audios = [
                ukSrc ? 'https://dictionary.cambridge.org' + ukSrc.getAttribute('src') : '',
                usSrc ? 'https://dictionary.cambridge.org' + usSrc.getAttribute('src') : ''
            ];

            // 詞性（整個 entry 共用）
            const posText = T(entry.querySelector('.posgram')) || T(entry.querySelector('.pos'));
            const posHtml = posText ? `<span class='pos'>${posText}</span>` : '';

            // RegExp 每個 entry 只編譯一次
            const safeExpr = expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const wordRe = new RegExp(safeExpr, 'gi');
            const boldExpr = `<b>${expression}</b>`;

            const definitions = [];
            for (const defBlock of entry.querySelectorAll('.def-block')) {
                const eng_tran = T(defBlock.querySelector('.ddef_h .def'));
                if (!eng_tran) continue;

                const transNode = defBlock.querySelector('.def-body .trans') ||
                                  defBlock.querySelector('.dtrans');
                const chn_tran = T(transNode);

                let definition = `${posHtml}<span class='tran'><span class='eng_tran'>${eng_tran.replace(wordRe, boldExpr)}</span><span class='chn_tran'>${chn_tran}</span></span>`;

                if (this.maxexample > 0) {
                    const examps = defBlock.querySelectorAll('.def-body .examp');
                    if (examps.length > 0) {
                        const limit = Math.min(examps.length, this.maxexample);
                        let sentHtml = '<ul class="sents">';
                        for (let i = 0; i < limit; i++) {
                            const eg = examps[i].querySelector('.eg') || examps[i].querySelector('.deg');
                            const exTrans = examps[i].querySelector('.trans') || examps[i].querySelector('.dtrans');
                            sentHtml += `<li class='sent'><span class='eng_sent'>${T(eg).replace(wordRe, boldExpr)}</span><span class='chn_sent'>${T(exTrans)}</span></li>`;
                        }
                        definition += sentHtml + '</ul>';
                    }
                }
                definitions.push(definition);
            }

            if (definitions.length > 0) {
                notes.push({ css, expression, reading, definitions, audios });
            }
        }
        return notes;
    }
}

encn_Cambridge_tc_new.CSS = `
    <style>
        span.pos {text-transform:lowercase; font-size:0.85em; margin-right:5px; padding:1px 4px; color:white; background-color:#2196F3; border-radius:3px;}
        span.eng_tran {display:block; color:#333; font-weight:bold; margin-bottom:2px;}
        span.chn_tran {display:block; color:#0d47a1; margin-bottom:5px;}
        ul.sents {font-size:0.9em; list-style:none; margin:5px 0; padding:8px; background:#f9f9f9; border-left:3px solid #2196F3;}
        li.sent {margin-bottom:4px;}
        span.eng_sent {display:block; color:#444;}
        span.chn_sent {display:block; color:#666; font-size:0.9em;}
    </style>`;
