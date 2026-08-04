const { Readable } = require('stream');
const { getRequest, exEncdec, getRootBase, getRelativeBase, extractURIPart, STALKER_UA } = require('./utils');
const { appMacportaldetail, appStreamproxy } = require('./settings');
const { getChannelDetail, macGetPlaybackLink } = require('./stalker');

const STREAM_HEADERS = { 'User-Agent': STALKER_UA };

function isValidUrl(u) {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

function rewriteManifest(ret, effective_url, M3U_EXT, KEY_EXT, TS_EXT) {
  const lines = String(ret).split('\n');
  let hine = '';
  for (const vine of lines) {
    const lower = vine.toLowerCase();
    if (lower.includes('URI="')) {
      const orgURL = extractURIPart(vine);
      if (!orgURL) { hine += vine + '\n'; continue; }
      const iBaseURL = orgURL[0] === '/' ? getRootBase(effective_url) : getRelativeBase(effective_url);
      let b = iBaseURL;
      if (b.includes('http://') || b.includes('https://')) b = '';
      // id-branch: nested playlist; chunks-branch: key URI
      const norgURL = 'live' + (KEY_EXT === '.key' ? KEY_EXT : M3U_EXT) + '?chunks=' + exEncdec('encrypt', b + orgURL);
      hine += vine.split(orgURL).join(norgURL) + '\n';
    } else if (!lower.includes('URI="') && lower.includes('.ts')) {
      const iBaseURL = vine[0] === '/' ? getRootBase(effective_url) : getRelativeBase(effective_url);
      let b = iBaseURL;
      if (vine.includes('http://') || vine.includes('https://')) b = '';
      hine += 'live' + TS_EXT + '?segment=' + exEncdec('encrypt', b + vine) + '\n';
    } else if ((!lower.includes('URI="') && lower.includes('.m3u8')) || lower.includes('/hls')) {
      const iBaseURL = vine[0] === '/' ? getRootBase(effective_url) : getRelativeBase(effective_url);
      let b = iBaseURL;
      if (vine.includes('http://') || vine.includes('https://')) b = '';
      hine += 'live' + M3U_EXT + '?chunks=' + exEncdec('encrypt', b + vine) + '\n';
    } else {
      hine += vine + '\n';
    }
  }
  return hine.trim();
}

async function streamToClient(url, res) {
  try {
    const upstream = await fetch(url, { headers: STREAM_HEADERS, redirect: 'follow' });
    if (!upstream.ok || !upstream.body) { res.status(502).end(); return; }
    res.setHeader('Content-Type', 'video/m2ts');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.status(upstream.status);
    const node = Readable.fromWeb(upstream.body);
    node.on('error', () => res.destroy());
    node.pipe(res);
  } catch {
    res.status(502).end();
  }
}

async function handleLive(req, res) {
  const id = (req.query.id || '').trim();
  const chunks = (req.query.chunks || '').trim();
  const segment = (req.query.segment || '').trim();

  // PHP: .php? wale path pe extensions .php hote hain
  const isPhp = String(req.path || req.originalUrl || '').includes('.php');
  const M3U_EXT = isPhp ? '.php' : '.m3u8';
  const KEY_EXT = isPhp ? '.php' : '.key';
  const TS_EXT = isPhp ? '.php' : '.ts';

  const mac = await appMacportaldetail('get');
  if (!mac.server_url) { res.status(403).end(); return; }

  if (id) {
    const ctv_detail = await getChannelDetail(id);
    if (!ctv_detail || !ctv_detail.id) { res.status(404).end(); return; }
    const streamURL = await macGetPlaybackLink(ctv_detail.id);
    if (!streamURL) { res.status(503).end(); return; }

    if ((await appStreamproxy('get')) === 'OFF') {
      res.redirect(302, streamURL);
      return;
    }

    const fetch = await getRequest(streamURL, STREAM_HEADERS);
    const ret = fetch.data;
    if (ret.toLowerCase().includes('#EXTM3U')) {
      const rewritten = rewriteManifest(ret, fetch.url, M3U_EXT, KEY_EXT, TS_EXT);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(rewritten);
      return;
    }
    res.status(502).end();
    return;
  }

  if (chunks) {
    const streamURL = exEncdec('decrypt', chunks);
    if (!isValidUrl(streamURL)) { res.status(400).end(); return; }
    const fetch = await getRequest(streamURL, STREAM_HEADERS);
    const ret = fetch.data;
    if (ret.toLowerCase().includes('#EXTM3U')) {
      const rewritten = rewriteManifest(ret, fetch.url, M3U_EXT, KEY_EXT, TS_EXT);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(rewritten);
      return;
    }
    res.status(404).end();
    return;
  }

  if (segment) {
    const streamURL = exEncdec('decrypt', segment);
    if (!isValidUrl(streamURL)) { res.status(400).end(); return; }
    await streamToClient(streamURL, res);
    return;
  }

  res.status(400).end();
}

module.exports = { handleLive };
