// ==========================================
// utils.js - small stateless helpers used across modules
// ==========================================

window.extractYouTubeID = function(url) {
    if (!url) return null;
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
};

window.getSingersList = function(artistStr) {
    if (!artistStr) return [];
    let parts = [];
    if (artistStr.includes('[')) {
        const matches = artistStr.match(/\[(.*?)\]/g);
        if (matches) parts = matches.map(m => m.replace(/[\[\]]/g, ''));
        else parts = [artistStr];
    } else { parts = artistStr.split(/[,/&]+/); }
    return parts.map(p => p.trim()).filter(p => p);
};

// ==========================================
// 🔗 ระบบ Share Link (Dynamic Slug)
// ==========================================
window.createCleanSlug = function(title) {
    if (!title) return "";
    let slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || "track-" + Math.floor(Math.random() * 10000);
};

window.checkSharedLink = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const trackSlug = urlParams.get('track');

    if (trackSlug && window.songs) {
        const targetSong = window.songs.find(s => window.createCleanSlug(s.title) === trackSlug);
        if (targetSong) {
            if (typeof window.playSong === 'function') window.playSong(targetSong.id);
            return true;
        }
    }
    return false;
};

function showShareToast(message) {
    let toast = document.getElementById('share-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'share-toast';
        toast.style.cssText = `position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); background: rgba(10, 132, 255, 0.9); color: white; padding: 10px 20px; border-radius: 30px; font-size: 14px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 9999; opacity: 0; transition: opacity 0.3s ease, bottom 0.3s ease; pointer-events: none;`;
        document.body.appendChild(toast);
    }
    toast.innerText = message; toast.style.opacity = '1'; toast.style.bottom = '110px';
    setTimeout(() => { toast.style.opacity = '0'; toast.style.bottom = '90px'; }, 2500);
}

window.copyShareLink = function(songTitle, buttonElement) {
    const slug = window.createCleanSlug(songTitle);
    const shareUrl = `${window.location.origin}${window.location.pathname}?track=${slug}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
        showShareToast('✅ คัดลอกลิงก์เพลงแล้ว!');
        if (buttonElement) {
            const originalText = buttonElement.innerHTML;
            buttonElement.innerHTML = '✨ ก๊อปปี้แล้ว!';
            buttonElement.style.color = '#00d2ff';
            setTimeout(() => { buttonElement.innerHTML = originalText; buttonElement.style.color = ''; }, 2000);
        }
    });
};

// ==========================================
// 🌊 ระบบพื้นหลัง Dynamic สไตล์ Apple Music (Liquid Mesh + ปรับความเร็วตามจังหวะเพลง)
// - สกัดชุดสี 5 เฉดจาก 4 โซนของปกเพลง + สีเด่นสุด
// - วาดก้อนแสง Liquid Mesh เคลื่อนไหวบน <canvas id="npDynamicBg"> ใน #nowPlayingView
// - คำนวณความเร็วการหมุน/ไหลแบบเรียลไทม์จากความถี่ท่อนเนื้อเพลงซิงค์ (timestamps)
// ==========================================
const DEFAULT_PALETTE = [
    { r: 26, g: 32, b: 58 },
    { r: 48, g: 24, b: 68 },
    { r: 18, g: 52, b: 72 },
    { r: 62, g: 22, b: 48 },
    { r: 24, g: 40, b: 64 }
];

window._npBgPaletteCache = {};
window._isPlaying = false;

const npBgState = {
    rafId: null,
    lastTime: 0,
    currentSpeed: 0.35,
    beatPulse: 0,
    targetPalette: DEFAULT_PALETTE.map(c => ({ ...c })),
    orbs: [
        { x: 0.22, y: 0.28, ax: 0.28, ay: 0.24, fx: 0.72, fy: 0.58, px: 0.2, py: 1.1, pm: 0.0, radius: 0.72, r: 26, g: 32, b: 58 },
        { x: 0.78, y: 0.26, ax: 0.26, ay: 0.28, fx: -0.61, fy: 0.76, px: 1.8, py: 0.4, pm: 1.3, radius: 0.68, r: 48, g: 24, b: 68 },
        { x: 0.28, y: 0.76, ax: 0.30, ay: 0.24, fx: 0.54, fy: -0.67, px: 3.1, py: 2.2, pm: 2.5, radius: 0.75, r: 18, g: 52, b: 72 },
        { x: 0.74, y: 0.74, ax: 0.25, ay: 0.29, fx: -0.81, fy: -0.52, px: 4.5, py: 3.7, pm: 3.8, radius: 0.66, r: 62, g: 22, b: 48 },
        { x: 0.50, y: 0.50, ax: 0.32, ay: 0.30, fx: 0.66, fy: 0.84, px: 5.4, py: 4.9, pm: 5.1, radius: 0.62, r: 24, g: 40, b: 64 }
    ]
};

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

function hslToRgb(h, s, l) {
    h = ((h % 1) + 1) % 1;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

// ปรับแต่งสีที่สกัดได้ให้สดมีมิติแบบ Apple Music แต่ไม่สว่างจ้าจนกลบเนื้อเพลง
function tuneOrbColor(r, g, b, index) {
    const hsl = rgbToHsl(r, g, b);
    const s = Math.min(0.86, Math.max(0.45, hsl.s * 1.25 + 0.08));
    // สลับความสว่าง-มืดในแต่ละก้อนเพื่อให้เกิดมิติตื้นลึกเวลาสีไหลทับกัน
    const targetL = [0.34, 0.24, 0.38, 0.20, 0.30][index % 5];
    const l = Math.min(0.42, Math.max(0.16, hsl.l * 0.45 + targetL * 0.55));
    return hslToRgb(hsl.h, s, l);
}

// คำนวณตัวคูณความเร็วจากจังหวะเนื้อเพลงซิงค์ ณ เวลาที่กำลังเล่นจริง
function computeSongSpeedFactor() {
    if (window._isPlaying === false) return 0.08;

    const song = (window.songs && window.currentSongId)
        ? window.songs.find(s => s.id === window.currentSongId)
        : null;
    if (!song) return 0.9;

    const rawTs = (typeof window.getActiveTimestamps === 'function')
        ? window.getActiveTimestamps(song)
        : (song.timestamps || []);
    const validTs = (rawTs || []).filter(t => typeof t === 'number' && !isNaN(t) && t >= 0);

    let playbackRate = 1;
    if (window.ytPlayer && typeof window.ytPlayer.getPlaybackRate === 'function') {
        try { playbackRate = window.ytPlayer.getPlaybackRate() || 1; } catch (e) {}
    }

    // ถ้าเพลงยังไม่ได้ซิงค์เวลาเนื้อเพลง ให้ใช้ความเร็วมาตรฐาน
    if (validTs.length < 2) return 1.0 * playbackRate;

    let currentTime = 0;
    if (window.ytPlayer && typeof window.ytPlayer.getCurrentTime === 'function') {
        try { currentTime = window.ytPlayer.getCurrentTime() || 0; } catch (e) {}
    }

    // หาท่อนปัจจุบันจากเวลาเล่นจริง
    let idx = -1;
    for (let i = 0; i < validTs.length; i++) {
        if (currentTime >= validTs[i]) idx = i;
        else break;
    }

    // ช่วงอินโทรก่อนเข้าท่อนแรก
    if (idx < 0) {
        const waitSec = validTs[0] - currentTime;
        const introSpeed = waitSec > 6 ? 0.45 : 0.72;
        return introSpeed * playbackRate;
    }

    // ช่วงท้ายเพลงหลังท่อนสุดท้าย
    if (idx >= validTs.length - 1) {
        const sinceLast = currentTime - validTs[validTs.length - 1];
        const outroSpeed = sinceLast > 8 ? 0.42 : 0.75;
        return outroSpeed * playbackRate;
    }

    // เฉลี่ยระยะห่างท่อนปัจจุบันกับท่อนข้างเคียง เพื่อให้ความเร็วเปลี่ยนอย่างลื่นไหลตามช่วงเพลง (Verse / Chorus / Rap / Bridge)
    let sumDt = 0, weightSum = 0;
    for (let k = Math.max(0, idx - 1); k <= Math.min(validTs.length - 2, idx + 1); k++) {
        const dt = Math.max(0.45, Math.min(12, validTs[k + 1] - validTs[k]));
        const w = (k === idx) ? 2.2 : 1.0;
        sumDt += dt * w;
        weightSum += w;
    }
    const localDt = weightSum > 0 ? (sumDt / weightSum) : 3.5;

    // แปลงระยะห่างท่อน (วินาที) เป็นตัวคูณความเร็ว:
    // dt ~ 1.0s (เร็วมาก/รัว) -> ~2.35x
    // dt ~ 2.0s (ท่อนฮุก/จังหวะสนุก) -> ~1.65x
    // dt ~ 3.5s (จังหวะปานกลาง) -> ~1.05x
    // dt >= 6.5s (ท่อนช้า/ดนตรีคั่น) -> ~0.45x
    const rawSpeed = 3.5 / Math.pow(localDt, 0.92);
    const clampedSpeed = Math.max(0.40, Math.min(2.45, rawSpeed));
    return clampedSpeed * playbackRate;
}

function isNowPlayingVisible() {
    const view = document.getElementById('nowPlayingView');
    return !!(view && view.classList.contains('active') && !document.hidden);
}

function renderNpDynamicFrame(now) {
    if (!isNowPlayingVisible()) {
        npBgState.rafId = null;
        return;
    }

    const canvas = document.getElementById('npDynamicBg');
    if (!canvas) {
        npBgState.rafId = null;
        return;
    }

    // ใช้ความละเอียดภายในขนาดกะทัดรัดเพื่อให้ radial gradients เบลอผสานกันเนียนเหมือน Apple Music และใช้ GPU น้อยที่สุด
    const targetW = 160;
    const targetH = 100;
    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    const dt = npBgState.lastTime ? Math.min(0.06, (now - npBgState.lastTime) / 1000) : 0.016;
    npBgState.lastTime = now;

    // ปรับความเร็วเข้าหาเป้าหมายอย่างนุ่มนวล + บวกแรงกระเพื่อมตอนขึ้นท่อนใหม่
    const targetSpeed = computeSongSpeedFactor();
    npBgState.currentSpeed += (targetSpeed - npBgState.currentSpeed) * Math.min(1, dt * 3.0);
    npBgState.beatPulse *= Math.exp(-dt * 3.2);

    const effectiveSpeed = npBgState.currentSpeed + npBgState.beatPulse * 1.35;
    const colorLerp = Math.min(1, dt * 2.2);

    // 1. วาดสีพื้นหลังฐานจากสีเฉลี่ยที่มืดลงของชุดสี
    const orbs = npBgState.orbs;
    let avgR = 0, avgG = 0, avgB = 0;
    for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i];
        const t = npBgState.targetPalette[i] || DEFAULT_PALETTE[i];
        o.r += (t.r - o.r) * colorLerp;
        o.g += (t.g - o.g) * colorLerp;
        o.b += (t.b - o.b) * colorLerp;
        avgR += o.r; avgG += o.g; avgB += o.b;
    }
    avgR = Math.round((avgR / orbs.length) * 0.32);
    avgG = Math.round((avgG / orbs.length) * 0.32);
    avgB = Math.round((avgB / orbs.length) * 0.32);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgb(${avgR}, ${avgG}, ${avgB})`;
    ctx.fillRect(0, 0, targetW, targetH);

    // 2. วาดก้อนสี Liquid Mesh ทั้ง 5 ก้อนที่โคจรและสูบฉีดตามความเร็วเพลง
    const diag = Math.hypot(targetW, targetH);

    for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i];
        o.px += dt * o.fx * 0.58 * effectiveSpeed;
        o.py += dt * o.fy * 0.58 * effectiveSpeed;
        o.pm += dt * 0.92 * effectiveSpeed;

        const cx = (o.x + Math.sin(o.px) * o.ax + Math.cos(o.py * 0.7) * 0.09) * targetW;
        const cy = (o.y + Math.cos(o.py) * o.ay + Math.sin(o.px * 0.7) * 0.09) * targetH;
        const pulseScale = 1 + Math.sin(o.pm) * 0.12 + npBgState.beatPulse * 0.15;
        const rad = diag * (o.radius * 0.82) * pulseScale;

        const r = Math.round(o.r);
        const g = Math.round(o.g);
        const b = Math.round(o.b);

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
        grad.addColorStop(0.52, `rgba(${r}, ${g}, ${b}, 0.42)`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, targetW, targetH);
    }

    // 3. เคลือบเงามืดบางๆ (Scrim & Vignette) เพื่อให้เนื้อเพลงสีขาวคมชัดในทุกโทนสี
    const vig = ctx.createRadialGradient(
        targetW * 0.5, targetH * 0.42, diag * 0.10,
        targetW * 0.5, targetH * 0.5, diag * 0.72
    );
    vig.addColorStop(0, 'rgba(6, 6, 12, 0.14)');
    vig.addColorStop(1, 'rgba(4, 4, 10, 0.46)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, targetW, targetH);

    npBgState.rafId = requestAnimationFrame(renderNpDynamicFrame);
}

window.startNpDynamicBg = function() {
    if (npBgState.rafId) return;
    if (!isNowPlayingVisible()) return;
    npBgState.lastTime = performance.now();
    npBgState.rafId = requestAnimationFrame(renderNpDynamicFrame);
};

window.stopNpDynamicBg = function() {
    if (npBgState.rafId) {
        cancelAnimationFrame(npBgState.rafId);
        npBgState.rafId = null;
    }
};

window.pauseNpDynamicBg = function() {
    window._isPlaying = false;
};

window.resumeNpDynamicBg = function() {
    window._isPlaying = true;
    window.startNpDynamicBg();
};

// ส่งแรงกระเพื่อมเมื่อขึ้นท่อนเนื้อเพลงใหม่
window.pulseNpDynamicBg = function() {
    const speed = computeSongSpeedFactor();
    npBgState.beatPulse = Math.min(0.85, npBgState.beatPulse + 0.22 * Math.min(1.8, speed));
    window.startNpDynamicBg();
};

document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.stopNpDynamicBg();
    else if (isNowPlayingVisible()) window.startNpDynamicBg();
});

function setTargetPalette(palette) {
    if (!palette || palette.length === 0) {
        npBgState.targetPalette = DEFAULT_PALETTE.map(c => ({ ...c }));
    } else {
        npBgState.targetPalette = npBgState.orbs.map((_, i) => ({ ...(palette[i % palette.length]) }));
    }
    window.startNpDynamicBg();
}

window.clearAmbience = function() {
    setTargetPalette(DEFAULT_PALETTE);
};

window.applyAmbience = function(thumbUrl, videoId) {
    if (!thumbUrl) {
        window.clearAmbience();
        return;
    }
    if (videoId && window._npBgPaletteCache[videoId]) {
        setTargetPalette(window._npBgPaletteCache[videoId]);
        return;
    }
    window.extractDominantColor(thumbUrl, videoId);
};

// โหลดรูปสำหรับสกัดสี: ลอง crossOrigin ตรงก่อน ถ้าโดน CORS บล็อก ลองผ่าน proxy ที่รองรับ CORS
function loadImageExtraction(urls, onDone) {
    const tryNext = function(i) {
        if (i >= urls.length) { onDone(null); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() { onDone(img); };
        img.onerror = function() { tryNext(i + 1); };
        img.src = urls[i];
    };
    tryNext(0);
}

// สกัดชุดสี 5 เฉดจาก 4 โซนของปกเพลง + สีที่สดที่สุด
window.extractDominantColor = function(imgUrl, videoId) {
    if (!imgUrl) { window.clearAmbience(); return; }
    const proxied = 'https://images.weserv.nl/?url=' + encodeURIComponent(imgUrl) + '&w=240&output=jpg';
    loadImageExtraction([imgUrl, proxied], function(img) {
        if (!img) { window.clearAmbience(); return; }
        try {
            const sampleW = 64;
            const sampleH = 64;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = sampleW;
            canvas.height = sampleH;
            // ตัดขอบดำบน-ล่างของปก YouTube ออก 12%
            const sy = Math.floor(img.height * 0.12);
            const sh = Math.max(1, Math.floor(img.height * 0.76));
            ctx.drawImage(img, 0, sy, img.width, sh, 0, 0, sampleW, sampleH);

            const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
            // แบ่งถังสีตามเฉด (12 Hue Bins) เพื่อดึงสีที่หลากหลายจากปกเพลงจริง (เช่น ชมพู + ฟ้า + ม่วง) ไม่ให้ถูกเฉลี่ยกลืนเป็นสีเดียว
            const hueBins = Array.from({ length: 12 }, () => ({ r: 0, g: 0, b: 0, w: 0 }));
            const zones = [
                { r: 0, g: 0, b: 0, w: 0 },
                { r: 0, g: 0, b: 0, w: 0 },
                { r: 0, g: 0, b: 0, w: 0 },
                { r: 0, g: 0, b: 0, w: 0 }
            ];

            for (let y = 0; y < sampleH; y += 2) {
                for (let x = 0; x < sampleW; x += 2) {
                    const idx = (y * sampleW + x) * 4;
                    const R = data[idx], G = data[idx + 1], B = data[idx + 2];
                    const max = Math.max(R, G, B), min = Math.min(R, G, B);
                    const lum = (max + min) / 510;
                    if (lum < 0.08 || lum > 0.92) continue;

                    const hsl = rgbToHsl(R, G, B);
                    const weight = 0.2 + hsl.s * 3.5 * (1 - Math.abs(lum - 0.5) * 1.1);

                    const zIdx = (y >= sampleH / 2 ? 2 : 0) + (x >= sampleW / 2 ? 1 : 0);
                    zones[zIdx].r += R * weight;
                    zones[zIdx].g += G * weight;
                    zones[zIdx].b += B * weight;
                    zones[zIdx].w += weight;

                    if (hsl.s > 0.12) {
                        const binIdx = Math.min(11, Math.floor(hsl.h * 12));
                        const binWeight = weight * (0.5 + hsl.s);
                        hueBins[binIdx].r += R * binWeight;
                        hueBins[binIdx].g += G * binWeight;
                        hueBins[binIdx].b += B * binWeight;
                        hueBins[binIdx].w += binWeight;
                    }
                }
            }

            const rankedBins = hueBins
                .map((b, idx) => ({ ...b, idx }))
                .filter(b => b.w > 0)
                .sort((a, b) => b.w - a.w);

            const pickedRaw = [];
            for (const b of rankedBins) {
                if (pickedRaw.length >= 3) break;
                pickedRaw.push({ r: b.r / b.w, g: b.g / b.w, b: b.b / b.w });
            }
            for (let i = 0; i < zones.length && pickedRaw.length < 5; i++) {
                const z = zones[i];
                if (z.w > 0) pickedRaw.push({ r: z.r / z.w, g: z.g / z.w, b: z.b / z.w });
            }
            while (pickedRaw.length < 5) {
                pickedRaw.push(DEFAULT_PALETTE[pickedRaw.length]);
            }

            // ปรับแต่งให้สีแต่ละก้อนมีเฉดและความสว่างต่างกันอย่างสมดุล
            const palette = pickedRaw.slice(0, 5).map((c, i) => {
                const tuned = tuneOrbColor(c.r, c.g, c.b, i);
                if (i > 0) {
                    const prev = rgbToHsl(pickedRaw[0].r, pickedRaw[0].g, pickedRaw[0].b);
                    const cur = rgbToHsl(tuned.r, tuned.g, tuned.b);
                    const hueDiff = Math.min(Math.abs(cur.h - prev.h), 1 - Math.abs(cur.h - prev.h));
                    if (hueDiff < 0.06) {
                        const shift = (i % 2 === 0 ? 1 : -1) * (0.06 + i * 0.025);
                        return hslToRgb(cur.h + shift, cur.s, cur.l);
                    }
                }
                return tuned;
            });

            if (videoId) window._npBgPaletteCache[videoId] = palette;
            setTargetPalette(palette);
        } catch (e) {
            window.clearAmbience();
        }
    });
};
