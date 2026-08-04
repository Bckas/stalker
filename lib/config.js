const APP_CONFIG = {
  APP_NAME: process.env.APP_NAME || 'Stalker Portal',
  DEFAULT_STREAM_PROXY_STATUS: process.env.DEFAULT_STREAM_PROXY_STATUS || 'OFF',
  DEFAULT_ADMIN_PIN: process.env.ADMIN_PIN || '1234',
};

const STREAM_ENC_KEY =
  process.env.STREAM_ENC_KEY ||
  'tuj2sDq6w0CqGstzTmHEi1a0q40SpMWSyGpP51cdXi5CnLwNJ7tZmSe2zxgYFXjKifJYHuEdwPmUTI0yaH0G8A2bRZpUZYGZ';

const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-stalker2m3u-secret';

module.exports = { APP_CONFIG, STREAM_ENC_KEY, SESSION_SECRET };
