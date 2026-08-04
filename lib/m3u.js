const { APP_CONFIG } = require('./config');
const { getChannels, macGetGenres, fixlogoissue } = require('./stalker');
const { appGenreFilter } = require('./settings');
const { cleanString } = require('./utils');

// PHP me $streamenvproto://$plhoth$basepath
function buildBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost').replace(/\s/g, '%20');
  let basePath = '/';
  const p = req.path || '/';
  const idx = p.lastIndexOf('/');
  if (idx > 0) basePath = p.substring(0, idx + 1);
  return `${proto}://${host}${basePath}`;
}

async function groupChannelsByCategory(livetv, genres, genre_filter) {
  const map = {};
  for (const itv of livetv) {
    let cat = 'Uncategorized';
    let genre_id = '0';
    if (itv.tv_genre_id !== undefined && itv.tv_genre_id !== '' && itv.tv_genre_id !== '0') {
      genre_id = String(itv.tv_genre_id);
      if (genres[genre_id]) cat = genres[genre_id];
    }
    if (genre_filter && genre_filter.length && !genre_filter.includes(genre_id)) continue;
    if (!map[cat]) map[cat] = [];
    map[cat].push(itv);
  }
  return map;
}

// api.php ?action=get_iptvplaylist  (flat M3U)
async function buildFlatM3U(req) {
  const livetv = await getChannels();
  if (!livetv || !livetv.length) return null;
  const genre_filter = await appGenreFilter('get');
  const base = buildBaseUrl(req);
  let out = '#EXTM3U\n';
  let e = 0;
  for (const itv of livetv) {
    if (genre_filter && genre_filter.length) {
      const genre_id = itv.tv_genre_id !== undefined ? String(itv.tv_genre_id) : '0';
      if (!genre_filter.includes(genre_id)) continue;
    }
    e++;
    const logo = await fixlogoissue(itv.logo);
    out += `#EXTINF:-1 tvg-id="${e}" tvg-name="${itv.title}" tvg-logo="${logo}" group-title="${APP_CONFIG.APP_NAME}",${itv.title}\n`;
    out += `${base}live?id=${itv.id}\n`;
  }
  return out.trim();
}

// api.php ?action=get_iptvplaylist_categorized
async function buildApiCategorizedM3U(req) {
  const livetv = await getChannels();
  if (!livetv || !livetv.length) return null;
  const genres = await macGetGenres();
  const genre_filter = await appGenreFilter('get');
  const base = buildBaseUrl(req);
  const grouped = await groupChannelsByCategory(livetv, genres, genre_filter);
  let out = '#EXTM3U\n';
  out += `#PLAYLIST: ${APP_CONFIG.APP_NAME}\n`;
  for (const catTitle of Object.keys(grouped)) {
    out += `\n#EXTGRP:${catTitle}\n`;
    for (const itv of grouped[catTitle]) {
      const tvg_id = String(itv.title).replace(/[^a-zA-Z0-9]/g, '');
      const logo = await fixlogoissue(itv.logo);
      const stream_url = `${base}live?id=${itv.id}`;
      out += `#EXTINF:-1 tvg-id="${tvg_id}" tvg-name="${itv.title}" tvg-logo="${logo}" group-title="${catTitle}",${itv.title}\n`;
      out += `${stream_url}\n`;
    }
  }
  return out.trim();
}

// playlist.php (playlist.m3u) — sorted categories + channels
async function buildCategorizedM3U(req) {
  const livetv = await getChannels();
  if (!livetv || !livetv.length) return null;
  const genres = await macGetGenres();
  const genre_filter = await appGenreFilter('get');
  const base = buildBaseUrl(req);
  const grouped = await groupChannelsByCategory(livetv, genres, genre_filter);
  let out = '#EXTM3U\n';
  out += `#PLAYLIST: ${APP_CONFIG.APP_NAME}\n\n`;
  for (const catTitle of Object.keys(grouped).sort()) {
    const channels = grouped[catTitle].slice().sort((a, b) =>
      String(a.title).localeCompare(String(b.title))
    );
    out += `\n#EXTGRP:${catTitle}\n`;
    for (const itv of channels) {
      let tvg_id = itv.id;
      if (String(itv.cmd || '').includes('localhost')) {
        tvg_id = String(itv.cmd).split('ffrt http://localhost/ch/').join('');
      }
      const logo = await fixlogoissue(itv.logo);
      const stream_url = `${base}live?id=${itv.id}`;
      out += `#EXTINF:-1 tvg-id="${tvg_id}" tvg-name="${itv.title}" tvg-logo="${logo}" group-title="${catTitle}",${itv.title}\n`;
      out += `${stream_url}\n`;
    }
  }
  return out.trim();
}

function playlistFileName(host) {
  return `${host || cleanString(APP_CONFIG.APP_NAME)}.m3u`;
}

module.exports = { buildBaseUrl, buildFlatM3U, buildApiCategorizedM3U, buildCategorizedM3U, playlistFileName };
