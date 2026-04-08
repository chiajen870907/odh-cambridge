/* global api */
class encn_Cambridge_tc {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        return '劍橋英漢雙解 (繁體中文)';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample !== undefined ? options.maxexample : 2;
    }

    async findTerm(word) {
        this.word = word;
        return await this.findCambridge(word);
    }

    async findCambridge(word) {
        let notes = [];
        if (!word) return notes;

        function T(node) {
            return node ? node.innerText.trim() : '';
        }

        // 新版繁體中文查詢網址 (/zht/ 介面)
        let base = 'https://dictionary.cambridge.org/zht/%E8%A9%9E%E5%85%B8/%E8%8B%B1%E8%AA%9E-%E6%BC%A2%E8%AA%9E-%E7%B9%81%E9%AB%94/';
        let url = base + encodeURIComponent(word);

        const TIMEOUT_MS = 6000;
        try {
            let data = await Promise.race([
                api.fetch(url),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
                )
            ]);
            let parser = new DOMParser();
            let doc = parser.parseFromString(data, 'text/html');

            // 嘗試主要與備用選擇器
            let entries = doc.querySelectorAll('.pr .entry-body__el');
            if (!entries || entries.length === 0) {
                entries = doc.querySelectorAll('.entry-body__el');
            }

            for (const entry of entries) {
                let definitions = [];
                let audios = [];

                let expression = T(entry.querySelector('.headword'));
                if (!expression) continue;

                // 發音
                let reading = '';
                let readings = entry.querySelectorAll('.pron .ipa');
                if (readings.length >= 2) {
                    reading = `UK[${T(readings[0])}] US[${T(readings[1])}]`;
                } else if (readings.length === 1) {
                    reading = `[${T(readings[0])}]`;
                }

                // 發音音檔
                let ukAudio = entry.querySelector('.uk.dpron-i source[type="audio/mpeg"]') ||
                              entry.querySelector('.uk.dpron-i source');
                let usAudio = entry.querySelector('.us.dpron-i source[type="audio/mpeg"]') ||
                              entry.querySelector('.us.dpron-i source');
                audios[0] = ukAudio ? 'https://dictionary.cambridge.org' + ukAudio.getAttribute('src') : '';
                audios[1] = usAudio ? 'https://dictionary.cambridge.org' + usAudio.getAttribute('src') : '';

                // 詞性
                let pos = T(entry.querySelector('.posgram'));
                if (!pos) pos = T(entry.querySelector('.pos'));
                let posHtml = pos ? `<span class='pos'>${pos}</span>` : '';

                // 定義區塊
                let defBlocks = entry.querySelectorAll('.def-block');
                for (const defBlock of defBlocks) {
                    let eng_tran = T(defBlock.querySelector('.ddef_h .def'));
                    if (!eng_tran) continue;

                    // 繁體中文翻譯：優先 .trans.dtrans
                    let transNode = defBlock.querySelector('.def-body .trans') ||
                                   defBlock.querySelector('.dtrans');
                    let chn_tran = T(transNode);

                    let safeExpr = expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    let clean_eng = eng_tran.replace(new RegExp(safeExpr, 'gi'), `<b>${expression}</b>`);

                    let definition = `${posHtml}<span class='tran'><span class='eng_tran'>${clean_eng}</span><span class='chn_tran'>${chn_tran}</span></span>`;

                    // 例句
                    let examps = defBlock.querySelectorAll('.def-body .examp');
                    if (examps.length > 0 && this.maxexample > 0) {
                        definition += '<ul class="sents">';
                        for (let i = 0; i < examps.length && i < this.maxexample; i++) {
                            let eg = examps[i].querySelector('.eg') || examps[i].querySelector('.deg');
                            let exTrans = examps[i].querySelector('.trans') || examps[i].querySelector('.dtrans');
                            let eng_examp = T(eg).replace(new RegExp(safeExpr, 'gi'), `<b>${expression}</b>`);
                            let chn_examp = T(exTrans);
                            definition += `<li class='sent'><span class='eng_sent'>${eng_examp}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                        }
                        definition += '</ul>';
                    }
                    definitions.push(definition);
                }

                if (definitions.length > 0) {
                    notes.push({
                        css: this.renderCSS(),
                        expression,
                        reading,
                        definitions,
                        audios
                    });
                }
            }
        } catch (err) {
            if (err.message === 'timeout') {
                console.warn('Cambridge: request timed out');
            } else {
                console.error('Cambridge fetch error:', err);
            }
            return [];
        }
        return notes;
    }

    renderCSS() {
        return `
            <style>
                span.pos {text-transform:lowercase; font-size:0.85em; margin-right:5px; padding:1px 4px; color:white; background-color:#2196F3; border-radius:3px;}
                span.eng_tran {display:block; color:#333; font-weight:bold; margin-bottom:2px;}
                span.chn_tran {display:block; color:#0d47a1; margin-bottom:5px;}
                ul.sents {font-size:0.9em; list-style:none; margin:5px 0; padding:8px; background:#f9f9f9; border-left:3px solid #2196F3;}
                li.sent {margin-bottom:4px;}
                span.eng_sent {display:block; color:#444;}
                span.chn_sent {display:block; color:#666; font-size:0.9em;}
            </style>`;
    }
}
