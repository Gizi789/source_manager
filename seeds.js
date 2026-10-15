// Seed counts straight from the torrent's trackers (UDP scrape, BEP 15).
// Runs on the user's machine; nothing goes through our server.
const dgram = require('node:dgram');
const crypto = require('node:crypto');
const FALLBACK_TRACKERS = ['udp://tracker.opentrackr.org:1337/announce', 'udp://open.stealth.si:80/announce'];
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32ToHex(text) {
  let bits = '';
  for (const ch of text.toUpperCase()) bits += B32.indexOf(ch).toString(2).padStart(5, '0');
  let hex = '';
  for (let i = 0; i + 4 <= bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex.slice(0, 40);
}
function parseMagnet(uri) {
  const params = new URLSearchParams(String(uri).replace(/&amp;/gi, '&').split('?')[1] || '');
  const xt = params.getAll('xt').find(value => /^urn:btih:/i.test(value));
  if (!xt) return null;
  const raw = xt.slice(9);
  const infoHash = /^[a-f0-9]{40}$/i.test(raw) ? raw.toLowerCase() : /^[a-z2-7]{32}$/i.test(raw) ? base32ToHex(raw) : null;
  return infoHash ? { infoHash, trackers: params.getAll('tr') } : null;
}
function scrapeUdp(tracker, infoHash, timeoutMs = 2500) {
  return new Promise(resolve => {
    let url;
    try { url = new URL(tracker); } catch { return resolve(null); }
    if (url.protocol !== 'udp:' || !url.port) return resolve(null);
    const socket = dgram.createSocket('udp4');
    const tx = crypto.randomBytes(4);
    let stage = 'connect';
    let done = false;
    const finish = value => { if (done) return; done = true; clearTimeout(timer); try { socket.close(); } catch {} resolve(value); };
    const timer = setTimeout(() => finish(null), timeoutMs);
    socket.on('error', () => finish(null));
    socket.on('message', msg => {
      if (msg.length < 8 || !msg.subarray(4, 8).equals(tx)) return;
      const action = msg.readUInt32BE(0);
      if (stage === 'connect' && action === 0 && msg.length >= 16) {
        stage = 'scrape';
        const req = Buffer.alloc(36);
        msg.subarray(8, 16).copy(req, 0);
        req.writeUInt32BE(2, 8);
        tx.copy(req, 12);
        Buffer.from(infoHash, 'hex').copy(req, 16);
        socket.send(req, Number(url.port), url.hostname);
      } else if (stage === 'scrape' && action === 2 && msg.length >= 20) {
        finish({ seeders: msg.readUInt32BE(8), completed: msg.readUInt32BE(12), leechers: msg.readUInt32BE(16) });
      } else finish(null);
    });
    const hello = Buffer.alloc(16);
    hello.writeUInt32BE(0x417, 0);
    hello.writeUInt32BE(0x27101980, 4);
    hello.writeUInt32BE(0, 8);
    tx.copy(hello, 12);
    socket.send(hello, Number(url.port), url.hostname, err => { if (err) finish(null); });
  });
}
// Highest seeder count reported by any tracker; null if none answered.
async function seedsForMagnet(uri, { scrape = scrapeUdp, timeoutMs } = {}) {
  const parsed = parseMagnet(uri);
  if (!parsed) return null;
  const trackers = [...new Set([...parsed.trackers, ...FALLBACK_TRACKERS])].filter(t => /^udp:/i.test(t)).slice(0, 6);
  const results = await Promise.all(trackers.map(t => scrape(t, parsed.infoHash, timeoutMs)));
  const counts = results.filter(Boolean).map(r => r.seeders);
  return counts.length ? Math.max(...counts) : null;
}
// Seeds for many magnets, cached so repeated lookups cost nothing.
function createSeedLookup({ scrape = scrapeUdp, ttlMs = 10 * 60 * 1000, now = Date.now, concurrency = 6 } = {}) {
  const cache = new Map();
  async function lookup(uris, { timeoutMs } = {}) {
    const out = new Map();
    const pending = [];
    for (const uri of uris) {
      const hit = cache.get(uri);
      if (hit && now() - hit.at < ttlMs) { if (hit.seeds != null) out.set(uri, hit.seeds); } else pending.push(uri);
    }
    let next = 0;
    const worker = async () => {
      while (next < pending.length) {
        const uri = pending[next++];
        const seeds = await seedsForMagnet(uri, { scrape, timeoutMs });
        cache.set(uri, { seeds, at: now() });
        if (seeds != null) out.set(uri, seeds);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
    return out;
  }
  return { lookup };
}
module.exports = { parseMagnet, scrapeUdp, seedsForMagnet, createSeedLookup, base32ToHex };
