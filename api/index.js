const path = require('path');
const express = require('express');

const { APP_CONFIG } = require('../lib/config');
const store = require('../lib/store');
const {
  response, cleanString, isValidAdminPIN, setRequestContext, appRecordalogs, md5,
} = require('../lib/utils');
const {
  appAccesspin, appMacportaldetail, appStreamproxy, appGenreFilter,
  appAdminButton, appLogging, appPlaybackCache, appMacportalmeta,
} = require('../lib/settings');
const {
  macServerurl, macGetGenres, macGetallChannels, macGetProfile, macForceUpdateChannels,
  getChannels, getChannelDetail, macFetchChannelsFromPortal, readCachedGenres, fixlogoissue,
} = require('../lib/stalker');
const { isAuthed, sessionCookie, clearCookie, createSessionToken, getCookie, verifySessionToken, COOKIE_NAME } = require('../lib/auth');
const { buildFlatM3U, buildApiCategorizedM3U, buildCategorizedM3U } = require('../lib/m3u');
const { handleLive } = require('../lib/live');

const app = express();
app.set('trust proxy', true);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req, res, next) => { setRequestContext(req); next(); });

async function handleApi(req, res) {
  const b = req.body || {};
  const q = req.query || {};
  const get = (k) => (b[k] !== undefined && b[k] !== null ? b[k] : q[k]);
  const action = String(get('action') || '').trim();

  const publicActions = [
    'getChannels', 'get_iptvplaylist', 'get_iptvplaylist_categorized',
    'get_genres', 'get_categories', 'login', 'logout', 'getPlaybackDetails',
  ];
  if (!publicActions.includes(action) && !isAuthed(req)) {
    response(res, 'error', 401, 'Unauthorized Access. Please login.', '');
    return;
  }

  try {
    switch (action) {
      case 'getChannels': {
        if (!(await macServerurl())) { response(res, 'error', 503, 'Application is not Configured', ''); break; }
        const tv_list = await getChannels();
        const genres = await macGetGenres();
        const genre_filter = await appGenreFilter('get');
        const live = [];
        for (const etv of tv_list) {
          let category_title = 'Uncategorized';
          let genre_id = '0';
          if (etv.tv_genre_id !== undefined && etv.tv_genre_id !== '' && etv.tv_genre_id !== '0') {
            genre_id = String(etv.tv_genre_id);
            if (genres[genre_id]) category_title = genres[genre_id];
          }
          if (genre_filter && genre_filter.length && !genre_filter.includes(genre_id)) continue;
          live.push({
            id: etv.id,
            title: etv.title,
            logo: await fixlogoissue(etv.logo),
            category_title,
            tv_genre_id: genre_id,
          });
        }
        response(res, 'success', 200, `${live.length} TV Channels Found`, { count: live.length, list: live });
        break;
      }

      case 'getPlaybackDetails': {
        if (!(await macServerurl())) { response(res, 'error', 503, 'Application is not Configured', ''); break; }
        res.end();
        break;
      }

      case 'get_iptvplaylist': {
        const data = await buildFlatM3U(req);
        if (data === null) { res.status(503).end(); break; }
        const file = `${cleanString(APP_CONFIG.APP_NAME)}_${Math.floor(Date.now() / 1000)}_${cleanString(APP_CONFIG.APP_NAME)}.m3u`;
        res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(data);
        break;
      }

      case 'get_iptvplaylist_categorized': {
        const data = await buildApiCategorizedM3U(req);
        if (data === null) { res.status(503).end(); break; }
        const file = `${cleanString(APP_CONFIG.APP_NAME)}_categorized_${Math.floor(Date.now() / 1000)}.m3u`;
        res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(data);
        break;
      }

      case 'get_genres': {
        if (!(await macServerurl())) { response(res, 'error', 503, 'Application is not Configured', ''); break; }
        const genres = await macGetGenres();
        response(res, 'success', 200, `${Object.keys(genres).length} Genres Found`, {
          count: Object.keys(genres).length,
          list: genres,
        });
        break;
      }

      case 'get_categories': {
        if (!(await macServerurl())) { response(res, 'error', 503, 'Application is not Configured', ''); break; }
        const genres = await macGetGenres();
        const categories = Object.keys(genres).map((id) => ({ id, title: genres[id] }));
        response(res, 'success', 200, `${categories.length} Categories Found`, {
          count: categories.length,
          list: categories,
        });
        break;
      }

      case 'force_update_channels': {
        if (!(await macServerurl())) { response(res, 'error', 503, 'Stalker Portal details are not configured', ''); break; }
        const channels = await macForceUpdateChannels();
        if (channels && channels.length) {
          response(res, 'success', 200, `Channels updated successfully. Total: ${channels.length}`, '');
        } else {
          response(res, 'error', 403, 'Failed to update channels. Check error logs.', '');
        }
        break;
      }

      case 'login': {
        if (req.method !== 'POST') { response(res, 'error', 405, 'Method Not Supported', ''); break; }
        const pin = String(get('pin') || '').trim();
        if (!pin) { response(res, 'error', 400, 'Please Enter Access PIN To Login', ''); break; }
        const irlPIN = await appAccesspin('get', '');
        if (md5(pin) === md5(irlPIN)) {
          const token = createSessionToken();
          res.setHeader('Set-Cookie', sessionCookie(token));
          response(res, 'success', 200, 'Logged In Successfully', token);
        } else {
          response(res, 'error', 403, 'Invalid Credentials', '');
        }
        break;
      }

      case 'logout': {
        res.setHeader('Set-Cookie', clearCookie());
        response(res, 'success', 200, 'Logged Out Successfully', '');
        break;
      }

      case 'dashboard_data': {
        let expirydm = '-';
        const metaData = await appMacportalmeta('get');
        if (metaData.expiry) {
          const d = new Date(metaData.expiry);
          if (!isNaN(d)) {
            expirydm = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          }
        }
        let channelsCount = 0;
        const raw = await store.get('axCTV');
        if (raw) {
          try {
            const j = JSON.parse(raw);
            if (Array.isArray(j)) channelsCount = j.length;
          } catch {}
        }
        const xdetail = {
          stalker_base: await appMacportaldetail('get'),
          stalker_data: { channels_count: channelsCount, expiry: expirydm },
          settings: {
            stream_proxy: await appStreamproxy('get'),
            admin_button: await appAdminButton('get'),
            logging_status: await appLogging('get'),
            playback_cache: await appPlaybackCache('get'),
            genre_filter: await appGenreFilter('get'),
          },
        };
        response(res, 'success', 200, 'Dashboard Data', xdetail);
        break;
      }

      case 'toggle_playback_cache': {
        if (await appPlaybackCache('toggle')) {
          await appRecordalogs('SUCCESS', 'Playback Cache Status Toggled');
          response(res, 'success', 200, 'Playback Cache Status Updated', '');
        } else {
          response(res, 'error', 500, 'Failed to update Playback Cache Status', '');
        }
        break;
      }

      case 'update_playback_expiry': {
        let expiry = 14400;
        if (b.expiry !== undefined && b.expiry !== null) expiry = parseInt(b.expiry, 10) || 14400;
        if (await appPlaybackCache('update_expiry', expiry)) {
          await appRecordalogs('SUCCESS', `Playback Cache Expiry Updated to ${expiry}s`);
          response(res, 'success', 200, 'Playback Cache Expiry Saved', '');
        } else {
          response(res, 'error', 500, 'Failed to save Playback Cache Expiry', '');
        }
        break;
      }

      case 'save_genre_filter': {
        let filter = [];
        if (b.filter !== undefined && Array.isArray(b.filter)) filter = b.filter;
        else if (b.filter !== undefined && typeof b.filter === 'string') filter = [b.filter];
        if (await appGenreFilter('update', filter)) {
          response(res, 'success', 200, 'Genre Filter Saved Successfully', '');
        } else {
          response(res, 'error', 500, 'Failed to save Genre Filter', '');
        }
        break;
      }

      case 'change_access_pin': {
        let pin = '';
        if (b.pin !== undefined) pin = String(b.pin).trim();
        if (!pin) { response(res, 'error', 400, 'Please enter new Access PIN to Change', ''); break; }
        if (!isValidAdminPIN(pin)) { response(res, 'error', 400, 'Access PIN should be 4 numbers long', ''); break; }
        if (await appAccesspin('update', pin)) {
          response(res, 'success', 200, 'Access PIN Changed. Login Again.', '');
        } else {
          response(res, 'error', 500, 'Failed to change Access PIN', '');
        }
        break;
      }

      case 'save_mac_portal': {
        if (req.method !== 'POST') { response(res, 'error', 405, 'Method Not Supported', ''); break; }
        const server_url = String(b.server_url || '').trim();
        const mac_id = String(b.mac_id || '').trim();
        const serial = String(b.serial || '').trim();
        const device_id1 = String(b.device_id1 || '').trim();
        const device_id2 = String(b.device_id2 || '').trim();
        const signature = String(b.signature || '').trim();
        if (!server_url) { response(res, 'error', 400, 'Please enter MAC Server URL', ''); break; }
        if (!mac_id) { response(res, 'error', 400, 'Please enter MAC ID', ''); break; }
        if (!server_url.endsWith('/c/')) { response(res, 'error', 400, 'MAC Server URL should end with /c/', ''); break; }
        if (await appMacportaldetail('update', { url: server_url, mac_id, serial, device_id1, device_id2, signature })) {
          await appRecordalogs('SUCCESS', 'Stalker Portal Data Saved/Updated');
          response(res, 'success', 200, 'Saved Successfully', '');
        } else {
          await appRecordalogs('SUCCESS', 'Failed To Save Stalker Portal Data');
          response(res, 'error', 500, 'Failed To Save', '');
        }
        break;
      }

      case 'update_mac_data': {
        if (!(await macServerurl())) { response(res, 'error', 503, 'Stalker Portal details are not configured', ''); break; }
        const profile = await macGetProfile();
        if (!profile || !profile.name) { response(res, 'error', 403, 'Failed To Fetch Profile Details. Check Error Logs', ''); break; }
        let channels = await macGetallChannels();
        if (!channels || !channels.length) channels = await macGetallChannels();
        if (!channels || !channels.length) { response(res, 'error', 403, 'Failed To Fetch Channels List. Check Error Logs', ''); break; }
        await appRecordalogs('SUCCESS', 'Stalker Portal Meta-Info Saved/Updated');
        response(res, 'success', 200, 'Stalker Portal Details Updated Successfully', '');
        break;
      }

      case 'delete_mac_portal': {
        await store.deleteAllExcept(['axPIN', 'axADMBTN']);
        response(res, 'success', 200, 'Stalker Portal Deleted Successfully', '');
        break;
      }

      case 'toggle_stream_proxy': {
        if (!(await appStreamproxy('toggle'))) { response(res, 'error', 500, 'Failed To Toggle Stream Proxy Status', ''); break; }
        response(res, 'success', 200, `Stream Proxy Status Changed To ${await appStreamproxy('get')}`, '');
        break;
      }

      case 'toggle_logging': {
        if (!(await appLogging('toggle'))) { response(res, 'error', 500, 'Failed To Toggle Logging Status', ''); break; }
        response(res, 'success', 200, `Logging Status Changed To ${await appLogging('get')}`, '');
        break;
      }

      case 'clear_logs': {
        if (await store.get('axLogs')) {
          await store.del('axLogs');
          response(res, 'success', 200, 'Logs Cleared Successfully', '');
        } else {
          response(res, 'success', 200, 'Logs Already Empty', '');
        }
        break;
      }

      case 'toggle_admin_button': {
        if (!(await appAdminButton('toggle'))) { response(res, 'error', 500, 'Failed To Toggle Admin Button Visibility', ''); break; }
        response(res, 'success', 200, `Admin Button Visibility Changed To ${await appAdminButton('get')}`, '');
        break;
      }

      default:
        response(res, 'error', 400, 'Requested Module Does Not Exist', '');
    }
  } catch (e) {
    console.error('[api]', e);
    if (e && (e.status || e.code)) { res.status(e.status || e.code).end(); return; }
    response(res, 'error', 500, 'Internal Server Error', '');
  }
}

// ================================================================
// Pages
// ================================================================

app.get('/', async (req, res) => {
  try {
    const mac = await appMacportaldetail('get');
    if (!mac.server_url) { res.redirect('/admin'); return; }
    const channels = await macGetallChannels();
    if (!channels || !channels.length) { res.redirect('/admin'); return; }
    const allGenres = await readCachedGenres();
    const genre_filter = await appGenreFilter('get');
    let genres = allGenres;
    if (genre_filter && genre_filter.length) {
      const filtered = {};
      for (const gid in allGenres) {
        if (genre_filter.includes(gid)) filtered[gid] = allGenres[gid];
      }
      genres = filtered;
    }
    await appRecordalogs('VISIT', 'Homepage loaded - Channel list displayed');
    res.render('index', {
      appName: APP_CONFIG.APP_NAME,
      genres,
      adminButton: await appAdminButton('get'),
    });
  } catch (e) {
    res.redirect('/admin');
  }
});

// GET /login — login page
app.get('/login', (req, res) => {
  if (isAuthed(req)) { res.redirect('/admin'); return; }
  res.render('login', { appName: APP_CONFIG.APP_NAME });
});

// POST /login — native form login (JS/CDN fail hone par bhi kaam karega)
app.post('/login', async (req, res) => {
  const b = req.body || {};
  const pin = String(b.pin || '').trim();
  const irlPIN = await appAccesspin('get', '');
  if (pin && md5(pin) === md5(irlPIN)) {
    res.setHeader('Set-Cookie', sessionCookie(createSessionToken()));
    res.redirect('/admin');
  } else {
    res.render('login', { appName: APP_CONFIG.APP_NAME, error: 'Invalid Access PIN. Please try again.' });
  }
});

// GET /admin — cookie YA query-token dono se khulega
app.get('/admin', (req, res) => {
  const token = getCookie(req, COOKIE_NAME) || (typeof req.query.token === 'string' ? req.query.token : '');
  if (verifySessionToken(token)) {
    if (req.query.token && !getCookie(req, COOKIE_NAME)) {
      res.setHeader('Set-Cookie', sessionCookie(token));
    }
    res.render('admin', { appName: APP_CONFIG.APP_NAME });
  } else {
    res.redirect('/login');
  }
});

app.get('/admin/logs', async (req, res) => {
  const token = getCookie(req, COOKIE_NAME) || (typeof req.query.token === 'string' ? req.query.token : '');
  if (!verifySessionToken(token)) { res.redirect('/login'); return; }
  const logs = await store.readLog('axLogs');
  res.render('logs', { appName: APP_CONFIG.APP_NAME, logs });
});

app.get('/player', async (req, res) => {
  try {
    const id = String(req.query.id || '').trim();
    if (!id) { res.redirect('/'); return; }
    const clive = await getChannelDetail(id);
    if (!clive || !clive.id) { res.redirect('/'); return; }
    await appRecordalogs('PLAYBACK', `User started playing: ${clive.title} (ID: ${clive.id})`);
    res.render('player', {
      appName: APP_CONFIG.APP_NAME,
      title: clive.title,
      playbackUrl: `/live?id=${clive.id}`,
    });
  } catch (e) {
    res.redirect('/');
  }
});

app.all(['/live', '/live.php', '/live.m3u8', '/live.ts', '/live.key'], handleLive);

app.get(['/playlist.m3u', '/playlist', '/playlist.php'], async (req, res) => {
  try {
    const data = await buildCategorizedM3U(req);
    if (data === null) { res.status(503).send('No channels found.'); return; }
    const mac = await appMacportaldetail('get');
    const server_url = (mac && mac.server_url) || '';
    let host = cleanString(APP_CONFIG.APP_NAME);
    if (server_url) {
      try { host = new URL(server_url).hostname; } catch {}
    }
    const file = `${host}.m3u`;
    if (req.query.view === 'browser') {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `inline; filename="${file}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    }
    res.send(data);
  } catch (e) {
    res.status(503).send('No channels found.');
  }
});

app.all(['/api', '/api.php'], handleApi);

app.get('/check_data', async (req, res) => {
  const channelsRaw = await store.get('axCTV');
  const genresRaw = await store.get('axGenres');
  let channels = [];
  let genres = {};
  try { channels = JSON.parse(channelsRaw) || []; } catch {}
  try { genres = JSON.parse(genresRaw) || {}; } catch {}
  let sample = null;
  try {
    const adata = await macFetchChannelsFromPortal();
    if (adata && adata.js && adata.js.data && adata.js.data.length) sample = adata.js.data[0];
    else sample = adata;
  } catch {}
  res.render('check_data', {
    channels,
    genres,
    sample,
    serverUrl: await macServerurl(),
  });
});

// Debug helper
app.get('/debug', async (req, res) => {
  res.json({
    storage: store.isPersistent ? 'vercel-kv' : 'in-memory',
    session_secret_set: !!process.env.SESSION_SECRET,
    cookie_header: req.headers.cookie || '(none)',
    authed_by_cookie: isAuthed(req),
  });
});

// Legacy .php redirects
app.get('/index.php', (req, res) => res.redirect('/'));
app.get('/admin.php', (req, res) => res.redirect('/admin'));
app.get('/login.php', (req, res) => res.redirect('/login'));
app.get('/player.php', (req, res) => res.redirect('/player?' + new URLSearchParams(req.query).toString()));
app.get('/playlist.php', (req, res) => res.redirect('/playlist.m3u' + (req.query.view === 'browser' ? '?view=browser' : '')));

app.use((req, res) => {
  res.status(404).send('Not Found');
});

module.exports = app;
