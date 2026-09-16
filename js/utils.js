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
// 🎨 ระบบสกัดสีจากรูปปก (ใช้ทาบพื้นหลังหน้ากำลังเล่น)
// ==========================================
window.setWinBoxColor = function(r, g, b) {
    document.documentElement.style.setProperty('--wb-bg-r', r);
    document.documentElement.style.setProperty('--wb-bg-g', g);
    document.documentElement.style.setProperty('--wb-bg-b', b);
};

window.resetWinBoxColor = function() {
    window.setWinBoxColor(28, 28, 30);
};

window.extractDominantColor = function(imgUrl) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imgUrl;
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, Math.floor(img.height * 0.1), img.width, Math.floor(img.height * 0.8));
        const data = imageData.data;

        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < data.length; i += 16) {
            if ((data[i] < 30 && data[i+1] < 30 && data[i+2] < 30) || (data[i] > 230 && data[i+1] > 230 && data[i+2] > 230)) continue;
            r += data[i]; g += data[i+1]; b += data[i+2];
            count++;
        }

        if (count > 0) {
            const darkenFactor = 0.35;
            r = Math.floor((r / count) * darkenFactor);
            g = Math.floor((g / count) * darkenFactor);
            b = Math.floor((b / count) * darkenFactor);
            window.setWinBoxColor(r, g, b);
        } else {
            window.resetWinBoxColor();
        }
    };
    img.onerror = function() { window.resetWinBoxColor(); };
};
