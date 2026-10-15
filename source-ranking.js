// Pure ranking of download options: multiplayer-capable sources first, then the
// torrents with the most seeds. Small fix-only packages (flagged `supplement`)
// always stay last, as optionsFor already decided.
const isMultiplayer = item => /online[ -]?fix|multiplayer|\bco-?op\b/i.test(`${item.source_name || ''} ${item.raw_title || ''}`);
const isTorrent = item => /^magnet:/i.test(item.uri) || /\.torrent(?:$|\?)/i.test(item.uri);
function rankOptions(options, seedsByUri = new Map()) {
  const seeds = item => (isTorrent(item) ? Number(seedsByUri.get(item.uri)) || 0 : 0);
  return options
    .map((item, index) => ({ item, index }))
    .sort((a, b) =>
      (a.item.supplement ? 1 : 0) - (b.item.supplement ? 1 : 0)
      || (isMultiplayer(b.item) ? 1 : 0) - (isMultiplayer(a.item) ? 1 : 0)
      || (isTorrent(b.item) ? 1 : 0) - (isTorrent(a.item) ? 1 : 0)
      || seeds(b.item) - seeds(a.item)
      || a.index - b.index)
    .map(({ item }) => ({ ...item, seeds: isTorrent(item) ? seeds(item) : undefined, multiplayer: isMultiplayer(item) }));
}
module.exports = { rankOptions, isMultiplayer, isTorrent };
