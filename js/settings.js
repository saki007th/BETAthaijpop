// ==========================================
// settings.js - user preferences (persisted to localStorage)
// ==========================================

window.setWallpaper = function(url) {
    const wp = document.getElementById('desktop-wallpaper');
    const input = document.getElementById('inputCustomWallpaper');
    if (!wp) return;

    if (url === 'default' || !url) {
        wp.style.backgroundImage = 'none';
        localStorage.removeItem('customWallpaper');
        if (input) input.value = '';
    } else {
        wp.style.backgroundImage = `url('${url}')`;
        localStorage.setItem('customWallpaper', url);
        if (input && input.value !== url) input.value = url;
    }
};

const savedWp = localStorage.getItem('customWallpaper');
if (savedWp) window.setWallpaper(savedWp);

// ---------- Glass panel opacity / blur (sidebar, player bar, sheets) ----------
window.setWindowStyle = function() {
    const op = document.getElementById('sliderOpacity').value;
    const blur = document.getElementById('sliderBlur').value;
    const opacityVal = op / 100;

    document.documentElement.style.setProperty('--window-opacity', opacityVal);
    document.documentElement.style.setProperty('--window-blur', blur + 'px');

    localStorage.setItem('ws_opacity', opacityVal);
    localStorage.setItem('ws_blur', blur);
};

window.setLyricFontSize = function(size) {
    document.documentElement.style.setProperty('--lyric-font-size', size + 'em');
    localStorage.setItem('ws_fontsize', size);
};

window.setBgSize = function(size) {
    document.documentElement.style.setProperty('--bg-size', size);
    localStorage.setItem('ws_bgsize', size);
};

window.loadCustomSettings = function() {
    const op = localStorage.getItem('ws_opacity');
    const bl = localStorage.getItem('ws_blur');
    const fs = localStorage.getItem('ws_fontsize');
    const bgSz = localStorage.getItem('ws_bgsize');
    const shuffle = localStorage.getItem('ws_shuffle');

    if (op && bl) {
        document.documentElement.style.setProperty('--window-opacity', op);
        document.documentElement.style.setProperty('--window-blur', bl + 'px');
        const slOp = document.getElementById('sliderOpacity');
        const slBl = document.getElementById('sliderBlur');
        if (slOp) slOp.value = Math.round(op * 100);
        if (slBl) slBl.value = bl;
    }
    if (fs) {
        window.setLyricFontSize(fs);
        const slFs = document.getElementById('sliderFontSize');
        if (slFs) slFs.value = fs;
    }
    if (bgSz) {
        window.setBgSize(bgSz);
        const selBg = document.getElementById('bgSizeSelect');
        if (selBg) selBg.value = bgSz;
    }
    if (shuffle === '1') {
        window.isShuffleEnabled = true;
        const chkShuffle = document.getElementById('toggleShuffleBtn');
        if (chkShuffle) chkShuffle.checked = true;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.loadCustomSettings();
});

window.isShuffleEnabled = false;
window.toggleShuffle = function(isEnable) {
    window.isShuffleEnabled = isEnable;
    localStorage.setItem('ws_shuffle', isEnable ? '1' : '0');
};

window.toggleLang = function(langIndex) {
    const container = document.getElementById('lyricsContainer');
    if (!container) return;
    if (event.target.checked) container.classList.remove(`hide-lang-${langIndex}`);
    else container.classList.add(`hide-lang-${langIndex}`);
};
