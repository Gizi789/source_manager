const {optionsFor} = require('./links');
const magnet = 'magnet:?xt=urn:btih:' + 'a'.repeat(40);
test('full release precedes a tiny online-fix supplement without hiding it', () => {
  const result = optionsFor([
    {raw_title:'It Takes Two 1.0.0.2',source_name:'onlinefix',file_size:'37.2 MB',uris:[magnet]},
    {raw_title:'It Takes Two Free Download',source_name:'SteamRip',file_size:'45 GB',uris:['https://gofile.io/d/fixture']}
  ],'It Takes Two',()=>1);
  expect(result.map(item=>item.file_size)).toEqual(['45 GB','37.2 MB']);
});
test('a small standalone game keeps its torrent preference', () => {
  const result = optionsFor([
    {raw_title:'Fixture',source_name:'onlinefix',file_size:'37 MB',uris:[magnet,'https://example.test/file.zip']}
  ],'Fixture',()=>1);
  expect(result[0].uri).toBe(magnet);
  expect(result).toHaveLength(2);
});