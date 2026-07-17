// ui-binder.js
// ไฟล์นี้ทำหน้าที่ผูกเหตุการณ์ (Event Listeners) เข้ากับปุ่มและอินพุตต่างๆ บนหน้าเว็บ (index.html)
// เพื่อให้แยกการจัดการ UI ออกจากตรรกะการทำงานหลัก (Separation of Concerns) และหลีกเลี่ยง Inline Events

import { AppState } from './state.js';
import { togglePiPMode } from './pip.js';
import { openNotifyWindow } from './notify.js';
import { toggleLivePlay, nextLiveSong, prevLiveSong } from './player.js';
import { resetSync, prevLyric, nextLyric } from './admin.js';
import { saveSongToDB } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {

    // 1. แถบ Dock (เมนูหลัก)
    const btnLibrary = document.getElementById('btnDockLibrary');
    if (btnLibrary) btnLibrary.addEventListener('click', () => window.wm.openLibrary());

    const btnSettings = document.getElementById('btnDockSettings');
    if (btnSettings) btnSettings.addEventListener('click', () => window.wm.openSettings());

    const btnPiP = document.getElementById('btnDockPiP');
    if (btnPiP) btnPiP.addEventListener('click', togglePiPMode);

    const btnAdminSync = document.getElementById('btnDockAdminSync');
    if (btnAdminSync) {
        btnAdminSync.addEventListener('click', () => {
            if(AppState.currentSongId) window.wm.openAdminSync(); 
            else alert('กรุณากดเล่นเพลงที่ต้องการซิงค์ก่อนครับ');
        });
    }

    // 2. แถบควบคุมเพลง (Live Activity)
    const liveActivity = document.getElementById('liveActivity');
    if (liveActivity) {
        liveActivity.addEventListener('click', () => {
            if(AppState.currentSongId) {
                const title = document.getElementById('liveTitle').textContent;
                window.wm.openPlayer(title);
            }
        });
    }

    const btnLivePrev = document.getElementById('btnLivePrev');
    if (btnLivePrev) {
        btnLivePrev.addEventListener('click', (e) => {
            e.stopPropagation();
            prevLiveSong();
        });
    }

    const btnLivePlay = document.getElementById('livePlayPauseBtn');
    if (btnLivePlay) {
        btnLivePlay.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLivePlay();
        });
    }

    const btnLiveNext = document.getElementById('btnLiveNext');
    if (btnLiveNext) {
        btnLiveNext.addEventListener('click', (e) => {
            e.stopPropagation();
            nextLiveSong();
        });
    }

    // 3. ปุ่มในหน้าต่างตั้งค่า (Settings)
    const setupWallpaperBtn = (id, url) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => setWallpaper(url));
    };
    setupWallpaperBtn('btnWallDefault', 'default');
    setupWallpaperBtn('btnWallCyber', 'https://images.unsplash.com/photo-1538370965046-79c0d6907d47?q=80&w=2000');
    setupWallpaperBtn('btnWallStar', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2000');
    setupWallpaperBtn('btnWallNature', 'https://images.unsplash.com/photo-1506744626753-1fa28f673b0c?q=80&w=2000');

    const inputWall = document.getElementById('inputCustomWallpaper');
    if (inputWall) inputWall.addEventListener('change', (e) => setWallpaper(e.target.value));

    const bgSize = document.getElementById('bgSizeSelect');
    if (bgSize) bgSize.addEventListener('change', (e) => setBgSize(e.target.value));

    const toggleShuffle = document.getElementById('toggleShuffleBtn');
    if (toggleShuffle) {
        toggleShuffle.addEventListener('change', (e) => {
            AppState.isShuffleEnabled = e.target.checked;
            localStorage.setItem('ws_shuffle', e.target.checked ? '1' : '0');
        });
    }

    const sliderOp = document.getElementById('sliderOpacity');
    if (sliderOp) sliderOp.addEventListener('input', setWindowStyle);

    const sliderBlur = document.getElementById('sliderBlur');
    if (sliderBlur) sliderBlur.addEventListener('input', setWindowStyle);

    const sliderFont = document.getElementById('sliderFontSize');
    if (sliderFont) sliderFont.addEventListener('input', (e) => setLyricFontSize(e.target.value));

    const setupLangToggle = (id, index) => {
        const chk = document.getElementById(id);
        if (chk) chk.addEventListener('change', (e) => toggleLang(index, e.target.checked));
    };
    setupLangToggle('chkLang0', 0);
    setupLangToggle('chkLang1', 1);
    setupLangToggle('chkLang2', 2);

    // 4. ปุ่มหน้าต่าง Admin Sync
    const btnSyncPrev = document.getElementById('btnSyncPrev');
    if (btnSyncPrev) btnSyncPrev.addEventListener('click', prevLyric);

    const btnSyncNext = document.getElementById('btnSyncNext');
    if (btnSyncNext) btnSyncNext.addEventListener('click', () => nextLyric(false));

    const btnResetSync = document.getElementById('btnResetSync');
    if (btnResetSync) btnResetSync.addEventListener('click', resetSync);

    // 5. ปุ่มแถบสุ่มเพลง
    const btnToggleRandom = document.getElementById('btnToggleRandom');
    if (btnToggleRandom) btnToggleRandom.addEventListener('click', toggleRandomPanel);

    const btnRenderRandom = document.getElementById('btnRenderRandom');
    if (btnRenderRandom) {
        btnRenderRandom.addEventListener('click', () => {
            if (window.renderRandomPlaylist) window.renderRandomPlaylist();
        });
    }

    // 6. แจ้งเตือน และ อื่นๆ
    const btnNotify = document.getElementById('btnDockNotify');
    if (btnNotify) btnNotify.addEventListener('click', openNotifyWindow);

    // 7. จัดการหน้าเพิ่มเพลง (Add / Edit) - ถ้าเป็น Admin
    const btnAddSong = document.getElementById('btnAddSong');
    if (btnAddSong) btnAddSong.addEventListener('click', () => {
        if(window.openAddView) window.openAddView();
    });

    const btnSaveSong = document.getElementById('btnSave');
    if (btnSaveSong) btnSaveSong.addEventListener('click', async () => {
        if (!AppState.isAdmin) return;
        
        const title = document.getElementById('inputTitle').value.trim(); 
        const artist = document.getElementById('inputArtist').value.trim(); 
        const audioPath = document.getElementById('inputAudio').value.trim(); 
        const lyrics = document.getElementById('inputLyrics').value.trim();
        
        if (!title || !lyrics) { 
            alert("ข้อมูลไม่ครบถ้วน"); 
            return; 
        }

        btnSaveSong.disabled = true; 
        btnSaveSong.textContent = "กำลังบันทึก...";

        // โครงสร้างสำหรับเวอร์ชันหน้าแก้ไข 
        // (จริงๆ ส่วนหน้าแก้ไขอาจจะต้องถูกดึงมาทำเป็น Component ต่างหากในอนาคต)
        const validCovers = (window.currentCoversDraft || []).filter(c => c.coverArtist);
        
        const songData = { 
            title, artist, audioPath, lyrics, 
            timestamps: [], singers: [], 
            covers: validCovers 
        };

        const success = await saveSongToDB(songData, window.editingSongId);
        
        if (success) {
            if(window.wm.addWin) window.wm.addWin.close(); 
            // รีเฟรชเพลง (โดยฟังก์ชันใน app.js จะเรียก renderSongList)
            if(window.fetchSongsUI) window.fetchSongsUI(); 
        } else {
            alert("บันทึกไม่สำเร็จ");
        }
        
        btnSaveSong.disabled = false; 
        btnSaveSong.textContent = "💾 บันทึกเพลง"; 
        window.editingSongId = null;
    });
    
    const btnAddCoverForm = document.getElementById('btnAddCoverForm');
    if (btnAddCoverForm) btnAddCoverForm.addEventListener('click', () => {
        if(window.addCoverInput) window.addCoverInput();
    });

});

// --- Helper Functions สำหรับเปลี่ยน UI ทันที ---
function setWallpaper(url) {
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
}

function setWindowStyle() {
    const op = document.getElementById('sliderOpacity').value;
    const blur = document.getElementById('sliderBlur').value;
    const opacityVal = op / 100;
    
    document.documentElement.style.setProperty('--window-opacity', opacityVal);
    document.documentElement.style.setProperty('--window-blur', blur + 'px');
    
    localStorage.setItem('ws_opacity', opacityVal);
    localStorage.setItem('ws_blur', blur);
}

function setLyricFontSize(size) {
    document.documentElement.style.setProperty('--lyric-font-size', size + 'em');
    localStorage.setItem('ws_fontsize', size);
}

function setBgSize(size) {
    document.documentElement.style.setProperty('--bg-size', size);
    localStorage.setItem('ws_bgsize', size);
}

function toggleLang(langIndex, isChecked) {
    const container = document.getElementById('lyricsContainer'); 
    if (!container) return;
    if (isChecked) {
        container.classList.remove(`hide-lang-${langIndex}`); 
    } else {
        container.classList.add(`hide-lang-${langIndex}`);
    }
}

function toggleRandomPanel() {
    const panel = document.getElementById('randomPlaylistPanel');
    const icon = document.getElementById('panelToggleIcon');
    if (!panel || !icon) return;
    
    const isOpen = !panel.classList.contains('open');
    if (isOpen) {
        panel.classList.add('open');
        icon.textContent = '▶';
    } else {
        panel.classList.remove('open');
        icon.textContent = '◀';
    }
}
