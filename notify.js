// notify.js
// ระบบแจ้งเตือนอัปเดตเพลงใหม่ย้อนหลัง 7 วัน
// อัปเดต: ใช้ AppState, DOM API ป้องกัน XSS และเตรียมย้าย Inline CSS ไปยัง style.css

import { AppState } from './state.js';
import { extractYouTubeID, getRelativeDayLabel } from './utils.js';
import { playSong } from './player.js';

export function openNotifyWindow() {
    const badge = document.getElementById('notifyBadge');
    if (badge) badge.style.display = 'none';
    
    localStorage.setItem('lastCheckedNotify', Date.now());

    if (window.wm && window.wm.notifyWin) {
        window.wm.notifyWin.focus();
        return;
    }

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    // ดึงข้อมูลเพลงจาก AppState
    const newSongs = AppState.songsArray.filter(song => song.createdAt && song.createdAt >= sevenDaysAgo);
    newSongs.sort((a, b) => b.createdAt - a.createdAt);

    const mountDiv = document.createElement('div');
    mountDiv.className = 'notify-wrapper'; // ใช้ Class แทน Inline Style

    if (newSongs.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'notify-empty';
        // ใช้ innerHTML ได้ตรงนี้เพราะเป็น static content ไม่มีข้อมูลจาก user
        emptyDiv.innerHTML = `
            <div style="font-size: 45px; margin-bottom: 15px;">📭</div>
            <div style="font-size: 0.95em;">ยังไม่มีเพลงใหม่เข้าคลัง<br>ในรอบ 7 วันนี้ครับ</div>
        `;
        mountDiv.appendChild(emptyDiv);
    } else {
        const groupedSongs = {};
        newSongs.forEach(song => {
            const label = getRelativeDayLabel(song.createdAt);
            if (!groupedSongs[label]) groupedSongs[label] = [];
            groupedSongs[label].push(song);
        });

        const fragment = document.createDocumentFragment();

        for (const [dayLabel, songs] of Object.entries(groupedSongs)) {
            const groupContainer = document.createElement('div');
            groupContainer.style.marginBottom = '20px';

            const labelDiv = document.createElement('div');
            labelDiv.className = 'notify-date-label';
            labelDiv.textContent = dayLabel;
            groupContainer.appendChild(labelDiv);
            
            songs.forEach(song => {
                const videoId = extractYouTubeID(song.audioPath);
                const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';

                const card = document.createElement('div');
                card.className = 'notify-card';

                const img = document.createElement('img');
                img.src = thumbUrl;
                img.className = 'notify-thumb';
                img.onerror = () => img.style.display = 'none';

                const info = document.createElement('div');
                info.className = 'notify-info';

                const title = document.createElement('div');
                title.className = 'notify-title-text';
                title.textContent = song.title; // ป้องกัน XSS

                const artist = document.createElement('div');
                artist.className = 'notify-artist-text';
                artist.textContent = `🎤 ${song.artist || 'ไม่ระบุศิลปิน'}`; // ป้องกัน XSS

                info.append(title, artist);

                const playBtn = document.createElement('button');
                playBtn.className = 'notify-play-btn';
                playBtn.textContent = '▶️';
                
                // ใช้ Event Listener แทน onclick ใน HTML
                playBtn.addEventListener('click', () => {
                    playSong(song.id);
                    if (window.wm && window.wm.notifyWin) window.wm.notifyWin.close();
                });

                card.append(img, info, playBtn);
                groupContainer.appendChild(card);
            });
            
            fragment.appendChild(groupContainer);
        }
        mountDiv.appendChild(fragment);
    }

    if (window.WinBox) {
        window.wm = window.wm || {};
        window.wm.notifyWin = new WinBox("🔔 มีอะไรใหม่ย้อนหลัง 7 วัน", {
            mount: mountDiv,
            width: "350px",
            height: "430px",
            x: "left",
            y: "bottom",
            bottom: 100, 
            left: 30,
            class: ["wb-dark", "no-min"],
            onclose: () => {
                window.wm.notifyWin = null;
            }
        });
    }
}

export function checkNewSongsNotification() {
    const badge = document.getElementById('notifyBadge');
    if (!badge || AppState.songsArray.length === 0) return;

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const lastChecked = parseInt(localStorage.getItem('lastCheckedNotify') || '0');

    // ตรวจสอบข้อมูลจาก AppState
    const hasNewSong = AppState.songsArray.some(song => 
        song.createdAt && 
        song.createdAt >= sevenDaysAgo && 
        song.createdAt > lastChecked
    );

    if (hasNewSong) {
        badge.style.display = 'block'; 
    } else {
        badge.style.display = 'none';  
    }
}
