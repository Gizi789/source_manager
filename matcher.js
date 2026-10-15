
// Match game identity before accepting release/version metadata.
// A fuzzy character ratio must never enable a different game's download.
const cache = new Map();
// split=true separa palabras pegadas por mayuscula (DeadSpace -> dead space); split=false no lo hace (GunMan -> gunman).
function cleanTitle(title, split = true) {
    if (!title || typeof title !== 'string') return '';
    const key = split ? title : '\u0000' + title;
    if (cache.has(key)) return cache.get(key);
    const clean = title.replace(/[®™©℠]/g, '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
        .replace(split ? /([a-z])([A-Z])/g : /(?!)/g, '$1 $2')
        .replace(/['’]/g, '').replace(/&/g, ' and ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
    cache.set(key, clean);
    return clean;
}
// Una mayuscula en medio de una palabra puede o no separar palabras: probamos las dos lecturas.
function calculateScore(gameName, rawTitle) {
    return Math.max(scoreWith(gameName, rawTitle, true), scoreWith(gameName, rawTitle, false));
}
function scoreWith(gameName, rawTitle, split) {
    const name = cleanTitle(gameName, split);
    const title = cleanTitle(rawTitle, split);
    if (!name || !title) return 0;
    if (name === title) return 1;
    const tokens = title.split(' ');
    const gameTokens = name.split(' ');
    // Optional feed/repacker prefixes are not part of game identity.
    while (['fitgirl', 'dodi', 'repack', 'repacks', 'onlinefix'].includes(tokens[0])) tokens.shift();
    if (!gameTokens.every((token, index) => token === tokens[index])) return 0;
    const rest = tokens.slice(gameTokens.length);
    if (!rest.length) return 0.95;
    const marker = rest[0];
    // Bare sequel numbers and unrelated subtitles cannot be release metadata.
    const release = /^(?:v\d|build|version|ver|free|download|repack|repacks|multi\d|update|all|dlc|deluxe|ultimate|complete|edition|goty|onlinefix|fitgirl|dodi|steamrip|gog|incl|including|with|win|windows)/i;
    const dottedVersion = /^\d+$/.test(marker) && /^\d+$/.test(rest[1] || '') && /\b\d+\.\d+/.test(rawTitle);
    return release.test(marker) || dottedVersion ? 0.9 : 0;
}
module.exports = { cleanTitle, calculateScore };
