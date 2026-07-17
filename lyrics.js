// lyrics.js
// ระบบแสดงผลเนื้อเพลง การจัดการเวอร์ชัน (Cover) และไฮไลท์ท่อนเพลง
// รีแฟคเตอร์โดยลดการใช้ innerHTML และปรับมาใช้ DocumentFragment เพื่อความปลอดภัย (XSS) และประสิทธิภาพ

import { AppState } from './state.js';
import { getActiveTimestamps, getActiveSingers, extractYouTubeID } from './utils.js';

export function renderVersionBadges() {
    const container = document.getElementById('versionContainer'); 
    if (!container) return;
    
    const song = AppState.getSong(AppState.currentSongId);
    if (!song || !song.covers || song.covers.length === 0) {
        container.style.display = 'none'; 
        return;
    }
    
    container.style.display = 'flex'; 
    container.className = 'version-badges-container'; 
    container.textContent = ''; // ล้างข้อมูลเก่าแบบปลอดภัย

    const fragment = document.createDocumentFragment();
    fragment.appendChild(createBadgeElement('🌟 Original', song.artist, -1));
    
    song.covers.forEach((cover, index) => { 
        fragment.appendChild(createBadgeElement(`🎧 Cover`, cover.coverArtist, index)); 
    });
    
    container.appendChild(fragment);
}

function createBadgeElement(label, artistName, index) {
    const badge = document.createElement('div'); 
    badge.className = 'version-badge'; 
    badge.textContent = `${label} : ${artistName}`; // ป้องกัน XSS
    
    if (AppState.currentCoverIndex === index) {
        badge.classList.add('active');
        const badgeColor = (window.SINGER_COLORS && window.SINGER_COLORS[artistName]) ? window.SINGER_COLORS[artistName] : '#0a84ff';
        let textColor = '#ffffff';
        
        if (badgeColor.startsWith('#')) {
            let hex = badgeColor.replace('#', '');
            if (hex.length === 3) hex = hex.split('').map(x=>x+x).join(''); 
            let r = parseInt(hex.substring(0,2), 16), g = parseInt(hex.substring(2,4), 16), b = parseInt(hex.substring(4,6), 16);
            let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            textColor = (yiq >= 140) ? '#000000' : '#ffffff';
        }
        badge.style.background = badgeColor; 
        badge.style.color = textColor; 
        badge.style.boxShadow = `0 0 12px ${badgeColor}80`; 
    }

    badge.addEventListener('click', () => {
        if (AppState.currentCoverIndex === index) return; 
        AppState.currentCoverIndex = index;
        renderVersionBadges(); 
        
        const song = AppState.getSong(AppState.currentSongId);
        let targetVideoPath = song.audioPath; 
        if (index >= 0 && song.covers && song.covers[index]) {
            targetVideoPath = song.covers[index].audioPath; 
        }
        
        const videoId = extractYouTubeID(targetVideoPath);
        if (AppState.ytPlayer && typeof AppState.ytPlayer.loadVideoById === 'function') {
            AppState.ytPlayer.loadVideoById(videoId);
        }
        
        AppState.currentLyricIndex = -1;
        if (window.renderTimestampEditor) window.renderTimestampEditor(); 
        renderLyricsToContainer();
        updateLyricDisplay();
    });
    
    return badge;
}

export function renderLyricsToContainer() {
    const container = document.getElementById('lyricsContainer'); 
    if(!container) return;
    
    container.textContent = ''; // ล้างข้อมูลเดิมอย่างปลอดภัย
    
    if (AppState.currentLyricsArray.length === 0) { 
        container.textContent = 'ไม่มีเนื้อเพลง'; 
        return; 
    }
    
    const song = AppState.getSong(AppState.currentSongId);
    const activeSingers = getActiveSingers(song, AppState.currentCoverIndex);
    const fragment = document.createDocumentFragment();

    AppState.currentLyricsArray.forEach((lyric, index) => {
        const lineDiv = document.createElement('div'); 
        lineDiv.className = 'lyric-line'; 
        lineDiv.id = `lyric-line-${index}`;
        
        lineDiv.addEventListener('click', () => {
            const currentSong = AppState.getSong(AppState.currentSongId);
            if (currentSong && AppState.ytPlayer && typeof AppState.ytPlayer.seekTo === 'function') {
                const activeTimestamps = getActiveTimestamps(currentSong, AppState.currentCoverIndex);
                if (activeTimestamps[index] != null) {
                    AppState.ytPlayer.seekTo(activeTimestamps[index], true);
                    AppState.currentLyricIndex = index;
                    updateLyricDisplay();
                }
            }
        });
        
        const cleanLyric = lyric.trim();
        
        // --- 1. จัดการป้ายชื่อนักร้อง (Singer Badges) ---
        const singerString = activeSingers[index] || null;
        if (singerString && cleanLyric !== '[ดนตรี]') { 
            const badgesDiv = document.createElement('div');
            badgesDiv.className = 'singer-badges';
            
            singerString.split(',').filter(s=>s.trim()).forEach(s => {
                const name = s.trim();
                const badgeColor = (window.SINGER_COLORS && window.SINGER_COLORS[name]) ? window.SINGER_COLORS[name] : '#0a84ff';
                const badgeSpan = document.createElement('span');
                badgeSpan.className = 'singer-badge';
                badgeSpan.style.backgroundColor = badgeColor;
                badgeSpan.style.color = '#fff';
                badgeSpan.style.border = '1px solid rgba(255,255,255,0.2)';
                badgeSpan.textContent = name;
                badgesDiv.appendChild(badgeSpan);
            });
            lineDiv.appendChild(badgesDiv);
        }

        // --- 2. จัดการเนื้อเพลง ---
        if (cleanLyric === '[ดนตรี]') {
            const instDiv = document.createElement('div');
            instDiv.className = 'lyric-instrumental';
            ['🎵', '🎶', '🎵'].forEach(noteChar => {
                const noteSpan = document.createElement('span');
                noteSpan.className = 'note';
                noteSpan.textContent = noteChar;
                instDiv.appendChild(noteSpan);
            });
            lineDiv.appendChild(instDiv);
        } else {
            const linesContainer = document.createElement('div');
            const validLines = cleanLyric.split('\n').filter(l => l.trim() !== '');
            
            validLines.forEach((l, i) => {
                const isMiddle = (i > 0 && i < validLines.length - 1);
                const highlightClass = isMiddle ? ' reading-text' : ''; 
                
                if (l.includes('||')) {
                    let parts = l.split('||');
                    const dualDiv = document.createElement('div');
                    dualDiv.className = `lang-${i} dual-lyric${highlightClass}`;
                    
                    const mainSpan = document.createElement('span');
                    mainSpan.className = 'lyric-main';
                    mainSpan.textContent = parts[0].trim();
                    
                    const subSpan = document.createElement('span');
                    subSpan.className = 'lyric-sub';
                    subSpan.textContent = parts[1].trim();
                    
                    dualDiv.append(mainSpan, subSpan);
                    linesContainer.appendChild(dualDiv);
                } else {
                    const singleDiv = document.createElement('div');
                    singleDiv.className = `lang-${i}${highlightClass}`;
                    singleDiv.textContent = l;
                    linesContainer.appendChild(singleDiv);
                }
            });
            lineDiv.appendChild(linesContainer);
        }
        
        fragment.appendChild(lineDiv);
    });
    
    container.appendChild(fragment);
}

export function updateLyricDisplay() {
    const container = document.getElementById('lyricsContainer'); 
    if (!container) return;
    
    container.querySelectorAll('.lyric-line').forEach(line => line.classList.remove('active'));

    if (AppState.currentLyricIndex >= 0 && AppState.currentLyricIndex < AppState.currentLyricsArray.length) {
        const activeLine = document.getElementById(`lyric-line-${AppState.currentLyricIndex}`);
        if (activeLine) { 
            activeLine.classList.add('active'); 
            activeLine.scrollIntoView({ behavior: "smooth", block: "center" }); 
        }
    }
    
    if (window.syncTimestampEditorUI) {
        window.syncTimestampEditorUI(); 
    }
}
