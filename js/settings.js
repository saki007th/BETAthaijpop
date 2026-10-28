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

// บรรทัดสุดท้ายของทุกท่อนคือคำแปล ไม่ว่าท่อนนั้นจะมี 3 หรือ 4 บรรทัด
// โดย player.js จะใส่ class "reading-text" ให้เฉพาะบรรทัดที่ไม่ใช่แรกและไม่ใช่สุดท้าย
// ดังนั้นบรรทัดที่ index > 0 และไม่มี reading-text = คำแปล → ห้ามซ่อนเด็ดขาด
//  - ท่อน 3 บรรทัด: lang-0 ต้นฉบับ, lang-1 คำอ่าน (reading-text), lang-2 คำแปล
//  - ท่อน 4 บรรทัด: lang-0 ต้นฉบับ, lang-1 โรมาจิ (reading-text), lang-2 ไทย (reading-text), lang-3 คำแปล
window.isTranslationRow = function(el, index) {
    return index > 0 && !el.classList.contains('reading-text');
};

window.shouldHideLyricLine = function(el, index, hideFlags) {
    if (!hideFlags[index]) return false;
    if (window.isTranslationRow(el, index)) return false;
    return true;
};

// ซ่อน/แสดงภาษาแยกทีละท่อน (รองรับเพลงที่มีทั้ง 3 และ 4 บรรทัดปนกัน)
window.applyLangToggles = function() {
    const container = document.getElementById('lyricsContainer');
    if (!container) return;

    // CSS เดิมใช้ hide-lang-* ที่ container ซึ่งซ่อนทุกท่อนพร้อมกัน
    // ซึ่งใช้ไม่ได้กับเพลงที่มีทั้ง 3/4 บรรทัดปนกัน จึงเปลี่ยนมาซ่อนรายท่อนแทน
    container.classList.remove('hide-lang-0', 'hide-lang-1', 'hide-lang-2');

    const state = window.getLangState(window.getLangMode());
    const hideFlags = state.map(s => !s);
    const cur = window.currentLyricIndex;

    container.querySelectorAll('.lyric-line').forEach((section, idx) => {
        if (cur >= 0 && idx !== cur) {
            // ทุกท่อนยกเว้นท่อนปัจจุบัน แสดงแค่บรรทัดแรก (เนื้อเพลงหลัก) เท่านั้น
            section.querySelectorAll('.lang-0, .lyric-main').forEach(el => {
                el.style.setProperty('display', 'block', 'important');
            });
            section.querySelectorAll('.lang-1, .lang-2, .lyric-sub').forEach(el => {
                el.style.setProperty('display', 'none', 'important');
            });
            return;
        }

        if (cur < 0) {
            // ยังไม่เริ่มเล่น แสดงแค่บรรทัดแรกทุกท่อน
            section.querySelectorAll('.lang-0, .lyric-main').forEach(el => {
                el.style.setProperty('display', 'block', 'important');
            });
            section.querySelectorAll('.lang-1, .lang-2, .lyric-sub').forEach(el => {
                el.style.setProperty('display', 'none', 'important');
            });
            return;
        }

        // ท่อนปัจจุบันเท่านั้นที่อิงตามการตั้งค่าภาษาของผู้ใช้
        section.querySelectorAll('[class*="lang-"]').forEach(el => {
            const match = /lang-(\d+)/.exec(el.className || '');
            if (!match) return;
            const index = parseInt(match[1], 10);
            el.style.display = window.shouldHideLyricLine(el, index, hideFlags) ? 'none' : '';
        });
        section.querySelectorAll('.lyric-main').forEach(el => {
            el.style.removeProperty('display');
        });
        section.querySelectorAll('.lyric-sub').forEach(el => {
            const parent = el.parentElement;
            if (parent && /lang-(\d+)/.test(parent.className || '')) {
                const match = /lang-(\d+)/.exec(parent.className || '');
                const index = match ? parseInt(match[1], 10) : 1;
                el.style.display = window.shouldHideLyricLine(parent, index, hideFlags) ? 'none' : '';
            } else {
                el.style.removeProperty('display');
            }
        });
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
    const songTrans = localStorage.getItem('ws_song_transition');

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

    const chkTrans = document.getElementById('toggleSongTransition');
    if (chkTrans) chkTrans.checked = (songTrans !== '0');

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

// อนิเมชั่นเปลี่ยนเพลง — เปิดไว้เป็นค่าเริ่มต้น (ปิดได้ในหน้าตั้งค่า)
window.isSongTransitionEnabled = function() {
    try { return localStorage.getItem('ws_song_transition') !== '0'; }
    catch (e) { return true; }
};

window.setSongTransition = function(isEnable) {
    try { localStorage.setItem('ws_song_transition', isEnable ? '1' : '0'); }
    catch (e) {}
};