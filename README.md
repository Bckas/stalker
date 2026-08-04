# 🔄 Stalker Portal to M3U Converter (Node.js + Vercel)

PHP → Node.js (Express) port, Vercel-ready. Features 100% same:
portal auth (MAC/Serial/Device IDs), channel grid, web player (Plyr + hls.js),
admin panel (PIN login, genre filter, stream proxy, playback cache, logs),
M3U/M3U8 playlist generation, HLS streaming proxy.

## ⚠️ Storage ka dhyan rakhna (sabse important!)
Vercel ka filesystem read-only hota hai, isliye PHP ke `__AppData__/` files ka
data ab **Vercel KV (Upstash Redis)** me store hota hai. KV nahi lagaya to data
in-memory rahega (har request/instance ke baad reset) — sirf local dev ke liye ok.

## 🚀 Deploy (Vercel)
1. Project ko GitHub push karo.
2. vercel.com → **Add New Project** → repo import karo.
3. **Storage → Create → KV** (naam: e.g. `stalker-kv`) → **Connect** to project.
4. Project Settings → Environment Variables me add karo:
   - `SESSION_SECRET` = koi bhi lamba random string (zaroori!)
   - `STREAM_ENC_KEY` = koi bhi random string
   - `ADMIN_PIN` = default `1234` (production me change karna!)
5. Deploy karo. Ho gaya! 🎉

Local test: `npm install` → `npm run dev` → http://localhost:3000

## 🔗 URLs
| Old (PHP)        | New (Node)          |
|------------------|---------------------|
| /index.php       | /                   |
| /admin.php       | /admin              |
| /login.php       | /login              |
| /player.php?id=1 | /player?id=1        |
| /live.php?id=1   | /live?id=1          |
| /playlist.php    | /playlist.m3u       |
| /api.php         | /api                |

## ⚠️ Notes
- Default admin PIN: `1234` — production me change karo!
- Vercel Hobby plan function max duration = 60s (`vercel.json` me set hai).
  Bade portals par channels fetch me time lagta hai to Pro plan better hai.
- Agar deploy ke baad routes 404 dein, to `vercel.json` me catch-all
  rewrite `/(.*) → /api` present hai iska confirm kar lena.
- Stream proxy ON hone par TS segments Vercel se stream hote hain
  (Node runtime streaming support karta hai).
