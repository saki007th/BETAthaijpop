// app.js
// Main Entry Point ควบคุมการทำงานหลักของแอปพลิเคชัน

import { AppState } from './state.js';
import { initFirebaseAuth, loginWithGoogle, logout, fetchSongs } from './firebase.js';
import { renderSongList, initLibraryEvents } from './library.js';
import { openSingerColorManager } from './singerColors.js';
import { db } from './firebase.js';

// --- 1. จัดการ Window Manager ---
window.wm = {
    libWin: null, playerWin: null, lyricsWin: null, settingsWin: null, addWin: null, adminSyncWin: null, notifyWin: null,

    applyMemory: function(winId, options) {
        try {
            const saved = JSON.parse(localStorage.getItem('winbox_memory_' + winId));
            if (saved && saved.x < window.innerWidth - 50 && saved.y < window.innerHeight - 50) {
                options.x = saved.x;
                options.y = saved.y;
                options.width = saved.width;
                options.height = saved.height;
            }
        } catch(e) {}

        const originalOnMove = options.onmove;
        options.onmove = function(x, y) {
            if (originalOnMove) originalOnMove.call(this, x, y);
            window.wm.saveMemory(winId, this);
        };

        const originalOnResize = options.onresize;
        options.onresize = function(w, h) {
            if (originalOnResize) originalOnResize.call(this, w, h);
            window.wm.saveMemory(winId, this);
        };

        const originalOnClose = options.onclose;
        options.onclose = function(force) {
            if (!force) {
                this.addClass('closing'); 
                setTimeout(() => this.close(true), 300); 
                return true; 
            }
            if (originalOnClose) return originalOnClose.call(this, force);
        };

        return options;
    },
    
    saveMemory: function(winId, wbInstance) {
        const state = {
            x: wbInstance.x, y: wbInstance.y,
            width: wbInstance.width, height: wbInstance.height
        };
        localStorage.setItem('winbox_memory_' + winId, JSON.stringify(state));
    },

    openLibrary: function() {
        if (this.libWin) { this.libWin.focus(); return; }
        this.libWin = new WinBox("🏠 คลังเพลงของฉัน", this.applyMemory('library', {
            mount: document.getElementById("content-library"), width: "80%", height: "80%", x: "center", y: "center", top: 70, class: ["wb-dark"],
            onclose: () => { this.libWin = null; }
        }));
        renderSongList();
    },
    openSettings: function() {
        if (this.settingsWin) { this.settingsWin.focus(); return; }
        this.settingsWin = new WinBox("⚙️ การตั้งค่า", this.applyMemory('settings', {
            mount: document.getElementById("content-settings"), width: "350px", height: "450px", x: "center", y: "center", top: 70, class: ["wb-dark"],
            onclose: () => { this.settingsWin = null; }
        }));
    },
    openPlayer: function(title) {
        if (this.playerWin) { this.playerWin.setTitle("🎥 " + title); this.playerWin.focus(); return; }
        this.playerWin = new WinBox("🎥 " + title, this.applyMemory('player', {
            mount: document.getElementById("content-player"), width: "500px", height: "320px", x: "20px", y: "80px", top: 70, class: ["wb-dark", "no-min"],
            onclose: () => { 
                this.playerWin = null;
                if (AppState.ytPlayer && typeof AppState.ytPlayer.destroy === 'function') {
                    AppState.ytPlayer.destroy();
                    AppState.ytPlayer = null;
                }
                
                // ใช้ textContent / DOM API แทน innerHTML เพื่อป้องกัน XSS
                const playerContainer = document.getElementById("content-player");
                playerContainer.textContent = '';
                const newYtDiv = document.createElement('div');
                newYtDiv.id = 'youtubePlayer';
                newYtDiv.style.cssText = 'width: 100%; height: 100%;';
                playerContainer.appendChild(newYtDiv);
                
                const liveAct = document.getElementById('liveActivity');
                const liveDiv = document.getElementById('dockDivider');
                if (liveAct) liveAct.classList.add('hidden');
                if (liveDiv) liveDiv.classList.add('hidden');
                
                const bgEl = document.getElementById('dynamic-bg');
                if (bgEl) bgEl.classList.remove('active');

                AppState.resetPlayerState();
                
                if (window.setRandomPanelState) window.setRandomPanelState(true);
                if (this.lyricsWin) this.lyricsWin.close(); 
                if (this.adminSyncWin) this.adminSyncWin.close(); 
            }
        }));
    },
    openLyrics: function(title) {
        if (this.lyricsWin) { this.lyricsWin.setTitle("📝 " + title); this.lyricsWin.focus(); return; }
        this.lyricsWin = new WinBox("📝 " + title, this.applyMemory('lyrics', {
            mount: document.getElementById("content-lyrics"), width: "500px", height: "80%", x: "right", y: "center", top: 70, class: ["wb-dark"],
            onclose: () => { this.lyricsWin = null; }
        }));
    },
    openAdd: function(title) {
        if (this.addWin) { this.addWin.setTitle(title); this.addWin.focus(); return; }
        this.addWin = new WinBox(title, this.applyMemory('addedit', {
            mount: document.getElementById("content-add"), width: "450px", height: "80%", x: "center", y: "center", top: 70, class: ["wb-dark"],
            onclose: () => { this.addWin = null; }
        }));
    },
    openAdminSync: function() {
        if (!AppState.isAdmin || !AppState.currentSongId) return;
        const song = AppState.getSong(AppState.currentSongId);
        if (this.adminSyncWin) { this.adminSyncWin.setTitle("⏱ ซิงค์: " + song.title); this.adminSyncWin.focus(); return; }
        
        this.adminSyncWin = new WinBox("⏱ ซิงค์: " + song.title, this.applyMemory('adminsync', {
            mount: document.getElementById("content-admin-sync"), width: "450px", height: "80%", x: "center", y: "center", top: 70, class: ["wb-dark"],
            onclose: () => { this.adminSyncWin = null; }
        }));
        if (window.renderTimestampEditor) window.renderTimestampEditor(); 
    }
};

// --- 2. การกำหนดค่าเริ่มต้น ---
document.addEventListener('DOMContentLoaded', () => {
    // โหลด Settings
    if (window.loadCustomSettings) window.loadCustomSettings();
    initLibraryEvents();

    // YouTube API
    window.onYouTubeIframeAPIReady = function() { window.isYTApiReady = true; };
    const tag = document.createElement('script'); 
    tag.src = "https://www.youtube.com/iframe_api"; 
    document.head.appendChild(tag);

    // ปิดเมนูเมื่อคลิกที่อื่น
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.ts-singer-dropdown')) {
            document.querySelectorAll('.ts-dropdown-menu.show').forEach(m => m.classList.remove('show'));
        }
    });

    // เริ่มต้น Firebase Auth
    initFirebaseAuth(updateUIState);
    
    // ตั้งค่าปุ่ม Header (ผูก Event แทน onclick ใน HTML)
    document.getElementById('btnHeaderLogin').addEventListener('click', loginWithGoogle);
    document.getElementById('btnHeaderLogout').addEventListener('click', logout);
});

// --- 3. อัปเดต UI เมื่อสถานะล็อกอินเปลี่ยน ---
function updateUIState() {
    document.getElementById('btnHeaderLogout').style.display = AppState.isLoggedIn ? 'block' : 'none';
    document.getElementById('btnHeaderLogin').style.display = AppState.isLoggedIn ? 'none' : 'block';
    
    const btnAddSong = document.getElementById('btnAddSong');
    if (btnAddSong) btnAddSong.style.display = AppState.isAdmin ? 'block' : 'none';
    
    const btnDockAdminSync = document.getElementById('btnDockAdminSync');
    if (btnDockAdminSync) btnDockAdminSync.style.display = AppState.isAdmin ? 'block' : 'none';
    
    // ปุ่มจัดการสีนักร้อง
    let btnColor = document.getElementById('btnColorAdmin');
    if (AppState.isAdmin) {
        if (!btnColor) {
            btnColor = document.createElement('button');
            btnColor.id = 'btnColorAdmin';
            btnColor.textContent = '🎨 จัดการสีนักร้อง';
            btnColor.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:100; background:#9370DB; color:#fff; border:none; padding:10px 15px; border-radius:20px; cursor:pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5); font-weight:bold;';
            btnColor.addEventListener('click', () => openSingerColorManager(db));
            document.body.appendChild(btnColor);
        }
        btnColor.style.display = 'block';
    } else {
        if (btnColor) btnColor.style.display = 'none';
    }

    // โหลดเพลงและอัปเดต UI ที่เกี่ยวข้อง
    fetchSongs().then(success => {
        if (success) {
            if (window.renderRandomPlaylist) window.renderRandomPlaylist();
            if (window.checkNewSongsNotification) window.checkNewSongsNotification();
            
            // ตรวจสอบ URL Parameter
            const urlParams = new URLSearchParams(window.location.search);
            const songIdFromUrl = urlParams.get('song');
            
            if (songIdFromUrl && AppState.getSong(songIdFromUrl)) {
                if (window.playSong) window.playSong(songIdFromUrl); 
            } else {
                window.wm.openLibrary(); 
            }
        }
    });
}
