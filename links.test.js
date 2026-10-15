const { hoster, optionsFor, createResolver } = require('./links');
const magnet = 'magnet:?xt=urn:btih:' + 'a'.repeat(40);
test('rejects incomplete magnets before returning source choices', () => {
  expect(() => hoster('magnet:?dn=missing')).toThrow('identificador');
  const choices = optionsFor([{raw_title:'Fixture',uris:['magnet:?xt=urn:btih:bad',magnet]}], 'Fixture', () => 1);
  expect(choices.map(item => item.uri)).toEqual([magnet]);
});
test('host pages cannot be reported as downloadable files', () => {
  for (const url of ['https://datanodes.to/id','https://filekeeper.net/id/game.zip','https://akirabox.com/id/file']) {
    expect(hoster(url)).toBe('browser');
  }
});
test('prefers torrent then downloadable file before browser pages', () => {
  const choices = optionsFor([{raw_title:'Fixture',uris:['https://datanodes.to/id','https://gofile.io/d/id',magnet]}], 'Fixture', () => 1);
  expect(choices.map(item => hoster(item.uri))).toEqual(['torrent','gofile','browser']);
});
test('normalizes magnets without using HTTP', async () => {
  const http = {get:jest.fn(),head:jest.fn()};
  const resolver = createResolver({http,websiteToken:jest.fn()});
  const result = await resolver.prepare(' MAGNET:?xt=urn:btih:' + 'a'.repeat(40) + '&amp;dn=Fixture ');
  expect(result).toEqual({mode:'direct',url:magnet+'&dn=Fixture'});
  expect(http.get).not.toHaveBeenCalled();
  expect(http.head).not.toHaveBeenCalled();
});
test('uses the Pixeldrain file endpoint and preserves browser mode for DataNodes', async () => {
  const resolver = createResolver({http:{},websiteToken:jest.fn()});
  expect(await resolver.prepare('https://pixeldrain.com/u/fixture')).toEqual({mode:'direct',url:'https://pixeldrain.com/api/file/fixture?download'});
  expect(await resolver.prepare('https://datanodes.to/fixture')).toEqual({mode:'browser',url:'https://datanodes.to/fixture'});
});