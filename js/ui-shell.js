// ==========================================
// ui-shell.js - view switching + modal/sheet system
// Replaces the old WinBox-based window manager. Keeps the same
// wm.openXxx() method names so the rest of the app (and notify.js /
// singerColors.js) can call them exactly like before.
// ==========================================

window.wm = {

    showView(viewName) {
        document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.remove('active'));

        const view = document.getElementById('view-' + viewName);
        if (view) view.classList.add('active');

        const nav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
        if (nav) nav.classList.add('active');

        if (viewName === 'home' && window.renderHomeStats) window.renderHomeStats();
    },

    openLibrary() {
        this.showView('library');
        if (window.renderSongList) window.renderSongList();
    },

    openSettings() {
        this.showView('settings');
    },

    // Home view holds the artist spotlight; keep the historical method name
    // since fetchSongs()/desktop icon markup used to call this.
    openArtistWidget() {
        this.showView('home');
        if (window.renderArtistWidget) window.renderArtistWidget();
    },

    openPlayer() {
        document.getElementById('nowPlayingView').classList.add('active');
        document.getElementById('liveActivity').classList.remove('hidden');
    },

    openLyrics() {
        // Lyrics live inside the same Now Playing view as the player now.
        document.getElementById('nowPlayingView').classList.add('active');
    },

    collapseNowPlaying() {
        document.getElementById('nowPlayingView').classList.remove('active');
    },

    updateSyncTitle(title) {
        const el = document.getElementById('syncPanelTitle');
        if (el) el.innerText = "⏱ ซิงค์: " + title;
    },

    toggleSyncPanel() {
        if (!window.isAdmin || !window.currentSongId) {
            if (!window.currentSongId) alert('กรุณากดเล่นเพลงที่ต้องการซิงค์ก่อนครับ');
            return;
        }
        const panel = document.getElementById('syncPanel');
        const isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen && window.renderTimestampEditor) window.renderTimestampEditor();
    },

    openAdd(title) {
        document.getElementById('modalAddTitle').innerText = title;
        window.openSheetEl(document.getElementById('modalAdd'));
    },

    // Legacy no-op fields kept only so nothing throws if referenced.
    libWin: null, settingsWin: null, playerWin: null, lyricsWin: null, addWin: null, adminSyncWin: null, artistWin: null
};

window.closeAddModal = function() {
    window.closeSheetEl(document.getElementById('modalAdd'));
};

// ---------- Generic backdrop-driven sheet helper (used by both the fixed
// Add/Edit sheet above, and the dynamically-filled generic sheet below) ----------
window.openSheetEl = function(sheetEl) {
    document.getElementById('modalBackdrop').classList.add('active');
    sheetEl.classList.add('active');
};
window.closeSheetEl = function(sheetEl) {
    document.getElementById('modalBackdrop').classList.remove('active');
    sheetEl.classList.remove('active');
};

// ---------- Generic sheet used by notify.js / singerColors.js ----------
window.openSheet = function(title, mountEl, onClose) {
    window.closeSheet();
    document.getElementById('genericModalTitle').innerText = title;
    const body = document.getElementById('genericModalBody');
    body.innerHTML = '';
    body.appendChild(mountEl);
    window.openSheetEl(document.getElementById('genericModalSheet'));
    window._sheetOnClose = onClose || null;
};

// Closes whichever sheet is currently open (generic sheet or the Add/Edit
// sheet) - used by the shared backdrop click and both close buttons.
window.closeSheet = function() {
    const sheet = document.getElementById('genericModalSheet');
    const addModal = document.getElementById('modalAdd');
    const wasGenericOpen = sheet.classList.contains('active');
    document.getElementById('modalBackdrop').classList.remove('active');
    sheet.classList.remove('active');
    addModal.classList.remove('active');
    if (wasGenericOpen && window._sheetOnClose) { window._sheetOnClose(); window._sheetOnClose = null; }
};

// click-to-seek on the Now Playing progress bar
document.addEventListener('DOMContentLoaded', () => {
    const scrub = document.getElementById('npScrub');
    if (scrub) {
        scrub.addEventListener('click', (e) => {
            if (!window.ytPlayer || typeof window.ytPlayer.getDuration !== 'function') return;
            const rect = scrub.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            const duration = window.ytPlayer.getDuration();
            if (duration > 0) window.ytPlayer.seekTo(duration * ratio, true);
        });
    }
});

// close any open singer-select dropdown when clicking elsewhere (timestamp editor)
document.addEventListener('click', function(e) {
    if (!e.target.closest('.ts-singer-dropdown')) {
        document.querySelectorAll('.ts-dropdown-menu.show').forEach(m => m.classList.remove('show'));
    }
});
