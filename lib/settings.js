const store = require('./store');
const { APP_CONFIG } = require('./config');
const { isValidAdminPIN } = require('./utils');

// app_accesspin — axPIN.enc, default "1234"
async function appAccesspin(action, data) {
  if (action === 'update') {
    if (isValidAdminPIN(data)) {
      await store.set('axPIN', String(data));
      return true;
    }
    return false;
  }
  const kdata = await store.get('axPIN');
  if (kdata) return kdata;
  if (APP_CONFIG.DEFAULT_ADMIN_PIN && isValidAdminPIN(APP_CONFIG.DEFAULT_ADMIN_PIN)) {
    return APP_CONFIG.DEFAULT_ADMIN_PIN;
  }
  return '';
}

// app_macportaldetail — axMAC.enc
async function appMacportaldetail(action, fields = {}) {
  if (action === 'update') {
    await store.set('axMAC', JSON.stringify({
      server_url: fields.url || '',
      mac_id: fields.mac_id || '',
      serial: fields.serial || '',
      device_id1: fields.device_id1 || '',
      device_id2: fields.device_id2 || '',
      signature: fields.signature || '',
    }));
    // Auto-create default auxiliary settings
    if (!(await store.get('axSTMPXY'))) await store.set('axSTMPXY', 'OFF');
    if (!(await store.get('axLOGSTS'))) await store.set('axLOGSTS', 'OFF');
    if (!(await store.get('axPBKCH'))) await store.set('axPBKCH', 'OFF');
    if (!(await store.get('axPBKEXP'))) await store.set('axPBKEXP', '14400');
    if (!(await store.get('axADMBTN'))) await store.set('axADMBTN', 'ON');
    return true;
  }
  const raw = await store.get('axMAC');
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (j && j.server_url) return j;
    } catch {}
  }
  return {};
}

async function appStreamproxy(action) {
  let output = APP_CONFIG.DEFAULT_STREAM_PROXY_STATUS === 'ON' ? 'ON' : 'OFF';
  const v = await store.get('axSTMPXY');
  if (v === 'ON' || v === 'OFF') output = v;
  if (action === 'toggle') {
    await store.set('axSTMPXY', output === 'ON' ? 'OFF' : 'ON');
    return true;
  }
  return output;
}

async function appGenreFilter(action, data = []) {
  let output = [];
  const raw = await store.get('axGenFil');
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) output = j;
    } catch {}
  }
  if (action === 'update') {
    await store.set('axGenFil', JSON.stringify(Array.isArray(data) ? data : []));
    return true;
  }
  return output;
}

async function appAdminButton(action) {
  let output = 'ON';
  const v = await store.get('axADMBTN');
  if (v === 'ON' || v === 'OFF') output = v;
  if (action === 'toggle') {
    await store.set('axADMBTN', output === 'ON' ? 'OFF' : 'ON');
    return true;
  }
  return output;
}

async function appLogging(action) {
  let output = 'OFF';
  const v = await store.get('axLOGSTS');
  if (v === 'ON' || v === 'OFF') output = v;
  if (action === 'toggle') {
    await store.set('axLOGSTS', output === 'ON' ? 'OFF' : 'ON');
    return true;
  }
  return output;
}

async function appPlaybackCache(action, val = '') {
  let status = 'OFF';
  const v = await store.get('axPBKCH');
  if (v === 'ON' || v === 'OFF') status = v;
  let expiry = 14400;
  const ev = await store.get('axPBKEXP');
  if (ev && parseInt(ev, 10) > 0) expiry = parseInt(ev, 10);
  if (action === 'toggle') {
    await store.set('axPBKCH', status === 'ON' ? 'OFF' : 'ON');
    return true;
  }
  if (action === 'update_expiry') {
    await store.set('axPBKEXP', String(parseInt(val, 10) > 0 ? parseInt(val, 10) : 14400));
    return true;
  }
  return { status, expiry };
}

async function appMacportalmeta() {
  const raw = await store.get('axMeta');
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (j && j.expiry) return j;
    } catch {}
  }
  return {};
}

module.exports = {
  appAccesspin, appMacportaldetail, appStreamproxy, appGenreFilter,
  appAdminButton, appLogging, appPlaybackCache, appMacportalmeta,
};
