// ==========================================
// pip.js - ระบบหน้าต่างเนื้อเพลงลอยอิสระ (Document Picture-in-Picture)
// อัปเดต: ดีไซน์ Glassmorphism พื้นหลังกระจกฝ้า + แผ่นเสียงหมุนได้!
// ==========================================

let pipWindow = null;
let lastTrackKey = null; 

window.togglePiPMode = async function() {
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
                margin: 0; padding: 0; color: #fff; 
                display: flex; flex-direction: column; 
                height: 100vh; overflow: hidden; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
                
                /* 🟢 พื้นหลังเต็มจอรับรูปภาพ */
                background-color: #0a0a0c;
                background-image: var(--pip-bg-image, none);
                background-size: cover;
                background-position: center;
                transition: background-image 1s ease;
            }
            
            /* =========================================
               🎧 โหมดเริ่มต้น (Full Layout)
               ========================================= */
            #pip-header {
                display: flex; align-items: center; gap: 15px;
                padding: 20px 20px;
                background-color: #1c1c1e;
                background-image: linear-gradient(to right, rgba(15, 15, 20, 0.95) 40%, rgba(10, 132, 255, 0.2)), var(--pip-header-bg, none);
                background-size: cover;
                background-position: center;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }

            /* 🟢 ทำภาพปกให้เป็นวงกลม และหมุนเหมือนแผ่นเสียง */
            #pip-cover {
                width: 65px; height: 65px;
                border-radius: 50%; /* เปลี่ยนเป็นวงกลม */
                object-fit: cover;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5), 0 0 0 4px #1c1c1e; /* สร้างขอบแผ่นเสียง */
                background: #1c1c1e; 
                display: none; 
                flex-shrink: 0;
                animation: spinRecord 12s linear infinite; /* สั่งหมุน */
            }

            @keyframes spinRecord {
                100% { transform: rotate(360deg); }
            }

            /* 🟢 หยุดหมุนเวลาเพลงหยุด */
            body.is-paused #pip-cover {
                animation-play-state: paused;
            }
            
            #pip-info {
                display: flex; flex-direction: column; justify-content: center;
                flex: 1; overflow: hidden;
                transition: all 0.6s ease;
                -webkit-mask-image: linear-gradient(90deg, #000 95%, transparent 100%);
                mask-image: linear-gradient(90deg, #000 95%, transparent 100%);
            }
            
            .scroll-box { width: 100%; overflow: hidden; white-space: nowrap; }
            .scroll-text { display: inline-block; transition: all 0.6s ease; }
            
            #pip-title-text { font-size: 17px; font-weight: bold; color: #0a84ff; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
            #pip-artist-text { font-size: 13px; color: #ccc; margin-top: 4px; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }

            @keyframes scroll-overflow {
                0%, 15% { transform: translateX(0); }
                85%, 100% { transform: translateX(var(--scroll-dist)); }
            }
            
            #pip-timer {
                font-family: monospace; font-size: 13px; color: #ddd;
                font-weight: bold; text-align: right;
                opacity: 0; transform: translateX(10px);
                max-width: 0; overflow: hidden;
                transition: all 0.6s cubic-bezier(0.25, 1, 0.5, 1);
                text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            }
            #pip-progress-container {
                width: 100%; height: 4px;
                background: rgba(255, 255, 255, 0.15);
                transition: all 0.6s ease;
                z-index: 10;
            }
            #pip-progress-bar {
                width: 0%; height: 100%;
                background: #0a84ff; 
                transition: width 0.2s linear, background 0.6s ease, box-shadow 0.6s ease; 
            }

            /* =========================================
               🚀 โหมดเล่นเพลง (Compact Mode)
               ========================================= */
            body.compact-mode #pip-header { padding: 12px 15px; } /* ลบ background: transparent ออกแล้ว */
            body.compact-mode #pip-cover { width: 40px; height: 40px; box-shadow: 0 2px 6px rgba(0,0,0,0.5), 0 0 0 2px #1c1c1e; }
            body.compact-mode #pip-title-text { font-size: 15px; color: #fff; }
            body.compact-mode #pip-artist-text { font-size: 11px !important; opacity: 0.8; margin-top: 2px; }
            body.compact-mode #pip-timer { opacity: 1; transform: translateX(0); max-width: 100px; padding-left: 10px; }
            body.compact-mode #pip-progress-container { height: 2px; background: rgba(255,255,255,0.2); box-shadow: 0 0 10px rgba(10, 132, 255, 0.3); }
            body.compact-mode #pip-progress-bar { background: #00d2ff; box-shadow: 0 0 8px #00d2ff; }

            /* =========================================
               📝 พื้นที่เนื้อเพลง (Glassmorphism)
               ========================================= */
            #pip-lyrics {
                flex-grow: 1; display: flex; flex-direction: column; 
                justify-content: center; align-items: center; 
                padding: 15px; text-align: center; box-sizing: border-box;
                width: 100%; overflow: hidden; 
                
                /* 🟢 ใส่เอฟเฟกต์กระจกฝ้าทับรูปปกเต็มจอ */
                background: rgba(0, 0, 0, 0.55);
                backdrop-filter: blur(45px) saturate(150%);
                -webkit-backdrop-filter: blur(45px) saturate(150%);
                box-shadow: inset 0 20px 50px rgba(0,0,0,0.5); 
            }
            
            #current-lyric-text {
                font-size: clamp(20px, 6vmin, 44px); font-weight: 800; line-height: 1.25; 
                width: 100%; word-wrap: break-word; overflow-wrap: break-word; white-space: normal;
                color: #fff; text-shadow: 0 0 15px rgba(255,255,255,0.4), 0 2px 5px rgba(0,0,0,0.8); 
            }

            @keyframes lyricEnter {
                0% { opacity: 0; transform: translateY(15px); filter: blur(3px); }
                100% { opacity: 1; transform: translateY(0); filter: blur(0); }
            }

            #current-lyric-text div[class^="lang-"] { margin-bottom: 8px; }
            #current-lyric-text .reading-text { color: #ffd700 !important; text-shadow: 0 0 15px rgba(255, 215, 0, 0.4), 1px 2px 3px rgba(0,0,0,0.8) !important; }
            #current-lyric-text .lang-1:not(.reading-text), #current-lyric-text .lang-2, #current-lyric-text .lang-3 { font-size: 0.85em; color: #e0e0e5; }

            /* =========================================
               🎲 โหมดสุ่มเพลง (Idle/Random Playlist)
               ========================================= */
            .pip-random-item {
                display: flex; align-items: center; gap: 12px;
                background: rgba(255, 255, 255, 0.08); padding: 8px 12px;
                border-radius: 12px; cursor: pointer;
                border: 1px solid rgba(255, 255, 255, 0.05);
                transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1);
                text-shadow: none; 
            }
            .pip-random-item:hover {
                background: rgba(10, 132, 255, 0.25);
                border-color: rgba(10, 132, 255, 0.4);
                transform: translateY(-2px);
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            }
            .pip-random-thumb {
                width: 45px; height: 45px; border-radius: 8px; 
                object-fit: cover; box-shadow: 0 2px 6px rgba(0,0,0,0.5);
            }
            .pip-random-info { flex: 1; overflow: hidden; text-align: left; }
            .pip-random-title { font-size: 14px; font-weight: bold; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
            .pip-random-artist { font-size: 11px; color: #ccc; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

            /* 🎵 ลูกเล่นพิเศษ: ดนตรี, ป้ายชื่อ, คอรัส */
            .lyric-instrumental { display: flex; justify-content: center; align-items: center; gap: 15px; font-size: 1.5em; height: 60px; }
            .lyric-instrumental .note { color: #00d2ff !important; opacity: 0.5; animation: bounceNote 1.2s infinite ease-in-out alternate; }
            .lyric-instrumental .note:nth-child(2) { animation-delay: 0.3s; }
            .lyric-instrumental .note:nth-child(3) { animation-delay: 0.6s; }
            @keyframes bounceNote { 0% { transform: translateY(0) scale(1); opacity: 0.3; } 100% { transform: translateY(-10px) scale(1.2); opacity: 1; color: #fff; filter: drop-shadow(0 0 10px #00d2ff); } }
            .singer-badges { display: flex; gap: 8px; margin-bottom: 12px; justify-content: center; flex-wrap: wrap; }
            .singer-badge { font-size: 14px; padding: 4px 12px; border-radius: 20px; color: #fff !important; border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 0 10px rgba(255,255,255,0.5); text-shadow: none !important; line-height: 1; }
            .dual-lyric { display: flex; flex-direction: column; align-items: center; width: 100%; margin-bottom: 10px; }
            .lyric-main { text-align: center; width: 100%; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.8); }
            .lyric-sub {
                display: block; text-align: center; background: linear-gradient(90deg, #ff9a9e, #fecfef, #a1c4fd, #c2e9fb, #ff9a9e); background-size: 200% auto;
                -webkit-background-clip: text; -webkit-text-fill-color: transparent !important;
                animation: rainbowFlow 4s linear infinite; font-size: 0.75em; font-style: italic; font-weight: bold; max-width: 90%; word-wrap: break-word; margin-top: 4px;
            }
            @keyframes rainbowFlow { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }
        `;
        pipWindow.document.head.appendChild(style);

        // 2. สร้างโครงสร้างหน้าต่าง (HTML) 
        pipWindow.document.body.innerHTML = `
            <div id="pip-header">
                <img id="pip-cover" src="" alt="cover">
                <div id="pip-info">
                    <div class="scroll-box"><div id="pip-title-text" class="scroll-text">กำลังโหลด...</div></div>
                    <div class="scroll-box"><div id="pip-artist-text" class="scroll-text">🎤 -</div></div>
                </div>
                <div id="pip-timer">00:00</div>
            </div>
            <div id="pip-progress-container">
                <div id="pip-progress-bar"></div>
            </div>
            <div id="pip-lyrics">
                <div id="current-lyric-text"></div>
            </div>
        `;

        const formatTime = (seconds) => {
            if (isNaN(seconds) || seconds < 0) return "00:00";
            const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60);
            return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
        };

        pipWindow.lastLyricIndex = -1;

        // 3. ระบบอัปเดตข้อมูลแบบ Real-time
        pipWindow.syncInterval = setInterval(() => {
            
            // ============================================================
            // 🟢 จัดการสถานะ "ไม่มีเพลงเล่น" (เปลี่ยนเป็นหน้าต่างสุ่มเพลง)
            // ============================================================
            if (!window.currentSongId || !window.songs || window.songs.length === 0) {
                if (lastTrackKey !== 'IDLE') {
                    lastTrackKey = 'IDLE';
                    pipWindow.lastLyricIndex = -1;
                    
                    // ปิด Compact Mode เพื่อให้หน้าจอไม่พับ
                    pipWindow.document.body.classList.remove('compact-mode');
                    pipWindow.document.body.classList.remove('is-paused');
                    
                    // รีเซ็ต Header เป็นแบบชิลๆ
                    const titleText = pipWindow.document.getElementById('pip-title-text');
                    const artistText = pipWindow.document.getElementById('pip-artist-text');
                    
                    // 🟢 ล้างภาพพื้นหลังออกทั้งหมดตอนอยู่หน้า Idle
                    const pipHeader = pipWindow.document.getElementById('pip-header');
                    if (pipHeader) pipHeader.style.removeProperty('--pip-header-bg'); 
                    pipWindow.document.body.style.removeProperty('--pip-bg-image');
                    
                    titleText.innerText = '🎲 โหมดสุ่มเพลง';
                    artistText.innerText = 'คลิกเลือกเพลงจากรายการด้านล่าง';
                    
                    // หยุดการเลื่อนข้อความ (ถ้ามีค้างอยู่)
                    titleText.style.animation = 'none'; titleText.style.transform = 'translateX(0)';
                    artistText.style.animation = 'none'; artistText.style.transform = 'translateX(0)';
                    
                    pipWindow.document.getElementById('pip-cover').style.display = 'none';
                    pipWindow.document.getElementById('pip-timer').innerText = '00:00';
                    pipWindow.document.getElementById('pip-progress-bar').style.width = '0%';
                    
                    // 🌟 สร้างลิสต์สุ่ม 4 เพลงเพื่อแสดงผล
                    const shuffled = [...window.songs].sort(() => 0.5 - Math.random());
                    const selected = shuffled.slice(0, 4); 
                    
                    let html = '<div style="width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 8px; margin: 0 auto;">';
                    selected.forEach(song => {
                        const videoId = window.extractYouTubeID(song.audioPath);
                        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
                        html += `
                            <div class="pip-random-item" data-id="${song.id}">
                                <img class="pip-random-thumb" src="${thumbUrl}" onerror="this.style.display='none'">
                                <div class="pip-random-info">
                                    <div class="pip-random-title">${song.title}</div>
                                    <div class="pip-random-artist">🎤 ${song.artist || '-'}</div>
                                </div>
                                <div style="color: #0a84ff; font-size: 16px; padding-left: 5px;">▶</div>
                            </div>
                        `;
                    });
                    html += '</div>';
                    
                    const lyricBox = pipWindow.document.getElementById('current-lyric-text');
                    lyricBox.style.animation = 'none';
                    lyricBox.style.fontSize = '16px'; // ล็อกขนาดฟอนต์ไว้ไม่ให้ใหญ่เกิน
                    lyricBox.innerHTML = html;
                    
                    // ผูกคำสั่งให้คลิกเล่นเพลงจากใน PiP ได้เลย
                    const items = pipWindow.document.querySelectorAll('.pip-random-item');
                    items.forEach(item => {
                        item.onclick = () => {
                            const songId = item.getAttribute('data-id');
                            if (typeof window.playSong === 'function') {
                                window.playSong(songId);
                            }
                        };
                    });
                }
                return; // ⛔️ หยุดทำงานโค้ดส่วนของเนื้อเพลง เพราะตอนนี้ไม่มีเพลงเล่น
            }
            
            // ============================================================
            // 🟢 สถานะ "มีเพลงเล่นอยู่" (อัปเดตเพลงและเนื้อร้อง)
            // ============================================================
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (!song) return;
            
            let currentKey = song.id + "_" + (window.currentCoverIndex || -1);

            if (lastTrackKey !== currentKey) {
                lastTrackKey = currentKey;
                pipWindow.lastLyricIndex = -1; 
                
                pipWindow.document.getElementById('current-lyric-text').innerHTML = '<span style="color:#ccc !important; text-shadow:none;">🎵 กำลังรอเนื้อเพลง...</span>';
                
                let targetVideoPath = song.audioPath;
                let displayArtist = song.artist || 'ไม่ระบุศิลปิน';
                
                if (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]) {
                    targetVideoPath = song.covers[window.currentCoverIndex].audioPath;
                    if(song.covers[window.currentCoverIndex].coverArtist) displayArtist = song.covers[window.currentCoverIndex].coverArtist;
                }

                const titleText = pipWindow.document.getElementById('pip-title-text');
                const artistText = pipWindow.document.getElementById('pip-artist-text');
                
                titleText.innerText = song.title;
                artistText.innerText = `🎤 ${displayArtist}`;
                
                const applyScroll = (el) => {
                    el.style.animation = 'none';
                    el.style.transform = 'translateX(0)';
                    setTimeout(() => {
                        if (!pipWindow || !pipWindow.document) return;
                        const parent = el.parentElement;
                        if (el.scrollWidth > parent.clientWidth) {
                            const distance = el.scrollWidth - parent.clientWidth + 15; 
                            const speed = Math.max(4, distance / 15); 
                            el.style.setProperty('--scroll-dist', `-${distance}px`);
                            el.style.animation = `scroll-overflow ${speed}s linear infinite`;
                        }
                    }, 200);
                };
                
                applyScroll(titleText);
                applyScroll(artistText);
                
                const coverImg = pipWindow.document.getElementById('pip-cover');
                
                // 🟢 ดึงรูปปกไปใส่ Header และพื้นหลังเต็มจอ
                const pipHeader = pipWindow.document.getElementById('pip-header');
                const ytId = window.extractYouTubeID(targetVideoPath);
                
                if (ytId) {
                    const thumbUrl = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
                    const hqUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                    
                    coverImg.src = hqUrl;
                    coverImg.style.display = 'block';
                    
                    if (pipHeader) {
                        pipHeader.style.setProperty('--pip-header-bg', `url('${thumbUrl}')`);
                    }
                    pipWindow.document.body.style.setProperty('--pip-bg-image', `url('${hqUrl}')`);
                } else {
                    coverImg.style.display = 'none';
                    if (pipHeader) {
                        pipHeader.style.removeProperty('--pip-header-bg');
                    }
                    pipWindow.document.body.style.removeProperty('--pip-bg-image');
                }
            }

            if (window.currentLyricIndex !== pipWindow.lastLyricIndex) {
                pipWindow.lastLyricIndex = window.currentLyricIndex;
                
                const activeLine = document.querySelector('.lyric-line.active');
                const lyricBox = pipWindow.document.getElementById('current-lyric-text');
                const wrapper = pipWindow.document.getElementById('pip-lyrics');

                if (activeLine) {
                    lyricBox.innerHTML = activeLine.innerHTML;
                } else {
                    lyricBox.innerHTML = '<span style="color:#ccc !important; text-shadow:none;">🎵 กำลังรอเนื้อเพลง...</span>';
                }

                // 🟢 แอนิเมชัน Smooth Fade & Slide Up
                lyricBox.style.animation = 'none'; 
                void lyricBox.offsetWidth; // บังคับล้างค่าเบราว์เซอร์กันกระตุก
                lyricBox.style.animation = 'lyricEnter 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards'; 

                lyricBox.style.fontSize = ''; 
                setTimeout(() => {
                    if (!pipWindow || !pipWindow.document) return;
                    let currentSize = parseFloat(pipWindow.getComputedStyle(lyricBox).fontSize);
                    while (lyricBox.scrollHeight > wrapper.clientHeight - 20 && currentSize > 14) {
                        currentSize -= 1;
                        lyricBox.style.fontSize = currentSize + 'px';
                    }
                }, 10);
            }

            const playerObj = window.ytPlayer || window.player; 
            if (playerObj && typeof playerObj.getCurrentTime === 'function') {
                const currentTime = playerObj.getCurrentTime();
                const duration = playerObj.getDuration();
                
                // 🟢 เช็กสถานะการเล่นว่าหยุดพัก (Pause) อยู่หรือไม่ เพื่อสั่งหยุดแผ่นเสียง
                if (typeof playerObj.getPlayerState === 'function') {
                    const state = playerObj.getPlayerState();
                    if (state === 2 || state === 0) { // 2 = Paused, 0 = Ended
                        pipWindow.document.body.classList.add('is-paused');
                    } else {
                        pipWindow.document.body.classList.remove('is-paused');
                    }
                }
                
                if (duration > 0) {
                    const percent = (currentTime / duration) * 100;
                    pipWindow.document.getElementById('pip-progress-bar').style.width = `${percent}%`;
                }

                pipWindow.document.getElementById('pip-timer').innerText = `${formatTime(currentTime)} / ${formatTime(duration)}`;

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
};
