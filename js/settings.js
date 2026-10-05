// ==========================================
// settings.js - user preferences (persisted to localStorage)
// ==========================================

window.setLyricFontSize = function(size) {
    document.documentElement.style.setProperty('--lyric-font-size', size + 'em');
    localStorage.setItem('ws_fontsize', size);
};

// ค่าเริ่มต้น: โหมดปกติแสดงครบ 3 ภาษา, โหมด Immersive และโหมด Pip แสดงแค่ ญี่ปุ่น + ไทย
window.DEFAULT_LANG_STATE = {
    normal: [true, true, true],
    immersive: [true, false, true],
    pip: [true, false, true]
};

window.LANG_MODES = ['normal', 'immersive', 'pip'];

window.getLangMode = function() {
    const view = document.getElementById('nowPlayingView');
    return (view && view.classList.contains('immersive')) ? 'immersive' : 'normal';
};

window.getLangState = function(mode) {
    try {
        const stored = JSON.parse(localStorage.getItem('ws_lang_state') || 'null');
        if (stored && Array.isArray(stored[mode]) && stored[mode].length === 3) return stored[mode];
    } catch (e) {}
    return (window.DEFAULT_LANG_STATE[mode] || window.DEFAULT_LANG_STATE.normal).slice();
};

window.saveLangState = function(mode, state) {
    try {
        const all = {};
        ['normal', 'immersive', 'pip'].forEach(m => all[m] = window.getLangState(m));
        all[mode] = state;
        localStorage.setItem('ws_lang_state', JSON.stringify(all));
    } catch (e) {}
};

window.getLyricLineCount = function() {
    const song = window.songs.find(s => s.id === window.currentSongId);
    if (!song || !window.currentLyricsArray) return 0;
    return window.currentLyricsArray.reduce((sum, section) => {
        const lines = (section || '').split('\n').filter(l => l.trim() !== '').length;
        return sum + lines;
    }, 0);
};

window.applyLangToggles = function() {
    const container = document.getElementById('lyricsContainer');
    if (!container) return;

    // หาจำนวนบรรทัดของเพลงปัจจุบันเพื่อดูว่าแบบ 3 หรือ 4 บรรทัด
    const lineCount = window.getLyricLineCount();
    const is4LineFormat = lineCount >= 4; // มี 4 บรรทัดขึ้นไป = JP+Romaji+Thai+Translation

    container.classList.remove('hide-lang-0', 'hide-lang-1', 'hide-lang-2');
    
    const state = window.getLangState(window.getLangMode());
    state.forEach((show, i) => {
        // ตรรกะซ่อนแตกต่างกันตามรูปแบบเพลง
        if (!show) {
            // รูปแบบ 4 บรรทัด: index 0=JP, 1=Romaji, 2=Thai, Translation อยู่ข้างนอกหรือ index 3
            // เราสามารถซ่อน index 0, 1, 2 ได้ตามสถานะปกติ
            if (i <= 2) {
                container.classList.add(`hide-lang-${i}`);
            }
            // ไม่ควรซ่อน index ที่เกิน 2 เพราะอาจเป็นคำแปล
        }
    });
    
    // กรณีเพลง 3 บรรทัด (อาจเป็น EN+Thai+Translation): 
    // ต้องตรวจสอบเพิ่มเติมว่าบรรทัดที่ 2 คืออะไร
    // แต่ด้วยโครงสร้างปัจจุบัน เราจะไม่ไปซ่อน index 2 หากเป็นเพลง 3 บรรทัด
    // เพื่อไม่ให้คำแปลหาย
};

window.syncLangCheckboxes = function() {
    const modeIds = { normal: 'lyricLangTogglesNormal', immersive: 'lyricLangTogglesImmersive', pip: 'lyricLangTogglesPiP' };
    Object.keys(modeIds).forEach(mode => {
        const box = document.getElementById(modeIds[mode]);
        if (!box) return;
        const state = window.getLangState(mode);
        box.querySelectorAll('input[type=checkbox]').forEach(chk => {
            const idx = parseInt(chk.getAttribute('data-lang'), 10);
            if (!isNaN(idx)) chk.checked = !!state[idx];
        });
    });
};

window.toggleLang = function(langIndex, el, mode) {
    const container = document.getElementById('lyricsContainer');
    if (!container) return;
    const state = window.getLangState(mode);
    if (el && el.checked) {
        state[langIndex] = true;
    } else if (state.filter(Boolean).length <= 1) {
        if (el) el.checked = true;
        return;
    } else {
        state[langIndex] = false;
    }
    window.saveLangState(mode, state);
    window.syncLangCheckboxes();
    window.applyLangToggles();
};

window.loadCustomSettings = function() {
    const fs = localStorage.getItem('ws_fontsize');
    const shuffle = localStorage.getItem('ws_shuffle');

    if (fs) {
        window.setLyricFontSize(fs);
        const slFs = document.getElementById('sliderFontSize');
        if (slFs) slFs.value = fs;
    }
    if (shuffle === '1') {
        window.isShuffleEnabled = true;
        const chkShuffle = document.getElementById('toggleShuffleBtn');
        if (chkShuffle) chkShuffle.checked = true;
    }

    window.syncLangCheckboxes();
    window.applyLangToggles();
};

document.addEventListener('DOMContentLoaded', () => {
    window.loadCustomSettings();
});

window.isShuffleEnabled = false;
window.toggleShuffle = function(isEnable) {
    window.isShuffleEnabled = isEnable;
    localStorage.setItem('ws_shuffle', isEnable ? '1' : '0');
};