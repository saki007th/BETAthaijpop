// pip.js
// ระบบหน้าต่างเนื้อเพลงลอยอิสระ (Document Picture-in-Picture)
// อัปเดต: เปลี่ยนมาใช้ AppState และ ES Modules

import { AppState } from './state.js';
import { extractYouTubeID } from './utils.js';

let pipWindow = null;
let lastTrackKey = null; 

export async function togglePiPMode() {
    if (!('documentPictureInPicture' in window)) {
        alert('เบราว์เซอร์ของคุณยังไม่รองรับระบบหน้าต่างลอยอิสระครับ \n(แนะนำ Google Chrome บน PC)');
        return;
    }

    if (pipWindow) {
        pipWindow.close();
        return;
    }

    try {
        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 400,
            height: 480 
        });

        // 1. ใส่สไตล์ CSS
        const style = document.createElement('style');
        style.textContent = `
            body { 
                margin: 0; padding: 0; background: #0a0a0c; color: #fff; 
                display: flex; flex-direction: column; 
                height: 100vh; overflow: hidden; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
                transition: background 0.5s ease;
            }
            
            #pip-header {
                display: flex; align-items: center; gap: 15px;
                padding: 20px 20px;
                background: rgba(255, 255, 255, 0.05);
                transition: all 0.6s cubic-bezier(0.25, 1, 0.5, 1);
            }
            #pip-cover {
                width: 65px; height: 65px;
                border-radius: 12px; object-fit: cover;
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
                background: #1c1c1e; 
                display: none; 
                transition: all 0.6s cubic-bezier(0.25, 1, 0.5, 1);
            }
            #pip-info {
                display: flex; flex-direction: column; justify-content: center;
                flex: 1; overflow: hidden;
                transition: all 0.6s ease;
            }
            #pip-title {
                font-size: 17px; font-weight: bold; color: #0a84ff;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                transition: all 0.6s ease;
            }
            #pip-artist {
                font-size: 13px; color: #8e8e93; margin-top: 4px;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                max-height: 20px; opacity: 1;
                transition: all 0.4s ease;
            }
            
            #pip-timer {
                font-family: monospace; font-size: 13px; color: #aaa;
                font-weight: bold; text-align: right;
                opacity: 0; transform: translateX(10px);
                max-width: 0; overflow: hidden;
                transition: all 0.6s cubic-bezier(0.25, 1, 0.5, 1);
            }
            
            #pip-progress-container {
                width: 100%; height: 4px;
                background: rgba(255, 255, 255, 0.08);
                transition: all 0.6s ease;
            }
            #pip-progress-bar {
                width: 0%; height: 100%;
                background: #0a84ff; 
                transition: width 0.2s linear, background 0.6s ease, box-shadow 0.6s ease; 
            }

            body.compact-mode #pip-header {
                padding: 12px 15px;
                background: transparent; 
            }
            body.compact-mode #pip-cover {
                width: 32px; height: 32px; 
                border-radius: 6px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.5);
            }
            body.compact-mode #pip-title {
                font-size: 15px; color: #fff; 
            }
            body.compact-mode #pip-artist {
                opacity: 0; max-height: 0; margin-top: 0; 
            }
            body.compact-mode #pip-timer {
                opacity: 1; transform: translateX(0); max-width: 100px; 
            }
            body.compact-mode #pip-progress-container {
                height: 1px; 
                background: rgba(255,255,255,0.15);
                box-shadow: 0 0 10px rgba(10, 132, 255, 0.3);
            }
            body.compact-mode #pip-progress-bar {
                background: #00d2ff;
                box-shadow: 0 0 8px #00d2ff; 
            }

            #pip-lyrics {
                flex-grow: 1; 
                display: flex; flex-direction: column; 
                justify-content: center; align-items: center; 
                padding: 4vmin; text-align: center; box-sizing: border-box;
                background: radial-gradient(circle at center, #1c1c1e 0%, #0a0a0c 100%);
            }
            #current-lyric-text {
                font-size: clamp(16px, 6vmin, 60px); 
                font-weight: 800; line-height: 1.4; width: 100%;
                transition: font-size 0.2s ease;
            }
            #current-lyric-text * { 
                color: #ffffff !important; 
                text-shadow: 0 2px 8px rgba(0,0,0,0.8);
                display: block; margin-bottom: 2vmin; 
            }
            #current-lyric-text span:not(:first-child) {
                font-size: 0.7em; color: #a0a0a5 !important; font-weight: 600;
            }
        `;
        pipWindow.document.head.appendChild(style);

        // 2. สร้างโครงสร้างหน้าต่าง
        // อนุญาตให้ใช้ innerHTML ได้เนื่องจากไม่มีการรับข้อมูลจากผู้ใช้ (User Input) เข้ามาแทรกในส่วนนี้
        pipWindow.document.body.innerHTML = `
            <div id="pip-header">
                <img id="pip-cover" src="" alt="cover" onerror="this.style.display='none'">
                <div id="pip-info">
                    <div id="pip-title">กำลังรอเพลง...</div>
                    <div id="pip-artist">🎤 -</div>
                </div>
                <div id="pip-timer">00:00</div>
            </div>
            <div id="pip-progress-container">
                <div id="pip-progress-bar"></div>
            </div>
            <div id="pip-lyrics">
                <div id="current-lyric-text">
                    <span style="color:#8e8e93 !important; text-shadow:none;">🎵 กำลังรอเนื้อเพลง...</span>
                </div>
            </div>
        `;

        const formatTime = (seconds) => {
            if (isNaN(seconds) || seconds < 0) return "00:00";
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
        };

        // 3. ระบบอัปเดตข้อมูลแบบ Real-time โดยดึงจาก AppState
        pipWindow.syncInterval = setInterval(() => {
            if (!AppState.currentSongId || AppState.songsArray.length === 0) return;
            const song = AppState.getSong(AppState.currentSongId);
            if (!song) return;
            
            // --- ระบบ A: ตรวจจับการเปลี่ยนเพลง และ เวอร์ชัน Cover ---
            let currentKey = song.id + "_" + (AppState.currentCoverIndex || -1);

            if (lastTrackKey !== currentKey) {
                lastTrackKey = currentKey;
                
                pipWindow.document.getElementById('current-lyric-text').innerHTML = '<span style="color:#8e8e93 !important; text-shadow:none;">🎵 กำลังรอเนื้อเพลง...</span>';
                
                let targetVideoPath = song.audioPath;
                let displayArtist = song.artist || 'ไม่ระบุศิลปิน';
                
                if (AppState.currentCoverIndex >= 0 && song.covers && song.covers[AppState.currentCoverIndex]) {
                    targetVideoPath = song.covers[AppState.currentCoverIndex].audioPath;
                    if(song.covers[AppState.currentCoverIndex].coverArtist) displayArtist = song.covers[AppState.currentCoverIndex].coverArtist;
                }

                pipWindow.document.getElementById('pip-title').textContent = song.title; // ป้องกัน XSS
                pipWindow.document.getElementById('pip-artist').textContent = `🎤 ${displayArtist}`; // ป้องกัน XSS
                
                const coverImg = pipWindow.document.getElementById('pip-cover');
                const ytId = extractYouTubeID(targetVideoPath);
                if (ytId) {
                    coverImg.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                    coverImg.style.display = 'block';
                } else {
                    coverImg.style.display = 'none';
                }
            }

            // --- ระบบ B: อัปเดตเนื้อเพลงท่อนปัจจุบัน ---
            const activeLine = document.querySelector('.lyric-line.active');
            if (activeLine) {
                // คัดลอกโครงสร้าง HTML จากหน้าหลักมาใส่ในหน้าต่างลอย (ปลอดภัยเพราะต้นทางสร้างด้วย createElement แล้ว)
                pipWindow.document.getElementById('current-lyric-text').innerHTML = activeLine.innerHTML;
            }

            // --- ระบบ C: จัดการ Progress, Timer และ แอนิเมชัน Compact Mode ---
            const playerObj = AppState.ytPlayer; 
            if (playerObj && typeof playerObj.getCurrentTime === 'function') {
                const currentTime = playerObj.getCurrentTime();
                const duration = playerObj.getDuration();
                
                if (duration > 0) {
                    const percent = (currentTime / duration) * 100;
                    pipWindow.document.getElementById('pip-progress-bar').style.width = `${percent}%`;
                }

                pipWindow.document.getElementById('pip-timer').textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;

                if (currentTime > 3) {
                    pipWindow.document.body.classList.add('compact-mode');
                } else {
                    pipWindow.document.body.classList.remove('compact-mode');
                }
            }
        }, 150); 

        // 4. ล้างข้อมูลเมื่อปิดหน้าต่าง
        pipWindow.addEventListener('pagehide', () => {
            clearInterval(pipWindow.syncInterval); 
            lastTrackKey = null;
            pipWindow = null;
        });

    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเปิด PiP:', error);
    }
}
