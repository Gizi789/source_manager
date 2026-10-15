const { rankOptions } = require('./source-ranking');
const { parseMagnet, seedsForMagnet, createSeedLookup } = require('./seeds');
const mg = (c, extra = '') => 'magnet:?xt=urn:btih:' + c.repeat(40) + extra;
const item = (name, uri, extra = {}) => ({ raw_title: name, source_name: 'fitgirl', uri, ...extra });

test('multiplayer source goes first, then torrents by seeds', () => {
  const a = mg('a'), b = mg('b'), c = mg('c');
  const ranked = rankOptions([
    item('G', a), item('G', b), item('G online', c, { source_name: 'onlinefix' }), item('G', 'https://x.test/f.zip')
  ], new Map([[a, 5], [b, 50], [c, 1]]));
  expect(ranked.map(o => o.uri)).toEqual([c, b, a, 'https://x.test/f.zip']);
  expect(ranked[0].multiplayer).toBe(true);
  expect(ranked[1].seeds).toBe(50);
});
test('without multiplayer the most seeded torrent wins', () => {
  const a = mg('a'), b = mg('b');
  expect(rankOptions([item('G', a), item('G', b)], new Map([[a, 2], [b, 9]]))[0].uri).toBe(b);
});
test('a fix-only supplement stays last even if multiplayer', () => {
  const a = mg('a'), b = mg('b');
  const ranked = rankOptions([item('G fix', a, { source_name: 'onlinefix', supplement: true }), item('G', b)], new Map([[a, 99]]));
  expect(ranked.map(o => o.uri)).toEqual([b, a]);
});
test('ties and unknown seeds keep the original order', () => {
  const a = mg('a'), b = mg('b');
  expect(rankOptions([item('G', a), item('G', b)]).map(o => o.uri)).toEqual([a, b]);
});
test('parseMagnet reads hex and base32 hashes and trackers', () => {
  expect(parseMagnet(mg('a', '&tr=udp%3A%2F%2Ft.test%3A80'))).toEqual({ infoHash: 'a'.repeat(40), trackers: ['udp://t.test:80'] });
  expect(parseMagnet('magnet:?xt=urn:btih:' + 'A'.repeat(32)).infoHash).toBe('0'.repeat(40));
  expect(parseMagnet('https://x.test')).toBeNull();
});
test('seedsForMagnet takes the best tracker answer and tolerates failures', async () => {
  const scrape = async t => (t.includes('good') ? { seeders: 7 } : null);
  expect(await seedsForMagnet(mg('a', '&tr=udp%3A%2F%2Fgood.test%3A1&tr=udp%3A%2F%2Fbad.test%3A1'), { scrape })).toBe(7);
  expect(await seedsForMagnet(mg('a'), { scrape: async () => null })).toBeNull();
});
test('seed lookup caches results', async () => {
  let calls = 0;
  const lookup = createSeedLookup({ scrape: async () => { calls++; return { seeders: 3 }; }, now: () => 1 });
  const a = mg('a');
  expect((await lookup.lookup([a])).get(a)).toBe(3);
  const first = calls;
  await lookup.lookup([a]);
  expect(calls).toBe(first);
});
