const crypto = require('crypto');
const { SESSION_SECRET } = require('./config');

const COOKIE_NAME = 'app_auth';
const MAX_AGE = 7 * 24 * 3600; // 7 din

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function createSessionToken() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${exp}.${crypto.randomBytes(16).toString('hex')}`;
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const payload = parts.slice(0, 2).join('.');
  const sig = parts[2];
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  const exp = parseInt(parts[0], 10);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
  return true;
}

function getCookie(req, name) {
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.substring(0, i).trim() === name) {
      return decodeURIComponent(part.substring(i + 1).trim());
    }
  }
  return null;
}

const sessionCookie = (token) =>
  `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`;

const clearCookie = () => `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`;

const isAuthed = (req) => verifySessionToken(getCookie(req, COOKIE_NAME));

module.exports = { COOKIE_NAME, createSessionToken, verifySessionToken, getCookie, sessionCookie, clearCookie, isAuthed };
