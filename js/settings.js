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

// จำนวนบรรทัดย่อยภายใน "ท่อนเดียว" (ไม่ใช่รวมทั้งเพลง)
// เพลง 3 บรรทัด = JP/EN, คำอ่าน, คำแปล  → index 2 คือคำแปล (ห้ามซ่อน)
// เพลง 4 บรรทัด = JP, โรมาจิ, ไทย, คำแปล → index 2 คือไทย (ซ่อนได้)
window.getLyricLineCount = function() {
    if (!Array.isArray(window.currentLyricsArray) || !window.currentLyricsArray.length) return 0;
    let max = 0;
    for (const section of window.currentLyricsArray) {
        const text = (section || '').trim();
        if (!text || text === '[ดนตรี]') continue;
        const count = text.split('\n').filter(l => l.trim() !== '').length;
        if (count > max) max = count;
    }
    return max;
};

window.applyLangToggles = function() {
    const container = document.getElementById('lyricsContainer');
    if (!container) return;

    // นับบรรทัดย่อยภายในท่อนเดียว เพื่อแยกว่าเป็นเพลง 3 หรือ 4 บรรทัด
    const lineCount = window.getLyricLineCount();
    const is4Line = lineCount >= 4; // JP+โรมาจิ+ไทย+คำแปล

    const state = window.getLangState(window.getLangMode());

    container.classList.remove('hide-lang-0', 'hide-lang-1', 'hide-lang-2');

    state.forEach((show, i) => {
        if (show) return;

        // เพลง 3 บรรทัด: index 2 คือคำแปล → ห้ามซ่อน ไม่งั้นคำแปลจะหาย
        // เพลง 4 บรรทัด: index 2 คือภาษาไทย → ซ่อนได้ตามปกติ
        if (i === 2 && !is4Line) return;

        container.classList.add(`hide-lang-${i}`);
    });
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