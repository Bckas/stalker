const store = require('./store');
const { getRequest, appRecordalogs, STALKER_UA } = require('./utils');
const { appMacportaldetail, appPlaybackCache } = require('./settings');

async function macMacurl() {
  const d = await appMacportaldetail('get');
  return (d && d.server_url) || '';
}

async function macServerurl() {
  const d = await appMacportaldetail('get');
  return d && d.server_url ? d.server_url.replace('/c/', '/server/load.php') : '';
}

async function macMacid() { const d = await appMacportaldetail('get'); return (d && d.mac_id) || ''; }
async function macSerial() { const d = await appMacportaldetail('get'); return (d && d.serial) || ''; }
async function macDevice1() { const d = await appMacportaldetail('get'); return (d && d.device_id1) || ''; }
async function macDevice2() { const d = await appMacportaldetail('get'); return (d && d.device_id2) || ''; }
async function macSignature() { const d = await appMacportaldetail('get'); return (d && d.signature) || ''; }

async function portalHeaders(token) {
  return {
    'User-Agent': STALKER_UA,
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
    'Referer': await macMacurl(),
    'Cookie': `mac=${await macMacid()}; stb_lang=en; timezone=GMT`,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

// mac_handshake — token 120s ke liye cache (axToken.enc)
async function macHandshake() {
  const raw = await store.get('axToken');
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (j && j.time && j.token && j.random && Math.floor(Date.now() / 1000) < j.time) {
        return { token: j.token, random: j.random };
      }
    } catch {}
  }
  const rqlink = `${await macServerurl()}?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
  const fetch = await getRequest(rqlink, await portalHeaders());
  let adata = null;
  try { adata = JSON.parse(fetch.data); } catch {}
  const token = adata && adata.js && adata.js.token ? adata.js.token : '';
  const random = adata && adata.js && adata.js.random ? adata.js.random : '';
  if (token) {
    await store.set('axToken', JSON.stringify({
      time: Math.floor(Date.now() / 1000) + 120,
      token,
      random,
    }));
    return { token, random };
  }
  await appRecordalogs('ERROR', `Stalker Portal Handshake Failed :: ${fetch.data} (Code ${fetch.code})`);
  return { token: '', random: '' };
}

// mac_getprofile
async function macGetProfile(retry = true) {
  let name = '', expiry = '', username = '', password = '';
  const hs = await macHandshake();
  const ver = encodeURIComponent(
    'ImageDescription: 0.2.18-r14-pub-250; ImageDate: Fri Jan 15 15:20:44 EET 2016; PORTAL version: 5.1.0; API Version: JS API version: 328; STB API version: 134; Player Engine version: 0x566'
  );
  const pfLoad = `type=stb&action=get_profile&hd=1&ver=${ver}&num_banks=2&sn=${await macSerial()}&stb_type=MAG250&image_version=218&video_out=hdmi&device_id=${await macDevice1()}&device_id2=${await macDevice2()}&signature=${await macSignature()}&auth_second_step=1&hw_version=1.7-BD-00&not_valid_token=0&client_type=STB&hw_version_2=36da041e6358ee8f8801105e36a63474&timestamp=${Math.floor(Date.now() / 1000)}&api_signature=263&metrics={"mac":"${await macMacid()}","sn":"${await macSerial()}","model":"MAG250","type":"STB","uid":"","random":"${hs.random}"}&JsHttpRequest=1-xml`;
  const fetch = await getRequest(`${await macServerurl()}?${pfLoad}`, await portalHeaders(hs.token));
  let adata = null;
  try { adata = JSON.parse(fetch.data); } catch {}
  if (adata && adata.js) {
    if (adata.js.fname) name = adata.js.fname;
    if (!name && adata.js.name) name = adata.js.name;
    if (adata.js.expirydate) expiry = adata.js.expirydate;
    if (!expiry && adata.js.expire_billing_date) expiry = adata.js.expire_billing_date;
    if (adata.js.login) username = adata.js.login;
    if (adata.js.password) password = adata.js.password;
  }
  if (name) {
    const output = { name, expiry, username, password };
    await store.set('axMeta', JSON.stringify(output));
    return output;
  }
  if (retry) {
    await new Promise((r) => setTimeout(r, 1000));
    return macGetProfile(false);
  }
  await appRecordalogs('ERROR', `Profile Meta-Info Fetch Failed :: ${fetch.data} (Code ${fetch.code})`);
  return {};
}

// mac_getGenres — axGenres.enc cache
async function macGetGenres() {
  const cached = await store.get('axGenres');
  if (cached) {
    try {
      const j = JSON.parse(cached);
      if (j && typeof j === 'object' && Object.keys(j).length) return j;
    } catch {}
  }
  const genres = {};
  const hs = await macHandshake();
  const apiURL = `${await macServerurl()}?type=itv&action=get_genres&JsHttpRequest=1-xml`;
  const fetch = await getRequest(apiURL, await portalHeaders(hs.token));
  let adata = null;
  try { adata = JSON.parse(fetch.data); } catch {}
  if (adata && Array.isArray(adata.js)) {
    for (const g of adata.js) {
      if (g.id !== undefined && g.title !== undefined) genres[String(g.id)] = g.title;
    }
    if (Object.keys(genres).length) {
      await store.set('axGenres', JSON.stringify(genres));
      await appRecordalogs('SUCCESS', `Genres fetched: ${Object.keys(genres).length}`);
    }
  }
  return genres;
}

async function readCachedGenres() {
  const cached = await store.get('axGenres');
  if (cached) {
    try {
      const j = JSON.parse(cached);
      if (j && typeof j === 'object') return j;
    } catch {}
  }
  return {};
}

// mac_fetchChannelsFromPortal
async function macFetchChannelsFromPortal() {
  const hs = await macHandshake();
  const apiURL = `${await macServerurl()}?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
  const fetch = await getRequest(apiURL, await portalHeaders(hs.token));
  try { return JSON.parse(fetch.data); } catch { return null; }
}

// mac_getallChannels — axCTV.enc cache
async function macGetallChannels(retry = true) {
  await macGetProfile();
  const cached = await store.get('axCTV');
  if (cached) {
    try {
      const j = JSON.parse(cached);
      if (Array.isArray(j) && j.length) return j;
    } catch {}
  }
  const adata = await macFetchChannelsFromPortal();
  const output = [];
  if (adata && adata.js && adata.js.data && adata.js.data.length) {
    for (const itv of adata.js.data) {
      let tv_genre_id = '0';
      if (itv.tv_genre_id !== undefined && itv.tv_genre_id !== '' && itv.tv_genre_id !== null) {
        tv_genre_id = String(itv.tv_genre_id);
      }
      output.push({
        id: itv.id,
        title: itv.name,
        logo: itv.logo !== undefined ? itv.logo : '',
        cmd: itv.cmd,
        tv_genre_id,
      });
    }
    await appRecordalogs('SUCCESS', `Channel List Updated: ${output.length} channels`);
    await store.set('axCTV', JSON.stringify(output));
    await macGetGenres();
  } else {
    if (retry) {
      await new Promise((r) => setTimeout(r, 1000));
      return macGetallChannels(false);
    }
    await appRecordalogs('ERROR', 'Channel List Fetch Failed - No data in response');
  }
  return output;
}

async function macForceUpdateChannels() {
  await store.del('axCTV');
  await store.del('axGenres');
  return macGetallChannels();
}

// getChannels (PHP ke static-cache version ka async replacement)
async function getChannels(indexed = false) {
  const mac = await appMacportaldetail('get');
  if (!mac.server_url) {
    const e = new Error('not configured');
    e.status = 403;
    throw e;
  }
  let list = await macGetallChannels();
  if (!list) list = [];
  if (!indexed) return list;
  const idx = {};
  for (const c of list) idx[String(c.id)] = c;
  return idx;
}

async function getChannelDetail(id) {
  try {
    const idx = await getChannels(true);
    return idx[String(id)] || {};
  } catch {
    return {};
  }
}

// fixlogoissue
async function fixlogoissue(logo) {
  const mac = await appMacportaldetail('get');
  const server_url = (mac && mac.server_url) || '';
  let host = '';
  if (server_url) {
    try {
      const u = new URL(server_url);
      host = u.hostname;
      if (u.port) host += ':' + u.port;
    } catch {}
  }
  const clean = String(logo).replace(/\.png|\.jpg/g, '');
  if (clean.trim() !== '' && !isNaN(clean)) {
    return `http://${host}/stalker_portal/misc/logos/320/${logo}`;
  }
  return 'https://i.ibb.co/VYjhYyK5/stalker-portal.png';
}

// sanitizemacurl
function sanitizemacurl(url) {
  url = url.replace('ffmpeg ', '');
  if (url.toLowerCase().includes('jiotv.be') && url.includes('.ts')) {
    url = url.split('.ts.ts').join('.m3u8');
    url = url.split('.ts').join('.m3u8');
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/');
      const port = u.port ? ':' + u.port : '';
      url = `${u.protocol}//${u.hostname}${port}/${parts[1]}/${parts[2]}/${parts[3]}/${parts[8]}?${u.search.slice(1)}`;
    } catch {}
  }
  return url;
}

// mac_getPlaybackLink — create_link + cache (axPBKDATA.enc)
async function macGetPlaybackLink(id) {
  const cache_settings = await appPlaybackCache('get');
  let cache_data = {};
  if (cache_settings.status === 'ON') {
    const raw = await store.get('axPBKDATA');
    if (raw) {
      try {
        const j = JSON.parse(raw);
        if (j) cache_data = j;
      } catch {}
    }
    const c = cache_data[id];
    if (c && c.url && c.expiry && Math.floor(Date.now() / 1000) < c.expiry) {
      return c.url;
    }
  }
  await macGetProfile();
  let output = false;
  const cdetail = await getChannelDetail(id);
  if (cdetail && cdetail.cmd) {
    const hs = await macHandshake();
    const mpbAPI = `${await macServerurl()}?type=itv&action=create_link&cmd=${encodeURIComponent(cdetail.cmd)}&JsHttpRequest=1-xml`;
    const fetch = await getRequest(mpbAPI, await portalHeaders(hs.token));
    let adata = null;
    try { adata = JSON.parse(fetch.data); } catch {}
    if (adata && adata.js && adata.js.cmd) {
      output = sanitizemacurl(adata.js.cmd);
      if (output !== false && cache_settings.status === 'ON') {
        const latestRaw = await store.get('axPBKDATA');
        let latest = {};
        if (latestRaw) {
          try {
            const j = JSON.parse(latestRaw);
            if (j) latest = j;
          } catch {}
        }
        latest[id] = { url: output, expiry: Math.floor(Date.now() / 1000) + cache_settings.expiry };
        await store.set('axPBKDATA', JSON.stringify(latest));
      }
    } else {
      await appRecordalogs('ERROR', 'Channel Playback-URL Fetch Failed');
    }
  }
  return output;
}

module.exports = {
  macMacurl, macServerurl, macMacid, macSerial, macDevice1, macDevice2, macSignature,
  macHandshake, macGetProfile, macGetGenres, readCachedGenres,
  macFetchChannelsFromPortal, macGetallChannels, macForceUpdateChannels,
  getChannels, getChannelDetail, fixlogoissue, sanitizemacurl, macGetPlaybackLink,
};
