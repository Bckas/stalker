const crypto = require('crypto');
const store = require('./store');
const { STREAM_ENC_KEY } = require('./config');

const STALKER_UA =
  'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';

// --- Request context (PHP $_SERVER superglobals ka replacement) ---
let currentReq = null;
function setRequestContext(req) { currentReq = req; }
function getReqInfo() {
  if (!currentReq) return { ip: 'unknown', ua: 'unknown' };
  const fwd = (currentReq.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return { ip: fwd || currentReq.ip || 'unknown', ua: currentReq.headers['user-agent'] || 'unknown' };
}

// PHP response() helper — hamesha HTTP 200, status body me (frontend yahi expect karta hai)
function response(res, status, code, message, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ status, code, message, data });
}

function generateRandomAlphanumericString(length) {
  const chars = '0123456789abcdefghijkmnpqrstuvwxyzABCDEFGHIJKLMNPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function isValidAdminPIN(pin) { return /^[0-9]{4}$/.test(String(pin)); }
function cleanString(s) { return String(s).replace(/ /g, '_'); }

function getRootBase(url) {
  try { return new URL(url).origin; } catch { return ''; }
}

function getRelativeBase(url) {
  let clean = String(url);
  const qi = clean.indexOf('?');
  if (qi !== -1) clean = clean.substring(0, qi);
  const li = clean.lastIndexOf('/');
  return li === -1 ? '' : clean.substring(0, li + 1);
}

function extractURIPart(vine) {
  const h1 = vine.split('URI="');
  if (h1.length >= 2) {
    const h2 = h1[1].split('"');
    if (h2[0] && h2[0].trim() !== '') return h2[0].trim();
  }
  return '';
}

// PHP ex_encdec (double base64 + XOR). Encrypt me URL-safe base64 (+/ -> -_) 
// taaki query string me + / problem na ho.
function exEncdec(action, data) {
  let input = data;
  if (action === 'decrypt') {
    input = data.replace(/-/g, '+').replace(/_/g, '/');
    input = Buffer.from(input, 'base64').toString('latin1'); // outer decode
    input = Buffer.from(input, 'base64').toString('latin1'); // inner decode
  }
  let out = '';
  for (let i = 0; i < input.length; i++) {
    out += String.fromCharCode(input.charCodeAt(i) ^ STREAM_ENC_KEY.charCodeAt(i % STREAM_ENC_KEY.length));
  }
  if (action === 'encrypt') {
    const b1 = Buffer.from(out, 'latin1').toString('base64');
    const b2 = Buffer.from(b1, 'utf8').toString('base64').replace(/=+$/g, '');
    out = b2.replace(/\+/g, '-').replace(/\//g, '_');
  }
  return out;
}

// PHP getRequest — curl (10s timeout, follow redirects) ka fetch version
async function getRequest(url, headers) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { headers, redirect: 'follow', signal: controller.signal });
    const data = await res.text();
    return { url: res.url, code: res.status, data };
  } catch {
    return { url: '', code: 0, data: '' };
  } finally {
    clearTimeout(t);
  }
}

function formatLogDate() {
  const d = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const pad = (n) => String(n).padStart(2, '0');
  return `${months[d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} ${pad(h)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
}

// PHP app_recordalogs
async function appRecordalogs(status, message) {
  try {
    const { appLogging } = require('./settings'); // lazy require (cycle avoid)
    if ((await appLogging('get')) === 'OFF') return true;
    const { ip, ua } = getReqInfo();
    await store.append('axLogs', `${formatLogDate()} || ${message} || ${ip} - ${ua}`);
    return true;
  } catch {
    return false;
  }
}

const md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex');

module.exports = {
  STALKER_UA, setRequestContext, getReqInfo, response,
  generateRandomAlphanumericString, isValidAdminPIN, cleanString,
  getRootBase, getRelativeBase, extractURIPart, exEncdec,
  getRequest, formatLogDate, appRecordalogs, md5,
};
