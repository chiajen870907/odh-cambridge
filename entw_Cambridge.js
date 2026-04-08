/* global api */
class entw_Cambridge {
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
            if (!node) return '';
            return node.innerText.trim();
        }

        let base = 'https://dictionary.cambridge.org/zht/%E8%A9%9E%E5%85%B8/%E8%8B%B1%E8%AA%9E-%E6%BC%A2%E8%AA%9E-%E7%B9%81%E9%AB%94/';
        let url = base + encodeURIComponent(word);

        let doc;
        try {
            let data = await Promise.race([
                api.fetch(url),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 6000)
                )
            ]);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
            console.log('[Cambridge] fetch OK, data length:', data.length);
        } catch (err) {
            if (err.message === 'timeout') {
                console.warn('[Cambridge] request timed out');
            } else {
                console.error('[Cambridge] fetch error:', err);
            }
            return [];
        }

        let entries = doc.querySelectorAll('.pr .entry-body__el');
        console.log('[Cambridge] .pr .entry-body__el count:', entries.length);
        if (!entries || !entries.length) {
            entries = doc.querySelectorAll('.entry-body__el');
            console.log('[Cambridge] .entry-body__el count:', entries.length);
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
                reading = 'UK[' + T(readings[0]) + '] US[' + T(readings[1]) + ']';
            } else if (readings.length === 1) {
                reading = '[' + T(readings[0]) + ']';
            }

            // 音檔
            let ukSrc = entry.querySelector('.uk.dpron-i source[type="audio/mpeg"]') ||
                        entry.querySelector('.uk.dpron-i source');
            let usSrc = entry.querySelector('.us.dpron-i source[type="audio/mpeg"]') ||
                        entry.querySelector('.us.dpron-i source');
            audios[0] = ukSrc ? 'https://dictionary.cambridge.org' + ukSrc.getAttribute('src') : '';
            audios[1] = usSrc ? 'https://dictionary.cambridge.org' + usSrc.getAttribute('src') : '';

            // 詞性
            let pos = T(entry.querySelector('.posgram')) || T(entry.querySelector('.pos'));
            pos = pos ? "<span class='pos'>" + pos + '</span>' : '';

            // RegExp 每個 entry 只編譯一次
            let safeExpr = expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let wordRe = new RegExp(safeExpr, 'gi');
            let boldWord = '<b>' + expression + '</b>';

            let defBlocks = entry.querySelectorAll('.def-block') || [];
            for (const defBlock of defBlocks) {
                let eng_tran = T(defBlock.querySelector('.ddef_h .def'));
                if (!eng_tran) continue;

                let transNode = defBlock.querySelector('.def-body .trans') ||
                                defBlock.querySelector('.dtrans');
                let chn_tran = T(transNode);

                let definition = pos +
                    "<span class='tran'>" +
                        "<span class='eng_tran'>" + eng_tran.replace(wordRe, boldWord) + '</span>' +
                        "<span class='chn_tran'>" + chn_tran + '</span>' +
                    '</span>';

                let examps = defBlock.querySelectorAll('.def-body .examp') || [];
                if (examps.length > 0 && this.maxexample > 0) {
                    definition += '<ul class="sents">';
                    for (let i = 0; i < examps.length && i < this.maxexample; i++) {
                        let eg = examps[i].querySelector('.eg') || examps[i].querySelector('.deg');
                        let exTrans = examps[i].querySelector('.trans') || examps[i].querySelector('.dtrans');
                        let eng_examp = T(eg).replace(wordRe, boldWord);
                        let chn_examp = T(exTrans);
                        definition += "<li class='sent'>" +
                            "<span class='eng_sent'>" + eng_examp + '</span>' +
                            "<span class='chn_sent'>" + chn_examp + '</span>' +
                        '</li>';
                    }
                    definition += '</ul>';
                }
                definitions.push(definition);
            }

            if (definitions.length > 0) {
                let css = this.renderCSS();
                notes.push({ css, expression, reading, definitions, audios });
            }
        }
        return notes;
    }

    renderCSS() {
        return `
            <style>
                span.pos {text-transform:lowercase; font-size:0.9em; margin-right:5px; padding:2px 4px; color:white; background-color:#0d47a1; border-radius:3px;}
                span.tran {margin:0; padding:0;}
                span.eng_tran {display:block; color:#333; font-weight:bold; margin-bottom:2px;}
                span.chn_tran {display:block; color:#0d47a1; margin-bottom:5px;}
                ul.sents {font-size:0.8em; list-style:square inside; margin:3px 0; padding:5px; background:rgba(13,71,161,0.1); border-radius:5px;}
                li.sent {margin:0; padding:0;}
                span.eng_sent {display:block; color:#444;}
                span.chn_sent {display:block; color:#0d47a1; font-size:0.9em;}
            </style>`;
    }
}
