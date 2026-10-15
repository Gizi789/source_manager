const crypto = require('node:crypto');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PAGE_HOSTS = ['datanodes.to', 'datanodes.com', 'filekeeper.net', 'akirabox.com', 'vikingfile.com', '1fichier.com', 'pixeldrain.com', 'qiwi.gg', 'drive.google.com', 'mediafire.com', 'mega.nz', 'krakenfiles.com', 'buzzheavier.com', 'rapidgator.net', 'multiup.org', 'uploadhaven.com', 'megaup.net', 'filemoon.sx', 'rentry.co', 'pastebin.com'];
const onHost = (host, base) => host === base || host.endsWith('.' + base);
function hoster(uri) {
  if (/^magnet:/i.test(uri)) {
    const topics = new URLSearchParams(uri.replace(/&amp;/gi, '&').split('?')[1] || '').getAll('xt');
    if (!topics.some(topic => /^urn:btih:(?:[a-f0-9]{40}|[a-z2-7]{32})$/i.test(topic) || /^urn:btmh:1220[a-f0-9]{64}$/i.test(topic))) throw new Error('El magnet no contiene un identificador torrent válido.');
    return 'torrent';
  }
  const parsed = new URL(uri);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported download protocol');
  if (onHost(parsed.hostname, 'gofile.io') && /^\/d\/[\w-]+\/?$/.test(parsed.pathname)) return 'gofile';
  if (onHost(parsed.hostname, 'pixeldrain.com') && /^\/(?:u|api\/file)\/[\w-]+\/?$/.test(parsed.pathname)) return 'pixeldrain';
  if (onHost(parsed.hostname, 'datanodes.to') || onHost(parsed.hostname, 'datanodes.com')) return 'datanodes';
    if (onHost(parsed.hostname, 'mediafire.com')) return 'mediafire';
  if (onHost(parsed.hostname, 'qiwi.gg')) return 'qiwi';
  if (onHost(parsed.hostname, 'krakenfiles.com')) return 'krakenfiles';
  if (onHost(parsed.hostname, '1fichier.com')) return '1fichier';
  if (onHost(parsed.hostname, 'buzzheavier.com')) return 'buzzheavier';
  if (onHost(parsed.hostname, 'megaup.net')) return 'megaup';
  if (onHost(parsed.hostname, 'filemoon.sx')) return 'filemoon';
  if (PAGE_HOSTS.some(host => onHost(parsed.hostname, host))) return 'browser';
  return /\.torrent$/i.test(parsed.pathname) ? 'torrent' : 'http';
}
function optionsFor(items, name, scoreTitle) {
  const seen = new Set();
  const options = [];
  for (const item of items) {
    const score = scoreTitle(name, item.raw_title);
    if (score < 0.55) continue;
    for (const raw of item.uris || [item.uri]) {
      if (typeof raw !== 'string') continue;
      const uri = raw.trim();
      try { hoster(uri); } catch { continue; }
      if (seen.has(uri)) continue;
      seen.add(uri);
      options.push({ ...item, uri, score, id: crypto.createHash('sha256').update(uri).digest('hex') });
    }
  }
  const priority = item => hoster(item.uri) === 'torrent' ? 0 : hoster(item.uri) === 'browser' ? 2 : 1;
  const sizeBytes = item => {
    const match = String(item.file_size || '').match(/^\s*([\d.,]+)\s*(KB|MB|GB|TB|KiB|MiB|GiB|TiB)\b/i);
    if (!match) return 0;
    const unit = match[2].toUpperCase().replace('I', '');
    return Number(match[1].replace(',', '.')) * 1024 ** ({KB:1,MB:2,GB:3,TB:4}[unit]);
  };
  const largest = Math.max(0, ...options.map(sizeBytes));
  const supplement = item => {
    const bytes = sizeBytes(item);
    const hint = /online[ -]?fix|\b(?:update|patch|crack|fix only)\b/i.test(item.source_name + ' ' + item.raw_title);
    return hint && bytes > 0 && largest >= 1024 ** 3 && bytes < largest / 100 ? 1 : 0;
  };
  // Keep every source available, but don't default to a tiny fix-only package
  // when the same game's feed also provides a full-size release.
  return options
    .sort((a, b) => supplement(a) - supplement(b) || priority(a) - priority(b) || b.score - a.score)
    .map(item => ({ ...item, supplement: supplement(item) === 1 }));
}
function assertFileHeaders(headers) {
  const type = String(headers['content-type'] || '').toLowerCase();
  if (['text/html', 'application/xhtml', 'application/json'].some(value => type.includes(value))) {
    throw new Error('La fuente devolvió una página web, no el archivo del juego.');
  }
}
function createResolver({ http, websiteToken, log = console }) {
  let token = process.env.GOFILE_TOKEN || '';
  let authorization;
  const resolved = new Map();
  async function authorize() {
    if (token) return token;
    if (!authorization) authorization = (async () => {
      const wt = await websiteToken('');
      const response = await http.post('https://api.gofile.io/accounts', {}, {
        timeout: 15000, headers: { 'X-Website-Token': wt, 'X-BL': 'en-US', 'User-Agent': USER_AGENT, Referer: 'https://gofile.io/' }
      });
      if (response.data.status !== 'ok' || !response.data.data?.token) throw new Error('Gofile no pudo autorizar la descarga.');
      token = response.data.data.token;
      return token;
    })().finally(() => { authorization = undefined; });
    return authorization;
  }
  async function walk(id, account, visited = new Set()) {
    if (visited.has(id) || visited.size >= 100) return null;
    visited.add(id);
    const wt = await websiteToken(account);
    for (let page = 1; page <= 100; page++) {
      const response = await http.get('https://api.gofile.io/contents/' + encodeURIComponent(id), {
        timeout: 15000, params: { page, pageSize: 1000, sortField: 'createTime', sortDirection: '-1' },
        headers: { Authorization: 'Bearer ' + account, 'X-Website-Token': wt, 'X-BL': 'en-US', 'User-Agent': USER_AGENT, Referer: 'https://gofile.io/' }
      });
      const payload = response.data;
      if (payload.status !== 'ok' || !payload.data) throw new Error('Gofile: ' + (payload.status || 'respuesta inválida'));
      const content = payload.data;
      if (content.canAccess === false) return null;
      if (content.type === 'file' && content.link) return { url: content.link, name: content.name };
      for (const child of Object.values(content.children || {})) {
        if (child.type === 'file' && child.link) return { url: child.link, name: child.name };
        if (child.type === 'folder' && child.canAccess !== false) {
          const file = await walk(child.id, account, visited);
          if (file) return file;
        }
      }
      if (page >= Number(payload.metadata?.totalPages || 1)) break;
    }
    return null;
  }
  async function prepare(uri) {
    uri = uri.trim();
    if (/^magnet:/i.test(uri)) uri = 'magnet:' + uri.split(':').slice(1).join(':').replace(/&amp;/gi, '&');
    const kind = hoster(uri);
    // Viking's current Hydra adapter uses their subscription unlock API.
    // Until GameAccess PLUS supplies an unlocker, keep the user's normal browser flow.
    if (kind === 'browser') return { mode: 'browser', url: uri };
    
    if (kind === 'mediafire') {
      try {
        log.info('Extracting mediafire: ' + uri);
        const { data } = await http.get(uri, { headers: { 'User-Agent': USER_AGENT } });
        const match = data.match(/href="(https:\/\/download[^"]+)"/);
        if (match) return { mode: 'direct', url: match[1] };
      } catch (e) { log.warn('Mediafire error: ' + e.message); }
      return { mode: 'browser', url: uri };
    }

    if (kind === 'qiwi') {
      try {
        log.info('Extracting qiwi: ' + uri);
        const { data } = await http.get(uri, { headers: { 'User-Agent': USER_AGENT } });
        const match = data.match(/href="([^"]+\.qiwi\.gg\/[^"]+)"/i) || data.match(/<a[^>]+href="([^"]+)"[^>]*download/i);
        if (match) {
            let u = match[1];
            if (u.startsWith('/')) u = 'https://qiwi.gg' + u;
            return { mode: 'direct', url: u };
        }
      } catch (e) { log.warn('Qiwi error: ' + e.message); }
      return { mode: 'browser', url: uri };
    }

    if (kind === 'krakenfiles') {
      try {
        log.info('Extracting krakenfiles: ' + uri);
        const { data } = await http.get(uri, { headers: { 'User-Agent': USER_AGENT } });
        const tokenMatch = data.match(/id="dl-token"[^>]*value="([^"]+)"/);
        if (tokenMatch) {
          const urlMatch = data.match(/action="([^"]+\/download)"/);
          if (urlMatch) {
             const dlUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : 'https://krakenfiles.com' + urlMatch[1];
             const { data: dlData } = await http.post(dlUrl, 'token=' + encodeURIComponent(tokenMatch[1]), { headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'Hash': tokenMatch[1] }});
             if (dlData.url) return { mode: 'direct', url: dlData.url };
          }
        }
      } catch (e) { log.warn('Krakenfiles error: ' + e.message); }
      return { mode: 'browser', url: uri };
    }

    if (kind === '1fichier') {
      try {
        log.info('Extracting 1fichier: ' + uri);
        const { data } = await http.post(uri, 'dl_no_ssl=on&dlinline=on', { headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' } });
        const match = data.match(/href="(https:\/\/[^\/]+\.1fichier\.com\/[^\/]+)"/);
        if (match) return { mode: 'direct', url: match[1] };
      } catch (e) { log.warn('1fichier error: ' + e.message); }
      return { mode: 'browser', url: uri };
    }

    if (kind === 'buzzheavier') {
      try {
        log.info('Extracting buzzheavier: ' + uri);
        const { data } = await http.get(uri, { headers: { 'User-Agent': USER_AGENT } });
        const match = data.match(/href="([^"]+)"[^>]*>Download/i) || data.match(/<a[^>]+href="([^"]+)"[^>]*id="download"/i);
        if (match) {
            let u = match[1];
            if (u.startsWith('/')) u = 'https://buzzheavier.com' + u;
            return { mode: 'direct', url: u };
        }
      } catch(e){ log.warn('Buzzheavier error: ' + e.message); }
      return { mode: 'browser', url: uri };
    }

    if (kind === 'megaup') {
      try {
        log.info('Extracting megaup: ' + uri);
        const { data } = await http.get(uri, { headers: { 'User-Agent': USER_AGENT } });
        const match = data.match(/href="(https:\/\/megaup\.net\/[^\/]+\/[^"]+)"[^>]*class="btn/i) || data.match(/<a[^>]+href="([^"]+)"[^>]*download/i);
        if (match) return { mode: 'direct', url: match[1] };
      } catch (e) { log.warn('Megaup error: ' + e.message); }
      return { mode: 'browser', url: uri };
    }

    if (kind === 'filemoon') {
      try {
        log.info('Extracting filemoon: ' + uri);
        const { data } = await http.get(uri, { headers: { 'User-Agent': USER_AGENT } });
        const inputs = [...data.matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/gi)];
        let formData = new URLSearchParams();
        inputs.forEach(m => formData.append(m[1], m[2]));
        if (formData.has('op')) {
          const { data: postHtml } = await http.post(uri, formData.toString(), {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT, Referer: uri }
          });
          const linkMatch = postHtml.match(/href="([^"]+)"[^>]*>Download/i);
          if (linkMatch) return { mode: 'direct', url: linkMatch[1] };
        }
      } catch (e) { log.warn('Filemoon error: ' + e.message); }
      return { mode: 'browser', url: uri };
    }
    
    if (kind === 'datanodes') {
      try {
        log.info('Extracting datanodes: ' + uri);
        const { data: html } = await http.get(uri, { headers: { 'User-Agent': USER_AGENT } });
        const inputs = [...html.matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/gi)];
        let formData = new URLSearchParams();
        inputs.forEach(m => formData.append(m[1], m[2]));
        
        if (formData.has('op')) {
          log.info('Sending POST to datanodes...');
          const { data: postHtml } = await http.post(uri, formData.toString(), {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT, Referer: uri }
          });
          const linkMatch = postHtml.match(/href="([^"]+)"[^>]*>Download/i) || postHtml.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*download[^"]*"/i);
          if (linkMatch) {
             return { mode: 'direct', url: linkMatch[1] };
          } else {
             // Second step form?
             const inputs2 = [...postHtml.matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/gi)];
             let formData2 = new URLSearchParams();
             inputs2.forEach(m => formData2.append(m[1], m[2]));
             if (formData2.has('op')) {
                log.info('Sending second POST to datanodes...');
                // Wait for potential timer before second post
                await new Promise(r => setTimeout(r, 2000));
                const { data: postHtml2 } = await http.post(uri, formData2.toString(), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT, Referer: uri }
                });
                const linkMatch2 = postHtml2.match(/href="([^"]+)"[^>]*>Download/i) || postHtml2.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*download[^"]*"/i);
                if (linkMatch2) return { mode: 'direct', url: linkMatch2[1] };
             }
          }
        }
      } catch (e) {
        log.warn('Datanodes extractor failed: ' + e.message);
      }
      return { mode: 'browser', url: uri };
    }
    if (kind === 'pixeldrain') {
      const id = new URL(uri).pathname.split('/').filter(Boolean).pop();
      return { mode: 'direct', url: 'https://pixeldrain.com/api/file/' + encodeURIComponent(id) + '?download' };
    }
    if (kind !== 'gofile') return { mode: 'direct', url: uri };
    const cached = resolved.get(uri);
    if (cached && cached.expires > Date.now()) return cached.value;
    const id = new URL(uri).pathname.split('/')[2];
    let file;
    const account = await authorize();
    try { file = await walk(id, account); }
    catch (error) {
      if (!process.env.GOFILE_TOKEN && /wrongToken|notAuthenticated|badToken/i.test(error.message)) {
        token = '';
        file = await walk(id, await authorize());
      } else throw error;
    }
    if (!file) throw new Error('Gofile no contiene un archivo de descarga accesible.');
    const cookie = { Cookie: 'accountToken=' + token, 'User-Agent': USER_AGENT };
    const head = await http.head(file.url, { timeout: 15000, headers: cookie });
    assertFileHeaders(head.headers);
    const value = { mode: 'proxy', url: file.url, name: file.name || decodeURIComponent(new URL(file.url).pathname.split('/').pop()) || 'download.bin', headers: cookie };
    // Short lived signed URLs are prepared at download time, not catalog time.
    for (const [key, entry] of resolved) if (entry.expires <= Date.now()) resolved.delete(key);
    resolved.set(uri, { value, expires: Date.now() + 15000 });
    log.info('[Sources] Gofile file resolved; name=' + value.name);
    return value;
  }
  return { prepare };
}
module.exports = { USER_AGENT, hoster, optionsFor, assertFileHeaders, createResolver };
