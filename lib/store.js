const { Redis } = require('@upstash/redis');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

let redis = null;
if (KV_URL && KV_TOKEN) {
  redis = new Redis({ url: KV_URL, token: KV_TOKEN });
}

// In-memory fallback (local dev / no KV configured)
const mem = new Map();

const PREFIX = 'stalker2m3u';
const key = (k) => `${PREFIX}:${k}`;

// PHP me jitne .enc files the, wahi keys (axPIN, axCTV, axLogs ...)
const ALL_KEYS = [
  'axMAC', 'axPIN', 'axMeta', 'axToken', 'axCTV', 'axGenres', 'axGenFil',
  'axSTMPXY', 'axLOGSTS', 'axADMBTN', 'axPBKCH', 'axPBKEXP', 'axPBKDATA', 'axLogs',
];

const store = {
  isPersistent: !!redis,

  async get(k) {
    if (redis) return redis.get(key(k));
    const v = mem.get(key(k));
    return v === undefined ? null : v;
  },

  async set(k, v) {
    if (redis) return redis.set(key(k), v);
    mem.set(key(k), v);
    return true;
  },

  async del(k) {
    if (redis) return redis.del(key(k));
    return mem.delete(key(k));
  },

  // Append-only log (axLogs.enc) — Redis LIST, last 500 lines rakhne ke liye trim
  async append(k, v) {
    if (redis) {
      await redis.rpush(key(k), v);
      await redis.ltrim(key(k), -500, -1);
      return true;
    }
    if (!mem.has(key(k))) mem.set(key(k), []);
    mem.get(key(k)).push(v);
    return true;
  },

  async readLog(k) {
    if (redis) {
      const arr = await redis.lrange(key(k), 0, -1);
      return Array.isArray(arr) ? arr.join('\n') : '';
    }
    const arr = mem.get(key(k)) || [];
    return arr.join('\n');
  },

  // delete_mac_portal jaisa behavior: sab delete, sirf PIN + Admin button bachao
  async deleteAllExcept(except) {
    for (const name of ALL_KEYS) {
      if (!except.includes(name)) await store.del(name);
    }
  },
};

module.exports = store;
