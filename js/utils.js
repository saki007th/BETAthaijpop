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
// 🎨 ระบบย้อมสีประทับจากปกอัลบั้ม (ambience)
// - สอดสีเด่นของปกเข้าไปย้อม sidebar / content / player bar / หน้าเล่นเพลง
// - cache สีแยกตาม videoId เพื่อให้ pause→resume เอาสีคืนได้ทันที
// ==========================================
const WINBOX_DEFAULT = { r: 28, g: 28, b: 30 };
window._liveWinBox = null;        // สีที่กำลังใช้งานอยู่ (ของเพลงที่กำลังเล่น)
window._winBoxCache = {};         // cache สีต่อ videoId
window._isPlaying = false;        // สถานะกำลังเล่น (สำหรับตอนสีเปลี่ยน)
window._tintRaf = null;           // handle ของ animation frame

window.setWinBoxColor = function(r, g, b) {
    const root = document.documentElement;
    root.style.setProperty('--wb-bg-r', r);
    root.style.setProperty('--wb-bg-g', g);
    root.style.setProperty('--wb-bg-b', b);
};

// อ่านสีที่แสดงอยู่ปัจจุบัน
function readTintColor() {
    const root = getComputedStyle(document.documentElement);
    const r = parseInt(root.getPropertyValue('--wb-bg-r')) || WINBOX_DEFAULT.r;
    const g = parseInt(root.getPropertyValue('--wb-bg-g')) || WINBOX_DEFAULT.g;
    const b = parseInt(root.getPropertyValue('--wb-bg-b')) || WINBOX_DEFAULT.b;
    return { r, g, b };
}

// ค่อยๆ เลื่อนสีจากค่าปัจจุบันไปยังเป้าหมาย (ทำงานทุกเบราว์เซอร์ ไม่ต้องพึ่ง gradient transition)
window._tweenWinBox = function(toR, toG, toB, dur) {
    if (window._tintRaf) { cancelAnimationFrame(window._tintRaf); window._tintRaf = null; }
    const from = readTintColor();
    if (from.r === toR && from.g === toG && from.b === toB) return;
    const start = performance.now();
    const step = function(now) {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        window.setWinBoxColor(
            Math.round(from.r + (toR - from.r) * e),
            Math.round(from.g + (toG - from.g) * e),
            Math.round(from.b + (toB - from.b) * e)
        );
        if (t < 1) window._tintRaf = requestAnimationFrame(step);
        else window._tintRaf = null;
    };
    window._tintRaf = requestAnimationFrame(step);
};

const TINT_DURATION = 500;

window.resetWinBoxColor = function() {
    window._tweenWinBox(WINBOX_DEFAULT.r, WINBOX_DEFAULT.g, WINBOX_DEFAULT.b, TINT_DURATION);
};

// ติดตั้งสีปัจจุบัน (จำไว้แล้วย้อมจางๆ เข้า)
window.activateWinBoxColor = function(r, g, b) {
    window._liveWinBox = { r, g, b };
    if (window._isPlaying !== false) window._tweenWinBox(r, g, b, TINT_DURATION);
};

// เอาสีของเพลงที่กำลังเล่นคืนมา (ตอน pause → play)
window.restoreWinBoxColor = function() {
    if (window._liveWinBox) {
        window._tweenWinBox(window._liveWinBox.r, window._liveWinBox.g, window._liveWinBox.b, TINT_DURATION);
    } else {
        window.resetWinBoxColor();
    }
};

// ยุติ ambience (หยุด/ไม่มีเพลง → กลับเป็นสีพื้นหลังปกติ)
window.clearAmbience = function() {
    window._liveWinBox = null;
    window.resetWinBoxColor();
};

// ใช้สีจาก cache ทันทีถ้ามี (กันภาพกระตุกตอนสลับเพลง) มิฉะนั้นค่อยสกัดใหม่
window.applyAmbience = function(thumbUrl, videoId) {
    if (!thumbUrl) { window.clearAmbience(); return; }
    if (videoId && window._winBoxCache[videoId]) {
        const c = window._winBoxCache[videoId];
        window.activateWinBoxColor(c.r, c.g, c.b);
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

window.extractDominantColor = function(imgUrl, videoId) {
    if (!imgUrl) { window.clearAmbience(); return; }
    const proxied = 'https://images.weserv.nl/?url=' + encodeURIComponent(imgUrl) + '&w=480&output=jpg';
    loadImageExtraction([imgUrl, proxied], function(img) {
        if (!img) { window.clearAmbience(); return; }
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width; canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, Math.floor(img.height * 0.1), img.width, Math.floor(img.height * 0.8));
            const data = imageData.data;

            let r = 0, g = 0, b = 0, count = 0;

            for (let i = 0; i < data.length; i += 16) {
                const R = data[i], G = data[i + 1], B = data[i + 2];
                if ((R < 40 && G < 40 && B < 40) || (R > 225 && G > 225 && B > 225)) continue;
                r += R; g += G; b += B;
                count++;
            }

            if (count > 0) {
                const factor = 0.55;
                const cr = Math.floor((r / count) * factor);
                const cg = Math.floor((g / count) * factor);
                const cb = Math.floor((b / count) * factor);
                if (videoId) window._winBoxCache[videoId] = { r: cr, g: cg, b: cb };
                window.activateWinBoxColor(cr, cg, cb);
            } else {
                window.clearAmbience();
            }
        } catch (e) {
            window.clearAmbience();
        }
    });
};
