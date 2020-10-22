const books = require('./books.json');

const akaToBookId = Object.fromEntries(Array.prototype.concat(...books.map((b, idx) => b.aka.map((a) => [ a, idx ] ))));

const bookRx = new RegExp (`\\b(?:${Array.prototype.concat(...books.map((b) => b.aka)).sort((a, b) => b.length - a.length).join('|')})\\b`, 'i');
const chchRx = new RegExp (`\\d+(?!\\s*:)(?:\\s*[–—-]\\s*\\d+)?(?:\\s*[;,]\\s*(?!${bookRx.source})\\d+(?!\\s*:)(?:\\s*[–—-]\\s*\\d+)?)*`, 'i');
const chvchvRx = /\d+\s*:\s*\d+[a-f]?\s*[–—-]\s*\d+\s*:\s*\d+[a-f]?/i;
const chvRx = new RegExp (`\\d+\\s*:\\s*\\d+[a-f]?(?:\\s*[–—-]\\s*\\d+[a-f]?)?(?:\\s*,\\s*(?!${bookRx.source})\\d+(?!\\s*:)[a-f]?(?:\\s*[–—-]\\s*\\d+(?!\\s*:)[a-f]?)?)*`, 'i');

const rx = new RegExp (`(${bookRx.source})|(${chchRx.source})|(${chvchvRx.source})|(${chvRx.source})`, 'ig');

const ScriptureReference = class {
    constructor (obj) {
        obj && Object.assign(this, obj);
    }
}

const rangeFormat = (book, ch, v) => parseInt(v) + (parseInt(ch) << 8) + ((Number.isInteger(book) ? book : akaToBookId[book]) << 16);

const rangeToReference = (range) => {
    const verse = range & 255;
    const chapter = (range >> 8) & 255;
    const bookId = (range >> 16);

    return [ books[bookId], chapter, verse ];
};

const parseScripture = (input) => {
    rx.lastIndex = 0;

    input = input.replace(/\s+/g, ' ');
    const len = input.length;
    const parts = [];
    let match, bookId;

    while (rx.lastIndex < len && (match = rx.exec(input))) {
        const [, bk, ch_ch, ch_v_ch_v, ch_vs ] = match;

        if (bk !== undefined) {
            bookId = akaToBookId[bk.toLowerCase()];
            continue;
        }
        if (bookId === undefined) continue;

        const { name: book, oneChapter } = books[bookId];

        if (ch_ch) {
            let chapters = ch_ch.match(/\d+\s*[–—-]\s*\d+|\d+/g);
            chapters.forEach((p) => {
                const chs = p.split(/\D+/).map((_) => parseInt(_));
                parts.push(oneChapter ? {
                    type: 'cv-v',
                    parameters: { book, from: [ 1, parseInt(chs[0]), '' ], to: [ 1, parseInt(chs[chs.length-1]), '' ] },
                    range: [ rangeFormat(bookId, 1, chs[0]), rangeFormat(bookId, 1, chs[chs.length-1]) ],
                } : {
                    type: 'c-c',
                    parameters: { book, from: [ parseInt(chs[0]), '', '' ], to: [ parseInt(chs[chs.length-1]), '', '' ] },
                    range: [ rangeFormat(bookId, chs[0], 0), rangeFormat(bookId, chs[chs.length-1], 255) ],
                });
            });
        }
        else if (ch_v_ch_v) {
            let [ from, to ] = ch_v_ch_v.split(/\s*[–—-]\s*/).map((cv) => cv.split(/\s*:\s*/)).map((cv) => [ cv[0], ...cv[1].split(/(?<=\d)(?!\d)/) ]);
            parts.push({
                type: 'cv-cv',
                parameters: { book, from: [ parseInt(from[0]), parseInt(from[1]), from[2] || '' ], to: [ parseInt(to[0]), parseInt(to[1]), to[2] || '' ] },
                range: [ rangeFormat(bookId, from[0], from[1]), rangeFormat(bookId, to[0], to[1]) ],
            });
        }
        else if (ch_vs) {
            const [ chapter, ...vs ] = ch_vs.split(/\s*[:,;]\s*/);
            vs.forEach((v) => {
                let [ v1, v2 ] = v.split(/\s*[–—-]\s*/).map((v) => v.split(/(?<=\d)(?!\d)/));
                if (! v2) v2 = v1;
                parts.push({
                    type: 'cv-v',
                    parameters: { book, from: [ parseInt(chapter), parseInt(v1[0]), v1[1] || '' ], to: [ parseInt(chapter), parseInt(v2[0]), v2[1] || '' ] },
                    range: [ rangeFormat(bookId, chapter, v1[0]), rangeFormat(bookId, chapter, v2[0]) ],
                });
            });
        }
    }

    return parts.map((p) => new ScriptureReference (p));
};

const normalizeScripture = (references) => {
    if (typeof references === 'string') references = parseScripture(references);
    if (! typeof references === 'array') references = [ references ];

    const normalized = [];
    let last;

    references.forEach((ref) => {
        if (!ref.constructor || ref.constructor.name !== 'ScriptureReference') throw `${ref} is not a ScriptureReference`;
        const { book, from, to } = ref.parameters;
        let norm = from[0] + (from[1] && `:${from[1]}${from[2]}`);

        // if the chapter is different
        if (to[0] !== from[0]) {
            norm += `-${to[0]}` + (to[1] && `:${to[1]}${to[2]}`);
        }

        // if the chapter is the same, but the verse is different
        else if (to[1] !== from[1]) {
            norm += `-${to[1]}${to[2]}`;
        }

        // if the chapter and verse are the same, but the fragment is different
        else if (to[2] !== from[2]) {
            norm += `-${to[2]}`;
        }

        if (last && last.parameters.book === book) {
            const sep = last.type === ref.type ? ',' : ';';

            // single chapter, and same chapter as previous reference
            if (last.parameters.from[0] === last.parameters.to[0] && from[0] === to[0] && last.parameters.from[0] == from[0]) {
                norm = `${from[1]}${from[2]}`;
                if (from[1] === to[1] && from[2] === to[2]) ;
                else if (from[1] === to[1]) norm += `-${to[2]}`;
                else norm += `-${to[1]}${to[2]}`;
            }

            normalized[normalized.length-1] += `${sep} ${norm}`;
        }
        else {
            normalized.push(`${book} ${norm}`);
        }
        last = ref;
    });

    return [ references, normalized ];
};

const getBookById = (id) => books[id];

const getBookByName = (aka) => books[akaToBookId[aka.toLowerCase()]];

exports = { rangeFormat, rangeToReference, parseScripture, normalizeScripture, getBookById, getBookByName };
