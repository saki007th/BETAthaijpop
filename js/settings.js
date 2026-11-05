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

// ==========================================
// โหมดเนื้อเพลงแบบย่อสำหรับจอเล็ก
// จอ ≤ 560px + โหมดปกติ (ไม่ใช่ Immersive) → แสดงเฉพาะ
// บรรทัดแรก (ภาษาหลัก) และบรรทัดสุดท้าย (คำแปล) ของแต่ละท่อน
// ==========================================
const COMPACT_LYRIC_MAX_WIDTH = 560;
let compactLyricMql = null;

window.isCompactLyricLayout = function() {
    if (typeof window.matchMedia !== 'function') return false;
    // โหมด Immersive มีการแสดงผลเฉพาะท่อน active อยู่แล้ว จึงไม่ต้องย่อซ้ำ
    if (window.getLangMode && window.getLangMode() === 'immersive') return false;
    return window.matchMedia(`(max-width: ${COMPACT_LYRIC_MAX_WIDTH}px)`).matches;
};

// ดึงเฉพาะบรรทัดภาษา (lang-0, lang-1, ...) ที่เป็นลูกโดยตรงของ .lyric-line
function getLangRows(section) {
    return Array.from(section.children).filter(el =>
        el.classList && Array.from(el.classList).some(c => /^lang-\d+$/.test(c))
    );
}

function showLangRow(row) {
    row.style.removeProperty('display');
    row.querySelectorAll('.lyric-main, .lyric-sub').forEach(el => el.style.removeProperty('display'));
}

function hideLangRow(row) {
    row.style.setProperty('display', 'none', 'important');
}

function applyCompactLyrics(container) {
    container.querySelectorAll('.lyric-line').forEach(section => {
        const rows = getLangRows(section);
        if (!rows.length) return; // ท่อน [ดนตรี] ไม่มีบรรทัดภาษา
        const last = rows.length - 1;
        rows.forEach((row, i) => {
            if (i === 0 || i === last) showLangRow(row);
            else hideLangRow(row);
        });
    });
}

// อัปเดตทันทีเมื่อหมุนจอ/เปลี่ยนความกว้างข้าม breakpoint
window.bindCompactLyricWatcher = function() {
    if (compactLyricMql || typeof window.matchMedia !== 'function') return;
    compactLyricMql = window.matchMedia(`(max-width: ${COMPACT_LYRIC_MAX_WIDTH}px)`);
    const onChange = () => { if (window.applyLangToggles) window.applyLangToggles(); };
    if (compactLyricMql.addEventListener) compactLyricMql.addEventListener('change', onChange);
    else if (compactLyricMql.addListener) compactLyricMql.addListener(onChange);
};

function applyLangToSection(section, idx, isActive, hideFlags) {
    if (!section) return;
    section.querySelectorAll('[class*="lang-"]').forEach(el => el.style.removeProperty('display'));
    section.querySelectorAll('.lyric-main, .lyric-sub').forEach(el => el.style.removeProperty('display'));

    if (!isActive) {
        // ทุกท่อนยกเว้นท่อนปัจจุบัน แสดงแค่บรรทัดแรก (เนื้อเพลงหลัก) เท่านั้น
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
}

// ซ่อน/แสดงภาษาแยกทีละท่อน (รองรับเพลงที่มีทั้ง 3 และ 4 บรรทัดปนกัน)
window.applyLangToggles = function(onlyActiveDiff) {
    const container = document.getElementById('lyricsContainer');
    if (!container) return;

    container.classList.remove('hide-lang-0', 'hide-lang-1', 'hide-lang-2');

    // จอเล็ก + โหมดปกติ: เหลือแค่บรรทัดแรกกับคำแปล ไม่สนใจ checkbox ภาษา
    const compact = window.isCompactLyricLayout();
    container.classList.toggle('lyric-compact', compact);
    if (compact) {
        if (!onlyActiveDiff || container._langAppliedKey !== 'compact') {
            applyCompactLyrics(container);
            container._langAppliedKey = 'compact';
        }
        return;
    }

    const mode = window.getLangMode();
    const state = window.getLangState(mode);
    const hideFlags = state.map(s => !s);
    const cur = window.currentLyricIndex;
    const activeSet = new Set(
        Array.isArray(window.currentLyricIndices) && window.currentLyricIndices.length
            ? window.currentLyricIndices
            : (cur >= 0 ? [cur] : [])
    );
    const activeKey = Array.from(activeSet).sort((a, b) => a - b).join(',');
    const stateKey = mode + ':' + state.map(v => v ? '1' : '0').join('') + ':' + activeKey;

    // ทางลัดระหว่างเล่นเพลง: อัปเดตเฉพาะท่อนเก่าและท่อนใหม่ ไม่ต้องวนแก้ DOM ทั้งเพลงทุกครั้ง
    if (onlyActiveDiff && container._langAppliedKey === stateKey && typeof container._langAppliedIdx === 'number') {
        return;
    }

    // เพลงปกติ (active ท่อนเดียว) ใช้ทางลัดเดิม
    if (onlyActiveDiff && activeSet.size === 1 && container._langAppliedKey &&
        container._langAppliedActiveCount === 1 && typeof container._langAppliedIdx === 'number') {
        const prev = container._langAppliedIdx;
        if (prev !== cur) {
            if (prev >= 0) applyLangToSection(document.getElementById(`lyric-line-${prev}`), prev, false, hideFlags);
            if (cur >= 0) applyLangToSection(document.getElementById(`lyric-line-${cur}`), cur, true, hideFlags);
        }
        container._langAppliedKey = stateKey;
        container._langAppliedIdx = cur;
        container._langAppliedActiveCount = 1;
        return;
    }

    container.querySelectorAll('.lyric-line').forEach((section, idx) => {
        applyLangToSection(section, idx, activeSet.has(idx), hideFlags);
    });
    container._langAppliedKey = stateKey;
    container._langAppliedIdx = cur;
    container._langAppliedActiveCount = activeSet.size;
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
    window.bindCompactLyricWatcher();

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