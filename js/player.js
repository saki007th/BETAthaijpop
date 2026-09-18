// ==========================================
// player.js - YouTube playback, lyric sync, timestamp editor, calibration
// ==========================================
import { db, doc, updateDoc } from './config.js';

window.currentLyricsArray = [];
window.currentLyricIndex = -1;
window.editingSongId = null;
window.currentSongId = null;
window.ytPlayer = null;
window.syncInterval = null;
window.isYTApiReady = false;
window.currentCoverIndex = -1;

window.onYouTubeIframeAPIReady = function() { window.isYTApiReady = true; };
const ytTag = document.createElement('script'); ytTag.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(ytTag);

// ==========================================
// 🎬 ป้ายแสดงความละเอียดวิดีโอ (ที่หน้าเครื่องเล่น)
// ==========================================
window._lastVideoQuality = null;

window.formatVideoQuality = function(q) {
    const map = {
        'highres': '4K',
        'hd2160': '4K',
        'hd1440': '2K',
        'hd1080': 'HD+',
        'hd720': 'HD',
        'large': 'SD',
        'medium': '360p',
        'small': '240p',
        'tiny': '144p'
    };
    return map[q] || (q && q !== 'auto' && q !== 'unknown' ? String(q) : null);
};

// หา resolution จริงจาก video element ภายใน YT player (HTML5)
window.qualityFromVideoSize = function() {
    try {
        let v = null;
        if (window.ytPlayer && typeof window.ytPlayer.getVideoElement === 'function') {
            v = window.ytPlayer.getVideoElement();
        }
        if (v && v.videoWidth && v.videoHeight) {
            const h = v.videoHeight;
            if (h >= 4320) return '8K';
            if (h >= 2160) return '4K';
            if (h >= 1440) return '2K';
            if (h >= 1080) return 'HD+';
            if (h >= 720) return 'HD';
            if (h >= 480) return 'SD';
            if (h >= 360) return '360p';
            if (h >= 240) return '240p';
            return '144p';
        }
    } catch (e) {}
    return null;
};

window.updateVideoQuality = function(qEvent) {
    const el = document.getElementById('npVideoQuality');
    if (!el) return;

    let q = null;
    if (qEvent && typeof qEvent.data === 'string') q = qEvent.data;
    else if (qEvent && typeof qEvent === 'string') q = qEvent;

    if (!q || q === 'unknown') {
        if (window.ytPlayer) {
            if (typeof window.ytPlayer.getVideoQuality === 'function') {
                try { q = window.ytPlayer.getVideoQuality(); } catch (e) {}
            }
            if ((!q || q === 'unknown' || q === 'auto') && typeof window.ytPlayer.getPlaybackQuality === 'function') {
                try { q = window.ytPlayer.getPlaybackQuality(); } catch (e) {}
            }
        }
    }

    let label = window.formatVideoQuality(q);
    if (!label) label = window.qualityFromVideoSize();
    if (!label && window._lastVideoQuality) label = window._lastVideoQuality;

    if (label) {
        window._lastVideoQuality = label;
        el.textContent = label;
        el.title = 'ความละเอียดวิดีโอ: ' + window.qualityLabelDetail(label, q);
    }
};

window.qualityLabelDetail = function(label, q) {
    const map = { 'hd2160':'2160p', 'hd1440':'1440p', 'hd1080':'1080p', 'hd720':'720p', 'large':'480p', 'medium':'360p', 'small':'240p', 'tiny':'144p', 'highres':'สูงกว่า 1080p' };
    const detail = (q && map[q]) ? map[q] : null;
    return detail && label ? label + ' (' + detail + ')' : label;
};

// ==========================================
// 📡 ดึงความละเอียดจริงจาก YT iframe ผ่าน widget postMessage
// (getPlaybackQuality ใช้ไม่ได้กับ HTML5 embed)
// ==========================================
window.ytQualityPingId = 0;
window._lastQualityPing = 0;

window.pingYTQuality = function() {
    const iframe = document.querySelector('#youtubePlayer iframe');
    if (!iframe || !iframe.contentWindow || !window.ytPlayer) return;
    window.ytQualityPingId++;
    try {
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'listening',
            id: window.ytQualityPingId,
            channel: 'widget'
        }), 'https://www.youtube.com');
    } catch (e) {}
};

window.yy_origin_ok = function(origin) {
    return typeof origin === 'string' &&
        (origin === 'https://www.youtube.com' || origin === 'https://www.youtube-nocookie.com' || origin === 'https://youtube.com');
};

window.addEventListener('message', function(e) {
    if (!window.yy_origin_ok(e.origin)) return;
    let msg = null;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    if (!msg || msg.channel !== 'widget' || !msg.infoDelivery) return;
    const info = msg.infoDelivery || {};
    const q = info.currentQuality || info.playbackQuality || null;
    if (q) window.updateVideoQuality(q);
});

// ==========================================
// เวลาซิงค์ & คนร้อง (รองรับเวอร์ชัน Cover)
// ==========================================
window.getActiveTimestamps = function(song) {
    if (!song) return [];
    if (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]) {
        const coverTs = song.covers[window.currentCoverIndex].timestamps;
        if (coverTs && coverTs.some(t => t != null)) return coverTs;
    }
    return song.timestamps || [];
};

window.getActiveSingers = function(song) {
    if (!song) return [];
    if (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]) {
        const coverSg = song.covers[window.currentCoverIndex].singers;
        if (coverSg && coverSg.some(s => s !== "")) return coverSg;
    }
    return song.singers || [];
};

window.renderLyricsToContainer = function() {
    const container = document.getElementById('lyricsContainer'); if (!container) return;
    container.innerHTML = ''; if (window.currentLyricsArray.length === 0) { container.innerHTML = 'ไม่มีเนื้อเพลง'; return; }
    const song = window.songs.find(s => s.id === window.currentSongId);

    window.currentLyricsArray.forEach((lyric, index) => {
        const lineDiv = document.createElement('div'); lineDiv.className = 'lyric-line'; lineDiv.id = `lyric-line-${index}`;

        lineDiv.onclick = () => {
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (song && window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') {
                const activeTimestamps = window.getActiveTimestamps(song);
                if (activeTimestamps[index] != null) {
                    window.ytPlayer.seekTo(activeTimestamps[index], true);
                    window.currentLyricIndex = index;
                    window.updateLyricDisplay();
                }
            }
        };

        let linesHtml = "";
        const cleanLyric = lyric.trim();

        if (cleanLyric === '[ดนตรี]') {
            linesHtml = `
                <div class="lyric-instrumental">
                    <span class="note">🎵</span><span class="note">🎶</span><span class="note">🎵</span>
                </div>
            `;
        } else {
            const validLines = cleanLyric.split('\n').filter(l => l.trim() !== '');
            linesHtml = validLines.map((l, i) => {
                const isMiddle = (i > 0 && i < validLines.length - 1);
                const highlightClass = isMiddle ? ' reading-text' : '';
                if (l.includes('||')) {
                    let parts = l.split('||');
                    return `<div class="lang-${i} dual-lyric${highlightClass}"><span class="lyric-main">${parts[0].trim()}</span><span class="lyric-sub">${parts[1].trim()}</span></div>`;
                } else {
                    return `<div class="lang-${i}${highlightClass}">${l}</div>`;
                }
            }).join('');
        }

        const activeSingers = window.getActiveSingers(song);
        const singerString = activeSingers[index] || null;

        if (singerString && cleanLyric !== '[ดนตรี]') {
            const badgesHtml = singerString.split(',').filter(s => s.trim()).map(s => {
                const name = s.trim();
                const badgeColor = (window.SINGER_COLORS && window.SINGER_COLORS[name]) ? window.SINGER_COLORS[name] : '#0a84ff';
                return `<span class="singer-badge" style="background-color: ${badgeColor}; color: #fff; border: 1px solid rgba(255,255,255,0.2);">${name}</span>`;
            }).join('');
            lineDiv.innerHTML = `<div class="singer-badges">${badgesHtml}</div>${linesHtml}`;
        } else {
            lineDiv.innerHTML = linesHtml;
        }

        container.appendChild(lineDiv);
    });
};

// ==========================================
// 🎧 ระบบเพลง Cover (Alternative Versions)
// ==========================================
window.renderVersionBadges = function() {
    const container = document.getElementById('versionContainer');
    if (!container) return;
    const song = window.songs.find(s => s.id === window.currentSongId);
    if (!song || !song.covers || song.covers.length === 0) {
        container.style.display = 'none'; return;
    }
    container.style.display = 'flex'; container.className = 'version-badges-container'; container.innerHTML = '';
    container.appendChild(createBadgeElement('🌟 Original', song.artist, -1));
    song.covers.forEach((cover, index) => { container.appendChild(createBadgeElement(`🎧 Cover`, cover.coverArtist, index)); });
};

function createBadgeElement(label, artistName, index) {
    const badge = document.createElement('div'); badge.className = 'version-badge'; badge.innerText = `${label} : ${artistName}`;
    if (window.currentCoverIndex === index) {
        badge.classList.add('active');
        const badgeColor = (window.SINGER_COLORS && window.SINGER_COLORS[artistName]) ? window.SINGER_COLORS[artistName] : '#0a84ff';
        let textColor = '#ffffff';
        if (badgeColor.startsWith('#')) {
            let hex = badgeColor.replace('#', '');
            if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
            let r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
            let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            textColor = (yiq >= 140) ? '#000000' : '#ffffff';
        }
        badge.style.background = badgeColor; badge.style.color = textColor; badge.style.boxShadow = `0 0 12px ${badgeColor}80`;
    }

    badge.onclick = () => {
        if (window.currentCoverIndex === index) return;
        window.currentCoverIndex = index;
        window.renderVersionBadges();

        const song = window.songs.find(s => s.id === window.currentSongId);
        let targetVideoPath = song.audioPath;
        if (index >= 0 && song.covers && song.covers[index]) targetVideoPath = song.covers[index].audioPath;

        const videoId = window.extractYouTubeID(targetVideoPath);
        if (window.ytPlayer && typeof window.ytPlayer.loadVideoById === 'function') { window.ytPlayer.loadVideoById(videoId); window.updateVideoQuality(); if (videoId) window.applyAmbience(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, videoId); }

        window.currentLyricIndex = -1;
        window.renderTimestampEditor();
        window.renderLyricsToContainer();
        window.updateLyricDisplay();
    };
    return badge;
}

// ==========================================
// ▶️ เล่นเพลง
// ==========================================
window.playSong = function(id) {
    window.currentSongId = id;
    window._isPlaying = true;
    const song = window.songs.find(s => s.id === id); if (!song) return;
    if (window.startListeningStats) window.startListeningStats(id);

    window.currentCoverIndex = -1;
    window.renderVersionBadges();

    if (window.wm && window.wm.notifyWin) window.wm.notifyWin.close();

    const liveAct = document.getElementById('liveActivity');
    if (liveAct) {
        document.getElementById('liveTitle').innerText = song.title;
        document.getElementById('liveArtist').innerText = '🎤 ' + (song.artist || '-');
        document.getElementById('npTrackTitle').innerText = song.title;
        document.getElementById('npTrackArtist').innerText = '🎤 ' + (song.artist || '-');

        const ytId = window.extractYouTubeID(song.audioPath);
        const npThumb = document.getElementById('npTrackThumb');
        if (ytId) {
            const thumbUrl = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
            liveAct.style.setProperty('--live-bg', `url('${thumbUrl}')`);
            window.applyAmbience(thumbUrl, ytId);
            if (npThumb) npThumb.style.backgroundImage = `url('${thumbUrl}')`;
        } else {
            liveAct.style.removeProperty('--live-bg');
            window.clearAmbience();
            if (npThumb) npThumb.style.backgroundImage = '';
        }

        liveAct.classList.remove('hidden'); liveAct.classList.remove('paused');
    }

    window.currentLyricsArray = song.lyrics.split(/\n\s*\n/); window.currentLyricIndex = -1;

    window.wm.openPlayer(song.title); window.wm.openLyrics(song.title);
    window.wm.updateSyncTitle(song.title);

    window.renderTimestampEditor(); window.renderLyricsToContainer(); window.updateLyricDisplay();

    const videoId = window.extractYouTubeID(song.audioPath); const bgEl = document.getElementById('dynamic-bg');
    if (bgEl && videoId) { bgEl.style.backgroundImage = `url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg')`; bgEl.classList.add('active'); }

    let playerDiv = document.getElementById('youtubePlayer');
    if (!playerDiv) document.getElementById('content-player').innerHTML = '<div id="youtubePlayer" style="width: 100%; height: 100%;"></div>';

    if (window.ytPlayer && typeof window.ytPlayer.loadVideoById === 'function') {
        window.ytPlayer.loadVideoById(videoId);
        window.updateVideoQuality();
    } else {
        if (window.isYTApiReady || (window.YT && window.YT.Player)) {
            window.ytPlayer = new YT.Player('youtubePlayer', {
                height: '100%', width: '100%', videoId: videoId,
                playerVars: { 'playsinline': 1, 'controls': 1, 'autoplay': 1 },
                events: { 'onStateChange': window.onPlayerStateChange, 'onPlaybackQualityChange': window.updateVideoQuality }
            });
        }
    }

    clearInterval(window.syncInterval);
    window.syncInterval = setInterval(() => {
        if (window.tickStats) window.tickStats();

        if (!window.ytPlayer || typeof window.ytPlayer.getCurrentTime !== 'function') return;
        window.updateVideoQuality();
        const now2 = Date.now();
        if (now2 - window._lastQualityPing > 1000) {
            window._lastQualityPing = now2;
            if (window.ytPlayer && typeof window.ytPlayer.getPlayerState === 'function' && window.ytPlayer.getPlayerState() === 1) window.pingYTQuality();
        }
        const currentSong = window.songs.find(s => s.id === window.currentSongId); if (!currentSong) return;

        const activeTimestamps = window.getActiveTimestamps(currentSong);
        const currentTime = window.ytPlayer.getCurrentTime();
        if (currentTime === undefined || currentTime === 0) return;

        const duration = window.ytPlayer.getDuration();
        if (duration > 0) {
            const percent = (currentTime / duration) * 100;
            const progressBg = document.getElementById('playerProgressBarBg');
            if (progressBg) progressBg.style.width = percent + '%';
            const npFill = document.getElementById('npScrubFill');
            if (npFill) npFill.style.width = percent + '%';
        }

        let correctIndex = -1;
        for (let i = 0; i < activeTimestamps.length; i++) {
            if (activeTimestamps[i] != null && currentTime >= activeTimestamps[i]) correctIndex = i;
        }
        if (window.currentLyricIndex !== correctIndex) {
            window.currentLyricIndex = correctIndex; window.updateLyricDisplay();
        }
    }, 100);
};

window.saveTimestampsToFirebase = async function(updateLyricsText = false) {
    if (!window.isAdmin) return;
    const song = window.songs.find(s => s.id === window.currentSongId);
    if (!song) return;

    if (updateLyricsText) song.lyrics = window.currentLyricsArray.join('\n\n');
    const count = window.currentLyricsArray.length;

    let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);

    if (isCover) {
        if (!song.covers[window.currentCoverIndex].timestamps || song.covers[window.currentCoverIndex].timestamps.length === 0) {
            song.covers[window.currentCoverIndex].timestamps = [...(song.timestamps || [])];
        }
        if (!song.covers[window.currentCoverIndex].singers || song.covers[window.currentCoverIndex].singers.length === 0) {
            song.covers[window.currentCoverIndex].singers = [...(song.singers || [])];
        }
    }

    let currentTs = isCover ? (song.covers[window.currentCoverIndex].timestamps || []) : (song.timestamps || []);
    let currentSg = isCover ? (song.covers[window.currentCoverIndex].singers || []) : (song.singers || []);

    const safeTs = Array.from({ length: count }, (_, i) => currentTs[i] != null ? currentTs[i] : null);
    const safeSg = Array.from({ length: count }, (_, i) => currentSg[i] != null ? currentSg[i] : "");

    const payload = {
        timestamps: song.timestamps || [],
        singers: song.singers || [],
        covers: song.covers || []
    };
    if (updateLyricsText) payload.lyrics = song.lyrics;

    if (isCover) {
        song.covers[window.currentCoverIndex].timestamps = safeTs;
        song.covers[window.currentCoverIndex].singers = safeSg;
        payload.covers = song.covers;
    } else {
        song.timestamps = safeTs;
        song.singers = safeSg;
        payload.timestamps = safeTs;
        payload.singers = safeSg;
    }

    await updateDoc(doc(db, "songs", window.currentSongId), payload);
    if (updateLyricsText) { window.renderLyricsToContainer(); window.updateLyricDisplay(); }
};

window.renderTimestampEditor = function() {
    const container = document.getElementById('timestampList'); if (!container) return;
    container.innerHTML = '';
    const song = window.songs.find(s => s.id === window.currentSongId); if (!song) return;

    // ==========================================
    // 🟢 แถบ Calibrate หูฟังบลูทูธ (จดจำแยกเครื่องลง localStorage)
    // ==========================================
    if (window.isAdmin) {
        const savedOffset = localStorage.getItem('admin_audio_offset') || '0';
        const offsetDiv = document.createElement('div');
        offsetDiv.style.cssText = 'background: rgba(255, 159, 10, 0.15); border: 1px solid rgba(255, 159, 10, 0.3); padding: 12px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;';
        offsetDiv.innerHTML = `
            <div>
                <div style="color: #ff9f0a; font-weight: bold; font-size: 0.9em;">🎧 Calibrate หูฟังไร้สาย</div>
                <div style="color: #aaa; font-size: 0.8em; margin-top: 2px;">หักลบความหน่วง (Latency) ออกจากเวลาจริง</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button onclick="window.startCalibration()" style="background: rgba(10, 132, 255, 0.2); color: #0a84ff; border: 1px solid rgba(10, 132, 255, 0.5); border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 0.85em; font-weight: bold;">🎯 จับจังหวะอัตโนมัติ</button>
                <div style="display:flex; align-items:center; gap:3px;">
                    <input type="number" id="adminAudioOffset" value="${savedOffset}" step="10" min="0" style="width: 65px; padding: 4px; text-align: center; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.5); color: #fff; margin: 0;">
                    <span style="color: #ff9f0a; font-size: 0.85em;">ms</span>
                </div>
            </div>
        `;
        container.appendChild(offsetDiv);

        setTimeout(() => {
            const offsetInput = document.getElementById('adminAudioOffset');
            if (offsetInput) {
                offsetInput.addEventListener('change', (e) => {
                    localStorage.setItem('admin_audio_offset', Math.max(0, parseInt(e.target.value) || 0));
                });
            }
        }, 50);
    }

    let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);

    let activeTimestamps = window.getActiveTimestamps(song);
    let activeSingers = window.getActiveSingers(song);

    window.currentLyricsArray.forEach((lyric, index) => {
        const row = document.createElement('div'); row.className = 'ts-row'; row.id = `ts-row-${index}`;
        row.style.background = 'rgba(255, 255, 255, 0.05)'; row.style.padding = '12px 10px'; row.style.borderRadius = '8px'; row.style.marginBottom = '12px'; row.style.border = '1px solid rgba(255, 255, 255, 0.1)';

        const lyricEditor = document.createElement('textarea');
        lyricEditor.value = lyric; lyricEditor.style.width = '100%'; lyricEditor.style.minHeight = '55px'; lyricEditor.style.marginBottom = '10px';
        if (!window.isAdmin) { lyricEditor.readOnly = true; lyricEditor.style.border = 'none'; lyricEditor.style.background = 'transparent'; }
        else { lyricEditor.onchange = (e) => { window.currentLyricsArray[index] = e.target.value.trim(); window.saveTimestampsToFirebase(true); }; }
        row.appendChild(lyricEditor);

        const controlsDiv = document.createElement('div'); controlsDiv.style.display = 'flex'; controlsDiv.style.justifyContent = 'space-between'; controlsDiv.style.alignItems = 'center'; controlsDiv.style.flexWrap = 'wrap'; controlsDiv.style.gap = '8px';
        const leftControls = document.createElement('div'); leftControls.style.display = 'flex'; leftControls.style.gap = '8px'; leftControls.style.alignItems = 'center';

        const badge = document.createElement('span'); badge.innerText = `#${index + 1}`; badge.style.color = '#0a84ff'; badge.style.fontWeight = 'bold'; leftControls.appendChild(badge);

        if (window.isAdmin) {
            const allSingers = window.getSingersList(song.artist);
            const dropdown = document.createElement('div'); dropdown.className = 'ts-singer-dropdown'; dropdown.style.position = 'relative';
            const toggleBtn = document.createElement('button'); toggleBtn.className = 'ts-dropdown-toggle';
            const currentSingers = activeSingers[index] ? activeSingers[index].split(',').map(s => s.trim()).filter(s => s) : [];
            toggleBtn.innerText = currentSingers.length > 0 ? currentSingers.join(', ') : '👤 เลือกร้อง';

            const menu = document.createElement('div'); menu.className = 'ts-dropdown-menu';
            allSingers.forEach(singer => {
                const itemLabel = document.createElement('label'); itemLabel.className = 'ts-dropdown-item';
                const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = singer; checkbox.checked = currentSingers.includes(singer);
                checkbox.onchange = () => {
                    const selected = Array.from(menu.querySelectorAll('input:checked')).map(cb => cb.value);
                    toggleBtn.innerText = selected.length > 0 ? selected.join(', ') : '👤 เลือกร้อง';
                    if (isCover) {
                        if (!song.covers[window.currentCoverIndex].singers || song.covers[window.currentCoverIndex].singers.length === 0) {
                            song.covers[window.currentCoverIndex].singers = [...(song.singers || [])];
                        }
                        song.covers[window.currentCoverIndex].singers[index] = selected.length > 0 ? selected.join(', ') : "";
                    } else {
                        if (!song.singers) song.singers = []; song.singers[index] = selected.length > 0 ? selected.join(', ') : "";
                    }
                    window.saveTimestampsToFirebase(true);
                };
                itemLabel.appendChild(checkbox); itemLabel.appendChild(document.createTextNode(' ' + singer)); menu.appendChild(itemLabel);
            });
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                const isShowing = menu.classList.contains('show');
                document.querySelectorAll('.ts-dropdown-menu.show').forEach(m => m.classList.remove('show'));
                if (!isShowing) {
                    menu.classList.add('show');
                    const rect = toggleBtn.getBoundingClientRect();
                    menu.style.position = 'absolute'; menu.style.left = '0';
                    if (window.innerHeight - rect.bottom < 200) { menu.style.top = 'auto'; menu.style.bottom = 'calc(100% + 5px)'; }
                    else { menu.style.top = 'calc(100% + 5px)'; menu.style.bottom = 'auto'; }
                }
            };
            dropdown.appendChild(toggleBtn); dropdown.appendChild(menu); leftControls.appendChild(dropdown);

            const timeInput = document.createElement('input'); timeInput.type = 'number'; timeInput.step = '0.1'; timeInput.min = '0';
            timeInput.style.width = '70px'; timeInput.style.margin = '0'; timeInput.style.padding = '4px 6px'; timeInput.style.textAlign = 'center';
            timeInput.value = (activeTimestamps[index] != null) ? activeTimestamps[index].toFixed(1) : '';
            timeInput.onchange = (e) => {
                const val = parseFloat(e.target.value);
                const finalVal = isNaN(val) ? null : val;
                if (isCover) {
                    if (!song.covers[window.currentCoverIndex].timestamps || song.covers[window.currentCoverIndex].timestamps.length === 0) {
                        song.covers[window.currentCoverIndex].timestamps = [...(song.timestamps || [])];
                    }
                    song.covers[window.currentCoverIndex].timestamps[index] = finalVal;
                } else {
                    if (!song.timestamps) song.timestamps = [];
                    song.timestamps[index] = finalVal;
                }
                window.saveTimestampsToFirebase();
            };
            leftControls.appendChild(timeInput);
        }

        const rightControls = document.createElement('div'); rightControls.style.display = 'flex'; rightControls.style.gap = '8px';
        if (window.isAdmin) {
            const btnMusic = document.createElement('button'); btnMusic.innerText = '🎵 ดนตรี'; btnMusic.style.background = 'rgba(255, 159, 10, 0.2)'; btnMusic.style.color = '#ff9f0a'; btnMusic.style.border = '1px solid rgba(255, 159, 10, 0.4)'; btnMusic.style.padding = '4px 10px'; btnMusic.style.borderRadius = '6px'; btnMusic.style.cursor = 'pointer';
            btnMusic.onclick = () => { lyricEditor.value = '[ดนตรี]'; window.currentLyricsArray[index] = '[ดนตรี]'; window.saveTimestampsToFirebase(true); };

            const btnAdd = document.createElement('button'); btnAdd.innerText = '➕'; btnAdd.style.background = 'rgba(52, 199, 89, 0.2)'; btnAdd.style.color = '#34c759'; btnAdd.style.border = '1px solid rgba(52, 199, 89, 0.4)'; btnAdd.style.padding = '4px 10px'; btnAdd.onclick = () => window.addLyricLine(index);
            const btnDel = document.createElement('button'); btnDel.innerText = '🗑️'; btnDel.style.background = 'rgba(255, 59, 48, 0.2)'; btnDel.style.color = '#ff3b30'; btnDel.style.border = '1px solid rgba(255, 59, 48, 0.4)'; btnDel.style.padding = '4px 10px'; btnDel.onclick = () => window.deleteLyricLine(index);

            rightControls.appendChild(btnMusic); rightControls.appendChild(btnAdd); rightControls.appendChild(btnDel);
        }

        controlsDiv.appendChild(leftControls); controlsDiv.appendChild(rightControls);
        row.appendChild(controlsDiv); container.appendChild(row);
    });

    if (window.isAdmin) {
        const btnAddEnd = document.createElement('button'); btnAddEnd.innerText = '➕ เพิ่มท่อนใหม่ต่อท้ายสุด'; btnAddEnd.style.background = 'rgba(255, 255, 255, 0.1)'; btnAddEnd.style.padding = "8px"; btnAddEnd.style.color = "#fff"; btnAddEnd.style.border = "none"; btnAddEnd.style.borderRadius = "8px"; btnAddEnd.style.width = "100%"; btnAddEnd.style.cursor = "pointer";
        btnAddEnd.onclick = () => window.addLyricLine(window.currentLyricsArray.length - 1); container.appendChild(btnAddEnd);
    }
};

window.addLyricLine = function(index) {
    if (!confirm('ต้องการแทรกเนื้อเพลงใช่หรือไม่?')) return;
    const song = window.songs.find(s => s.id === window.currentSongId); if (!song) return;
    const insertAt = index + 1;
    window.currentLyricsArray.splice(insertAt, 0, "ท่อนใหม่...");
    if (!song.timestamps) song.timestamps = []; song.timestamps.splice(insertAt, 0, null);
    if (!song.singers) song.singers = []; song.singers.splice(insertAt, 0, "");

    if (song.covers) {
        song.covers.forEach(c => {
            if (c.timestamps) c.timestamps.splice(insertAt, 0, null);
            if (c.singers) c.singers.splice(insertAt, 0, "");
        });
    }
    window.saveTimestampsToFirebase(true).then(() => { window.renderTimestampEditor(); });
};

window.deleteLyricLine = function(index) {
    if (!confirm('ลบท่อนนี้ใช่หรือไม่?\\nเนื้อเพลงและเวลาที่เกี่ยวข้องจะหายไปทั้งหมด')) return;
    const song = window.songs.find(s => s.id === window.currentSongId); if (!song) return;
    window.currentLyricsArray.splice(index, 1);
    if (song.timestamps) song.timestamps.splice(index, 1);
    if (song.singers) song.singers.splice(index, 1);

    if (song.covers) {
        song.covers.forEach(c => {
            if (c.timestamps) c.timestamps.splice(index, 1);
            if (c.singers) c.singers.splice(index, 1);
        });
    }
    window.saveTimestampsToFirebase(true).then(() => { window.renderTimestampEditor(); });
};

window.syncTimestampEditorUI = function() {
    window.currentLyricsArray.forEach((_, index) => {
        const row = document.getElementById(`ts-row-${index}`);
        if (row) {
            if (index === window.currentLyricIndex) { row.style.background = 'rgba(10, 132, 255, 0.25)'; row.style.borderColor = '#0a84ff'; }
            else { row.style.background = 'rgba(255, 255, 255, 0.05)'; row.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }
        }
    });
};

window.updateLyricDisplay = function() {
    const container = document.getElementById('lyricsContainer'); if (!container) return;
    container.querySelectorAll('.lyric-line').forEach(line => line.classList.remove('active'));

    const npView = document.getElementById('nowPlayingView');
    const immersive = npView && npView.classList.contains('immersive');

    let idx = window.currentLyricIndex;
    if (immersive && (idx < 0 || idx >= window.currentLyricsArray.length) && window.currentLyricsArray.length > 0) {
        idx = 0;
    }

    if (idx >= 0 && idx < window.currentLyricsArray.length) {
        const activeLine = document.getElementById(`lyric-line-${idx}`);
        if (activeLine) {
            activeLine.classList.add('active');
            if (!immersive) {
                activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }
    window.syncTimestampEditorUI();
};

// คำนวณท่อนที่กำลังร้องจากเวลาปัจจุบัน ใช้ตอนสลับโหมด เพื่อให้เนื้อเพลงติดตามการเล่นเสมอ
window.syncLyricToPlayback = function() {
    if (!window.ytPlayer || typeof window.ytPlayer.getCurrentTime !== 'function') return;
    const currentSong = window.songs.find(s => s.id === window.currentSongId);
    if (!currentSong) return;
    const t = window.ytPlayer.getCurrentTime();
    if (typeof t !== 'number' || t <= 0) return;
    const activeTimestamps = window.getActiveTimestamps(currentSong);
    let idx = -1;
    for (let i = 0; i < activeTimestamps.length; i++) {
        if (activeTimestamps[i] != null && t >= activeTimestamps[i]) idx = i;
    }
    if (idx >= 0 && idx !== window.currentLyricIndex) {
        window.currentLyricIndex = idx;
        window.updateLyricDisplay();
    }
};

// บังคับเลื่อนแผงเนื้อเพลงไปยังท่อนที่ highlight อยู่ (ใช้เมื่อออกจากโหมด Immsersive
// เพราะระหว่างอยู่ในโหมดนั้นแผงจะไม่เลื่อนตามเลย)
window.forceLyricScroll = function() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const activeLine = document.querySelector('#lyricsContainer .lyric-line.active');
            if (activeLine) activeLine.scrollIntoView({ behavior: "auto", block: "center" });
        });
    });
};

// 🟢 ระบบหักลบความหน่วง (Calibrate) ทำงานตรงฟังก์ชันนี้
window.nextLyric = function(isAuto = false) {
    if (window.currentLyricIndex < window.currentLyricsArray.length) {
        window.currentLyricIndex++;
        window.updateLyricDisplay();

        if (!isAuto && window.isAdmin && window.currentSongId && window.ytPlayer) {
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (song) {
                const offsetMs = parseInt(localStorage.getItem('admin_audio_offset')) || 0;
                const rawTime = window.ytPlayer.getCurrentTime();
                const currentTime = Math.max(0, rawTime - (offsetMs / 1000));

                let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);

                if (isCover) {
                    if (!song.covers[window.currentCoverIndex].timestamps || song.covers[window.currentCoverIndex].timestamps.length === 0) {
                        song.covers[window.currentCoverIndex].timestamps = [...(song.timestamps || [])];
                    }
                    song.covers[window.currentCoverIndex].timestamps[window.currentLyricIndex] = currentTime;
                } else {
                    if (!song.timestamps) song.timestamps = [];
                    song.timestamps[window.currentLyricIndex] = currentTime;
                }

                const activeRow = document.getElementById(`ts-row-${window.currentLyricIndex}`);
                if (activeRow) {
                    const timeInput = activeRow.querySelector('input[type="number"]');
                    if (timeInput) timeInput.value = currentTime.toFixed(1);
                }
                window.saveTimestampsToFirebase();
            }
        }
    }
};

window.prevLyric = function() {
    if (window.currentLyricIndex > -1) {
        if (window.isAdmin && window.currentSongId) {
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (song) {
                let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);
                if (isCover) {
                    if (!song.covers[window.currentCoverIndex].timestamps || song.covers[window.currentCoverIndex].timestamps.length === 0) {
                        song.covers[window.currentCoverIndex].timestamps = [...(song.timestamps || [])];
                    }
                    song.covers[window.currentCoverIndex].timestamps[window.currentLyricIndex] = null;
                } else {
                    if (song.timestamps) song.timestamps[window.currentLyricIndex] = null;
                }

                const activeRow = document.getElementById(`ts-row-${window.currentLyricIndex}`);
                if (activeRow) {
                    const timeInput = activeRow.querySelector('input[type="number"]');
                    if (timeInput) timeInput.value = '';
                }
                window.saveTimestampsToFirebase();
            }
        }
        window.currentLyricIndex--;
        window.updateLyricDisplay();
    }
};

window.resetSync = function() {
    if (!window.isAdmin) return;
    if (confirm('ล้างเวลาทั้งหมดของเวอร์ชันที่กำลังเล่นอยู่?')) {
        const song = window.songs.find(s => s.id === window.currentSongId);
        if (song) {
            let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);
            if (isCover) {
                song.covers[window.currentCoverIndex].timestamps = [];
                song.covers[window.currentCoverIndex].singers = [];
            } else {
                song.timestamps = [];
                song.singers = [];
            }
            window.saveTimestampsToFirebase();
            window.currentLyricIndex = -1;
            window.renderTimestampEditor();
            window.updateLyricDisplay();
        }
    }
};

// ==========================================
// สถานะการเล่น / เพลงถัดไป-ก่อนหน้า / จบเพลง
// ==========================================
window.onPlayerStateChange = function(event) {
    const playPauseBtn = document.getElementById('livePlayPauseBtn');
    const liveAct = document.getElementById('liveActivity');

    const npPlayBtn = document.getElementById('npPlayPauseBtn');
    if (event.data === 1) {
        if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        if (npPlayBtn) npPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        if (liveAct) liveAct.classList.remove('paused');
        window.startEqBars();
        window.pingYTQuality();
        window._isPlaying = true;
        window.restoreWinBoxColor();
    }
    if (event.data === 2) {
        if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (npPlayBtn) npPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (liveAct) liveAct.classList.add('paused');
        window.stopEqBars();
        window._isPlaying = false;
        window.resetWinBoxColor();
    }

    if (event.data === 0) {
        window.stopEqBars();
        if (window.endListeningStats) window.endListeningStats();

        if (!window.songs || window.songs.length === 0) return;

        // 🎵 ถ้ามีคิวเพลง ให้เล่นเพลงถัดไปจากคิวก่อน
        const nextQueuedId = window.takeNextFromQueue ? window.takeNextFromQueue() : null;
        if (nextQueuedId) {
            window.playSong(nextQueuedId);
            return;
        }

        if (window.isShuffleEnabled) {
            let randomIndex = Math.floor(Math.random() * window.songs.length);
            if (window.songs.length > 1) {
                const currentIdx = window.songs.findIndex(s => s.id === window.currentSongId);
                while (randomIndex === currentIdx) {
                    randomIndex = Math.floor(Math.random() * window.songs.length);
                }
            }
            window.playSong(window.songs[randomIndex].id);
        } else {
            const idx = window.songs.findIndex(s => s.id === window.currentSongId);
            if (idx !== -1 && idx + 1 < window.songs.length) {
                window.playSong(window.songs[idx + 1].id);
            } else {
                const bgEl = document.getElementById('dynamic-bg');
                if (bgEl) bgEl.classList.remove('active');

                if (liveAct) liveAct.classList.add('hidden');
                window.wm.collapseNowPlaying();
                const syncPanel = document.getElementById('syncPanel');
                if (syncPanel) syncPanel.style.display = 'none';

                window.currentSongId = null;
                window._isPlaying = false;
                window.clearAmbience();
            }
        }
    }
};

window.toggleLivePlay = function() {
    if (!window.ytPlayer || typeof window.ytPlayer.getPlayerState !== 'function') return;
    const state = window.ytPlayer.getPlayerState();

    if (state === 1) { window.ytPlayer.pauseVideo(); }
    else { window.ytPlayer.playVideo(); }
};

window.nextLiveSong = function() {
    if (!window.songs || window.songs.length === 0 || !window.currentSongId) return;

    // 🎵 ถ้ามีคิวเพลง ให้เล่นเพลงถัดไปจากคิวก่อน
    const nextQueuedId = window.takeNextFromQueue ? window.takeNextFromQueue() : null;
    if (nextQueuedId) {
        window.playSong(nextQueuedId);
        return;
    }

    if (window.isShuffleEnabled) {
        let randomIndex = Math.floor(Math.random() * window.songs.length);
        if (window.songs.length > 1) {
            const currentIdx = window.songs.findIndex(s => s.id === window.currentSongId);
            while (randomIndex === currentIdx) randomIndex = Math.floor(Math.random() * window.songs.length);
        }
        window.playSong(window.songs[randomIndex].id);
    } else {
        const currentIdx = window.songs.findIndex(s => s.id === window.currentSongId);
        const nextIndex = currentIdx + 1 < window.songs.length ? currentIdx + 1 : 0;
        window.playSong(window.songs[nextIndex].id);
    }
};

window.prevLiveSong = function() {
    if (!window.songs || window.songs.length === 0 || !window.currentSongId) return;

    const currentIdx = window.songs.findIndex(s => s.id === window.currentSongId);
    const prevIndex = currentIdx - 1 >= 0 ? currentIdx - 1 : window.songs.length - 1;
    window.playSong(window.songs[prevIndex].id);
};

// ==========================================
// 🎵 Visualizer (random smooth equalizer bars)
// ==========================================
window._eqInterval = null;

window.startEqBars = function() {
    if (window._eqInterval) return;
    const bars = document.querySelectorAll('#liveActivity .live-icon .bar');
    if (!bars.length) return;

    const baseHeights = [4, 6, 5, 4];
    let prevHeights = [...baseHeights];

    window._eqInterval = setInterval(() => {
        bars.forEach((bar, i) => {
            const base = baseHeights[i] || 4;
            const max = 18;
            const delta = Math.random() * 12 - 4;
            let newH = Math.round(Math.min(max, Math.max(base, prevHeights[i] + delta)));
            prevHeights[i] = newH;
            bar.style.height = newH + 'px';
        });
    }, 110);
};

window.stopEqBars = function() {
    if (window._eqInterval) {
        clearInterval(window._eqInterval);
        window._eqInterval = null;
    }
    document.querySelectorAll('#liveActivity .live-icon .bar').forEach(bar => {
        bar.style.height = '4px';
    });
};

// ==========================================
// 🎯 ระบบ Auto Calibration (จับจังหวะเสียงหาความหน่วง Bluetooth)
// ==========================================
window.startCalibration = function() {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    if (!actx) return alert("เบราว์เซอร์ไม่รองรับระบบนี้ แนะนำให้พิมพ์ตัวเลขเองครับ");

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.95); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;';

    overlay.innerHTML = `
        <h2 style="color:#0a84ff; margin-bottom: 10px;">🎯 ทดสอบความหน่วงหูฟัง</h2>
        <p style="color:#aaa; text-align:center; max-width:400px; line-height:1.6; margin-bottom:30px;">
            ระบบจะส่งเสียง "ติ๊ด" เป็นจังหวะจำนวน 4 ครั้ง <br>
            ให้คุณ <b>กดปุ่ม Spacebar หรือคลิกปุ่มด้านล่าง</b> <br>ให้ตรงกับเสียงที่ได้ยินเป๊ะๆ เพื่อคำนวณความหน่วง
        </p>
        <div id="calibBtn" style="width:140px; height:140px; border-radius:50%; background:#0a84ff; display:flex; align-items:center; justify-content:center; font-size:2em; font-weight:bold; cursor:pointer; user-select:none; box-shadow:0 10px 30px rgba(10,132,255,0.4); transition:transform 0.1s;">
            👆 กด!
        </div>
        <div id="calibStatus" style="margin-top: 35px; font-size: 1.2em; font-weight: bold; color: #ffcc00;">แตะหน้าจอ 1 ครั้งเพื่อเริ่ม...</div>
        <button id="calibCancel" style="margin-top:40px; background:transparent; border:1px solid #ff3b30; color:#ff3b30; padding:8px 25px; border-radius:20px; cursor:pointer;">ยกเลิก</button>
    `;
    document.body.appendChild(overlay);

    const btn = overlay.querySelector('#calibBtn');
    const status = overlay.querySelector('#calibStatus');
    let expectedTimes = [];
    let tapTimes = [];
    let isStarted = false;
    let totalBeeps = 4;

    const startTest = () => {
        if (actx.state === 'suspended') actx.resume();
        status.style.color = "#34c759";
        status.innerText = "เตรียมตัว... (3)";

        setTimeout(() => status.innerText = "เตรียมตัว... (2)", 600);
        setTimeout(() => status.innerText = "เตรียมตัว... (1)", 1200);

        setTimeout(() => {
            status.innerText = "🎵 ฟังจังหวะแล้วกดเลย!";
            let startTime = actx.currentTime + 0.5;

            for (let i = 0; i < totalBeeps; i++) {
                let timeToPlay = startTime + i;
                expectedTimes.push(timeToPlay);

                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.type = 'sine';
                osc.frequency.value = 880;

                gain.gain.setValueAtTime(1, timeToPlay);
                gain.gain.exponentialRampToValueAtTime(0.001, timeToPlay + 0.1);

                osc.start(timeToPlay);
                osc.stop(timeToPlay + 0.1);
            }
        }, 1800);
    };

    const handleTap = (e) => {
        if (e.type === 'keydown' && e.code !== 'Space') return;
        e.preventDefault();

        if (!isStarted) {
            isStarted = true;
            startTest();
            return;
        }

        if (tapTimes.length >= totalBeeps) return;

        tapTimes.push(actx.currentTime);

        btn.style.transform = 'scale(0.85)';
        btn.style.background = '#34c759';
        setTimeout(() => { btn.style.transform = 'scale(1)'; btn.style.background = '#0a84ff'; }, 100);

        if (tapTimes.length === totalBeeps) {
            calculateResult();
        }
    };

    const calculateResult = () => {
        let totalLatency = 0;
        let validTaps = 0;

        for (let i = 0; i < totalBeeps; i++) {
            let diff = tapTimes[i] - expectedTimes[i];
            if (diff > -0.2 && diff < 1.0) {
                totalLatency += diff;
                validTaps++;
            }
        }

        if (validTaps === 0) {
            status.style.color = "#ff3b30";
            status.innerText = "❌ จับจังหวะไม่สำเร็จ ลองใหม่อีกครั้ง";
            setTimeout(() => { document.body.removeChild(overlay); }, 2000);
            return;
        }

        let avgLatencyMs = Math.round((totalLatency / validTaps) * 1000);
        avgLatencyMs = Math.max(0, avgLatencyMs);

        status.style.color = "#ffcc00";
        status.innerText = `✅ ตรวจพบความหน่วง: ${avgLatencyMs} ms`;

        localStorage.setItem('admin_audio_offset', avgLatencyMs);
        const inputOffset = document.getElementById('adminAudioOffset');
        if (inputOffset) inputOffset.value = avgLatencyMs;

        btn.style.display = 'none';
        setTimeout(() => { document.body.removeChild(overlay); }, 2000);
    };

    overlay.addEventListener('mousedown', (e) => { if (e.target.id !== 'calibCancel') handleTap(e); });
    window.addEventListener('keydown', handleTap);

    overlay.querySelector('#calibCancel').onclick = () => { document.body.removeChild(overlay); };
    const observer = new MutationObserver(() => {
        if (!document.body.contains(overlay)) { window.removeEventListener('keydown', handleTap); observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true });
};
