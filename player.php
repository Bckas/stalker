<?php
include("_inc.configs.php");

$id = "";
if(isset($_REQUEST['id'])) { 
    $id = trim($_REQUEST['id']); 
}

if(empty($id)) {
    app_recordalogs("ERROR", "Player accessed without channel ID");
    header("Location: index.php");
    exit();
}

$clive = getChannelDetail($id);
if(empty($clive)) { 
    app_recordalogs("ERROR", "Player accessed with invalid channel ID: ".$id);
    header("Location: index.php");
    exit();
}

app_recordalogs("PLAYBACK", "User started playing: ".$clive['title']." (ID: ".$clive['id'].")");
$playback_url = "live.php?id=".$clive['id'];
$copy_url = $streamenvproto."://".$plhoth.str_replace(" ", "%20", str_replace(basename($_SERVER['PHP_SELF']), '', $_SERVER['PHP_SELF']))."live.m3u8?id=".$clive['id'];    
?>
<!-- Source Code By <?php print($APP_CONFIG['WHITELABEL_APP_DEVS']); ?> -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title><?php print($clive['title']); ?> Online | <?php print($APP_CONFIG['APP_NAME']); ?></title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/plyr@3.6.2/dist/plyr.css" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/plyr@3.6.12/dist/plyr.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1.1.4/dist/hls.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { 
            font-family: 'Inter', sans-serif; 
            background: #0f172a; 
            height: 100vh; 
            height: -webkit-fill-available;
            overflow: hidden;
            position: fixed;
            width: 100%;
        }
        html { 
            height: -webkit-fill-available; 
            overflow: hidden;
        }
        
        .loading { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background: #0f172a; 
            display: flex; 
            flex-direction: column;
            justify-content: center; 
            align-items: center; 
            gap: 24px;
            z-index: 9999; 
        }
        .google-dots {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        .dot {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            animation: bounce 0.5s alternate infinite ease-in-out;
        }
        .dot.blue { background-color: #4285F4; animation-delay: 0s; }
        .dot.red { background-color: #EA4335; animation-delay: 0.15s; }
        .dot.yellow { background-color: #FBBC05; animation-delay: 0.3s; }
        .dot.green { background-color: #34A853; animation-delay: 0.45s; }
        .loading-text-brand {
            color: #f8fafc;
            font-size: 1.25rem;
            font-weight: 600;
            letter-spacing: 4px;
            text-transform: uppercase;
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes bounce {
            0% { transform: translateY(0); }
            100% { transform: translateY(-20px); }
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        #player-container { 
            width: 100%; 
            height: 100vh; 
            height: -webkit-fill-available; 
            position: relative; 
            background: #000; 
        }
        .plyr { 
            height: 100vh; 
            height: -webkit-fill-available; 
        }
        .plyr__video-wrapper { 
            background: #000; 
        }
        
        /* Mobile specific width fix */
        @media (max-width: 768px) {
            #player-container, .plyr { 
                height: 100vh !important; 
                height: 100dvh !important;
                height: -webkit-fill-available !important;
            }
            .plyr { 
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                background: #000 !important;
            }
            .plyr__video-wrapper { 
                width: 100% !important;
                height: auto !important;
            }
            video#player {
                width: 100% !important;
                height: auto !important;
                object-fit: contain !important;
            }
        }
        .plyr__control--overlaid { 
            background: rgba(255,255,255,0.2); 
            backdrop-filter: blur(10px); 
            border: 2px solid rgba(255,255,255,0.3); 
        }
        .plyr__control--overlaid:hover { 
            background: rgba(255,255,255,0.3); 
        }
        
        /* Mobile optimizations for player */
        @media (max-width: 768px) {
            .plyr__controls { 
                padding: 10px !important; 
                background: linear-gradient(to top, rgba(0,0,0,0.8), transparent) !important; 
            }
            .plyr__control { 
                padding: 8px !important; 
            }
        }
        
        #copy-url-btn {
            position: absolute;
            top: 14px;
            right: 14px;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            background: rgba(255,255,255,0.15);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 100;
            transition: background 0.2s ease, transform 0.2s ease;
        }
        #copy-url-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: scale(1.05);
        }
        #copy-url-btn:active {
            transform: scale(0.95);
        }
        #copy-url-btn svg {
            width: 20px;
            height: 20px;
        }
        .quality-ctrl-btn svg {
            width: 20px;
            height: 20px;
            fill: none;
            stroke: currentColor;
            stroke-width: 2;
        }
        .quality-ctrl-btn.hidden {
            display: none !important;
        }
        #copy-toast {
            position: absolute;
            top: 62px;
            right: 14px;
            background: rgba(15,23,42,0.9);
            color: #4ade80;
            font-size: 0.8rem;
            font-weight: 600;
            padding: 6px 12px;
            border-radius: 8px;
            border: 1px solid rgba(74,222,128,0.3);
            opacity: 0;
            pointer-events: none;
            transform: translateY(-6px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            z-index: 100;
        }
        #copy-toast.show {
            opacity: 1;
            transform: translateY(0);
        }
        #quality-menu, #audio-menu {
            position: absolute;
            min-width: 160px;
            background: rgba(15,23,42,0.95);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            overflow: hidden;
            opacity: 0;
            pointer-events: none;
            transform: translateY(-6px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            z-index: 100;
        }
        #quality-menu.open, #audio-menu.open {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }
        #quality-menu .quality-item, #audio-menu .quality-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 14px;
            color: #e2e8f0;
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            border: none;
            background: transparent;
            width: 100%;
            text-align: left;
            transition: background 0.15s ease;
        }
        #quality-menu .quality-item:hover, #audio-menu .quality-item:hover {
            background: rgba(255,255,255,0.1);
        }
        #quality-menu .quality-item.active, #audio-menu .quality-item.active {
            color: #3b82f6;
        }
        #quality-menu .quality-item .q-check, #audio-menu .quality-item .q-check {
            opacity: 0;
            color: #3b82f6;
        }
        #quality-menu .quality-item.active .q-check, #audio-menu .quality-item.active .q-check {
            opacity: 1;
        }
    </style>
</head>
<body>
<div id="loading" class="loading">
    <div class="google-dots">
        <div class="dot blue"></div>
        <div class="dot red"></div>
        <div class="dot yellow"></div>
        <div class="dot green"></div>
    </div>
    <div class="loading-text-brand">STALKER PORTAL</div>
</div>

<div id="player-container">
    <video id="player" autoplay controls crossorigin playsinline webkit-playsinline x5-playsinline>
        <source src="<?php print($playback_url); ?>" type="application/x-mpegURL">
    </video>
    <div id="quality-menu"></div>
    <div id="audio-menu"></div>
    <button id="copy-url-btn" type="button" title="Copy stream URL" aria-label="Copy stream URL">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
    </button>
    <div id="copy-toast">Copied!</div>
</div>
<script>
document.addEventListener("DOMContentLoaded", () => {
    const video = document.querySelector("video");
    const source = video.getElementsByTagName("source")[0].src;
    const defaultOptions = {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'],
        settings: ['captions', 'quality', 'speed'],
        quality: {
            forced: true,
            default: 'auto',
            options: ['auto'],
            onChange: (quality) => {
                try {
                    if (!window.hls || !window.hls.levels) return;
                    if (quality === 'auto' || isNaN(quality)) {
                        window.hls.currentLevel = -1;
                    } else {
                        const idx = window.hls.levels.findIndex((l) => l.height === quality);
                        window.hls.currentLevel = idx >= 0 ? idx : -1;
                    }
                } catch (err) { console.error('quality onChange:', err); }
            }
        },
        fullscreen: { enabled: true, fallback: true, iosNative: true }
    };
    
    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(source);
        hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
            const heights = [...new Set(hls.levels.map((l) => l.height).filter((h) => h > 0))].sort((a, b) => b - a);
            defaultOptions.quality.options = ['auto'].concat(heights);
            defaultOptions.quality.default = 'auto';
            try { buildQualityMenu(hls); } catch (e) { console.error('buildQualityMenu:', e); }
            initializePlayer();
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, function (event, data) {
            try { updateQualityMenu(hls); } catch (e) { console.error('updateQualityMenu:', e); }
        });
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, function (event, data) {
            try { buildAudioMenu(hls); } catch (e) { console.error('buildAudioMenu:', e); }
        });
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, function (event, data) {
            try { updateAudioMenu(hls); } catch (e) { console.error('updateAudioMenu:', e); }
        });
        hls.on(Hls.Events.ERROR, function (event, data) { 
            console.error('HLS Error:', data); 
            if (data.fatal || data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                initializePlayer();
            }
        });
        hls.attachMedia(video);
        window.hls = hls;
    } else { initializePlayer(); }
    
    let playerInitialized = false;
    function initializePlayer() {
        if (playerInitialized) return;
        playerInitialized = true;
        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('player-container').style.display = 'block';
        }, 1500);
        try {
            const player = new Plyr(video, defaultOptions);
            if (player.touch) { player.toggleControls(true); }
            try { setupQualityControl(player); } catch (e) { console.error('setupQualityControl:', e); }
            try { setupAudioControl(player); } catch (e) { console.error('setupAudioControl:', e); }
            player.on('qualitychange', (e) => {
                try {
                    if (!window.hls || !window.hls.levels) return;
                    const detail = e && e.detail;
                    let q = (detail && detail.quality !== undefined) ? detail.quality : player.quality;
                    if (q === 'auto' || q === -1 || q === undefined || q === null || isNaN(q)) {
                        window.hls.currentLevel = -1;
                    } else {
                        const idx = window.hls.levels.findIndex((l) => l.height === q);
                        window.hls.currentLevel = idx >= 0 ? idx : -1;
                    }
                } catch (err) { console.error('qualitychange:', err); }
            });
            player.play().catch(e => console.log('Autoplay failed:', e));
        } catch (err) {
            console.error('Player init failed:', err);
        }
    }

    // Force initialization if it takes too long or fails
    setTimeout(initializePlayer, 5000);
});

// Hard safety net: never allow the loader to stay stuck
setTimeout(() => {
    const loadingEl = document.getElementById('loading');
    const containerEl = document.getElementById('player-container');
    if (loadingEl && loadingEl.style.display !== 'none') {
        loadingEl.style.display = 'none';
    }
    if (containerEl) {
        containerEl.style.display = 'block';
    }
}, 8000);

// Quality button (inside Plyr control bar)
let qualityBtn = null;
let qualityHasHls = false;
const qualityMenu = document.getElementById('quality-menu');

function setupQualityControl(player) {
    qualityHasHls = window.hls !== undefined;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'plyr__controls__item plyr__control quality-ctrl-btn';
    btn.title = 'Quality';
    btn.setAttribute('aria-label', 'Quality');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3v18"></path><path d="M5 7h14"></path><path d="M8 21h8"></path><path d="M7 7l-2 7a4 4 0 0 0 7 0L10 7"></path><path d="M17 7l-2 7a4 4 0 0 0 7 0l-2-7"></path></svg>';
    let controls = document.querySelector('.plyr__controls');
    if (!controls && player.elements) { controls = player.elements.controls; }
    const settingsBtn = controls ? controls.querySelector('[data-plyr="settings"]') : null;
    if (settingsBtn) {
        controls.insertBefore(btn, settingsBtn);
    } else if (controls) {
        controls.appendChild(btn);
    }
    qualityBtn = btn;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (qualityMenu.classList.contains('open')) {
            qualityMenu.classList.remove('open');
            return;
        }
        audioMenu.classList.remove('open');
        positionMenu(qualityBtn, qualityMenu);
        qualityMenu.classList.add('open');
    });

    if (!qualityHasHls || qualityMenu.querySelectorAll('.quality-item').length === 0) {
        btn.classList.add('hidden');
    }
}

function positionMenu(btn, menu) {
    const container = document.getElementById('player-container');
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    const menuWidth = menu.offsetWidth;
    let left = bRect.left - cRect.left + bRect.width / 2 - menuWidth / 2;
    const maxLeft = cRect.width - menuWidth - 8;
    left = Math.max(8, Math.min(left, maxLeft));
    menu.style.left = left + 'px';
    menu.style.top = (bRect.top - cRect.top - menu.offsetHeight - 10) + 'px';
}

function buildQualityMenu(hls) {
    qualityMenu.innerHTML = '';
    if (!hls.levels || hls.levels.length === 0) {
        if (qualityBtn) qualityBtn.classList.add('hidden');
        return;
    }
    if (qualityBtn) qualityBtn.classList.remove('hidden');
    const auto = document.createElement('button');
    auto.type = 'button';
    auto.className = 'quality-item';
    auto.dataset.index = '-1';
    auto.innerHTML = '<span>Auto</span><span class="q-check">&#10003;</span>';
    qualityMenu.appendChild(auto);
    hls.levels.forEach((l, i) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'quality-item';
        item.dataset.index = String(i);
        const label = l.height ? l.height + 'p' : 'Level ' + (i + 1);
        item.innerHTML = '<span>' + label + '</span><span class="q-check">&#10003;</span>';
        qualityMenu.appendChild(item);
    });
    updateQualityMenu(hls);
    qualityMenu.querySelectorAll('.quality-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            hls.currentLevel = parseInt(item.dataset.index, 10);
            qualityMenu.classList.remove('open');
            updateQualityMenu(hls);
        });
    });
}

function updateQualityMenu(hls) {
    const items = qualityMenu.querySelectorAll('.quality-item');
    if (!items.length) return;
    const current = hls.autoLevelEnabled ? -1 : hls.currentLevel;
    items.forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.index, 10) === current);
    });
}

// Audio track button (inside Plyr control bar)
let audioBtn = null;
const audioMenu = document.getElementById('audio-menu');

function setupAudioControl(player) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'plyr__controls__item plyr__control quality-ctrl-btn';
    btn.title = 'Audio';
    btn.setAttribute('aria-label', 'Audio');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';
    let controls = document.querySelector('.plyr__controls');
    if (!controls && player.elements) { controls = player.elements.controls; }
    const settingsBtn = controls ? controls.querySelector('[data-plyr="settings"]') : null;
    if (settingsBtn) {
        controls.insertBefore(btn, settingsBtn);
    } else if (controls) {
        controls.appendChild(btn);
    }
    audioBtn = btn;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (audioMenu.classList.contains('open')) {
            audioMenu.classList.remove('open');
            return;
        }
        qualityMenu.classList.remove('open');
        positionMenu(audioBtn, audioMenu);
        audioMenu.classList.add('open');
    });

    if (!window.hls || audioMenu.querySelectorAll('.quality-item').length === 0) {
        btn.classList.add('hidden');
    }
}

function buildAudioMenu(hls) {
    audioMenu.innerHTML = '';
    if (!hls.audioTracks || hls.audioTracks.length <= 1) {
        if (audioBtn) audioBtn.classList.add('hidden');
        return;
    }
    if (audioBtn) audioBtn.classList.remove('hidden');
    hls.audioTracks.forEach((t) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'quality-item';
        item.dataset.id = String(t.id);
        const label = t.name || t.lang || ('Track ' + (t.id + 1));
        item.innerHTML = '<span>' + label + '</span><span class="q-check">&#10003;</span>';
        audioMenu.appendChild(item);
    });
    updateAudioMenu(hls);
    audioMenu.querySelectorAll('.quality-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            hls.audioTrack = parseInt(item.dataset.id, 10);
            audioMenu.classList.remove('open');
            updateAudioMenu(hls);
        });
    });
}

function updateAudioMenu(hls) {
    const items = audioMenu.querySelectorAll('.quality-item');
    if (!items.length) return;
    const current = hls.audioTrack;
    items.forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.id, 10) === current);
    });
}

document.addEventListener('click', (e) => {
    if (qualityMenu.classList.contains('open') && qualityBtn && !qualityMenu.contains(e.target) && !qualityBtn.contains(e.target)) {
        qualityMenu.classList.remove('open');
    }
    if (audioMenu.classList.contains('open') && audioBtn && !audioMenu.contains(e.target) && !audioBtn.contains(e.target)) {
        audioMenu.classList.remove('open');
    }
});

// Copy stream URL to clipboard
const copyBtn = document.getElementById('copy-url-btn');
const copyToast = document.getElementById('copy-toast');
const copyUrl = "<?php print($copy_url); ?>";
let toastTimer = null;

copyBtn.addEventListener('click', () => {
    const done = () => {
        copyToast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => copyToast.classList.remove('show'), 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(copyUrl).then(done).catch(() => fallbackCopy(copyUrl, done));
    } else {
        fallbackCopy(copyUrl, done);
    }
});

function fallbackCopy(text, onSuccess) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); onSuccess(); } catch(e) {}
    document.body.removeChild(ta);
}

// Fix for iOS viewport height
window.addEventListener('resize', () => {
    document.getElementById('player-container').style.height = window.innerHeight + 'px';
});
</script>
</body>
</html>
<!-- Source Code By <?php print($APP_CONFIG['WHITELABEL_APP_DEVS']); ?> -->
