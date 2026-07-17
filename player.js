// player.js
// รับผิดชอบเกี่ยวกับการเล่นเพลง การซิงค์เวลา YouTube และระบบ Live Activity

import { AppState } from './state.js';
import { extractYouTubeID, getActiveTimestamps } from './utils.js';

export function playSong(id) {
    const song = AppState.getSong(id);
    if (!song) return; // Early Return ช่วยให้อ่านง่ายขึ้น

    // 1. อัปเดต State หลัก
    AppState.currentSongId = id;
    AppState.currentCoverIndex = -1;
    AppState.currentLyricsArray = song.lyrics.split(/\n\s*\n/);
    AppState.currentLyricIndex = -1;

    // 2. จัดการ UI ของ Window & Live Activity
    updateLiveActivityUI(song);
    
    if (window.setRandomPanelState) window.setRandomPanelState(false);
    if (window.wm && window.wm.notifyWin) window.wm.notifyWin.close();

    window.wm.openPlayer(song.title); 
    window.wm.openLyrics(song.title);
    if (window.wm.adminSyncWin) window.wm.adminSyncWin.setTitle("⏱ ซิงค์: " + song.title); 

    // 3. อัปเดตส่วนอื่นๆ (เช่น เนื้อเพลงและแอดมิน จะถูกสร้างเป็น Module ในไฟล์ถัดไป)
    if (window.renderVersionBadges) window.renderVersionBadges();
    if (window.renderTimestampEditor) window.renderTimestampEditor();
    if (window.renderLyricsToContainer) window.renderLyricsToContainer();
    if (window.updateLyricDisplay) window.updateLyricDisplay();

    // 4. โหลด YouTube Player และเปลี่ยน Background
    loadYoutubePlayer(song.audioPath);

    // 5. ตั้งค่า Loop จับเวลา (Sync Interval)
    setupSyncInterval();
}

function updateLiveActivityUI(song) {
    const liveAct = document.getElementById('liveActivity'); 
    const liveDiv = document.getElementById('dockDivider');
    if (liveAct && liveDiv) {
        document.getElementById('liveTitle').textContent = song.title;
        document.getElementById('liveArtist').textContent = `🎤 ${song.artist || '-'}`;
        liveAct.classList.remove('hidden'); 
        liveDiv.classList.remove('hidden');
    }
}

function loadYoutubePlayer(audioPath) {
    const videoId = extractYouTubeID(audioPath); 
    const bgEl = document.getElementById('dynamic-bg');
    
    // ตั้งภาพปกพื้นหลัง
    if (bgEl && videoId) { 
        bgEl.style.backgroundImage = `url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg')`; 
        bgEl.classList.add('active'); 
    }
    
    // ตรวจสอบและสร้าง Player Container
    let playerDiv = document.getElementById('youtubePlayer');
    if (!playerDiv) {
        document.getElementById('content-player').innerHTML = '<div id="youtubePlayer" style="width: 100%; height: 100%;"></div>';
    }

    if (AppState.ytPlayer && typeof AppState.ytPlayer.loadVideoById === 'function') { 
        AppState.ytPlayer.loadVideoById(videoId); 
    } else {
        if (window.isYTApiReady || (window.YT && window.YT.Player)) {
            AppState.ytPlayer = new window.YT.Player('youtubePlayer', { 
                height: '100%', width: '100%', videoId: videoId, 
                playerVars: { 'playsinline': 1, 'controls': 1 }, 
                events: { 'onStateChange': window.onPlayerStateChange } // onPlayerStateChange จะต้องไปอัปเดตเพื่อใช้ AppState ด้วย
            });
        }
    }
}

function setupSyncInterval() {
    clearInterval(AppState.syncInterval);
    AppState.syncInterval = setInterval(() => {
        if (!AppState.ytPlayer || typeof AppState.ytPlayer.getCurrentTime !== 'function') return;
        
        const currentSong = AppState.getSong(AppState.currentSongId); 
        if (!currentSong) return;
        
        const activeTimestamps = getActiveTimestamps(currentSong, AppState.currentCoverIndex);
        const currentTime = AppState.ytPlayer.getCurrentTime(); 
        if (currentTime === undefined || currentTime === 0) return;

        let correctIndex = -1;
        for (let i = 0; i < activeTimestamps.length; i++) {
            if (activeTimestamps[i] != null && currentTime >= activeTimestamps[i]) {
                correctIndex = i;
            }
        }
        
        // อัปเดตเนื้อเพลงเฉพาะเมื่อ Index เปลี่ยน
        if (AppState.currentLyricIndex !== correctIndex) {
            AppState.currentLyricIndex = correctIndex; 
            if (window.updateLyricDisplay) window.updateLyricDisplay();
        }
    }, 100); 
}

// ==========================================
// ควบคุมเพลงจากแถบ Live Activity
// ==========================================
export function toggleLivePlay() {
    if (!AppState.ytPlayer || typeof AppState.ytPlayer.getPlayerState !== 'function') return;
    const state = AppState.ytPlayer.getPlayerState();
    if (state === 1) AppState.ytPlayer.pauseVideo();
    else AppState.ytPlayer.playVideo();
}

export function nextLiveSong() {
    if (AppState.songsArray.length === 0 || !AppState.currentSongId) return;
    
    if (AppState.isShuffleEnabled) {
        let randomIndex = Math.floor(Math.random() * AppState.songsArray.length);
        if (AppState.songsArray.length > 1) {
            const currentIdx = AppState.songsArray.findIndex(s => s.id === AppState.currentSongId);
            while (randomIndex === currentIdx) {
                randomIndex = Math.floor(Math.random() * AppState.songsArray.length);
            }
        }
        playSong(AppState.songsArray[randomIndex].id);
    } else {
        const currentIdx = AppState.songsArray.findIndex(s => s.id === AppState.currentSongId);
        const nextIndex = currentIdx + 1 < AppState.songsArray.length ? currentIdx + 1 : 0;
        playSong(AppState.songsArray[nextIndex].id);
    }
}

export function prevLiveSong() {
    if (AppState.songsArray.length === 0 || !AppState.currentSongId) return;
    
    const currentIdx = AppState.songsArray.findIndex(s => s.id === AppState.currentSongId);
    const prevIndex = currentIdx - 1 >= 0 ? currentIdx - 1 : AppState.songsArray.length - 1;
    playSong(AppState.songsArray[prevIndex].id);
}
