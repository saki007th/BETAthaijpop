// ==========================================
// home.js - Home view content (artist spotlight + random picks)
// ==========================================

window.renderArtistWidget = function() {
    const container = document.getElementById('artistWidgetContent');
    if (!container || !window.songs || window.songs.length === 0) return;

    let artistSet = new Set();
    window.songs.forEach(s => window.getSingersList(s.artist).forEach(n => artistSet.add(n)));
    const allArtists = Array.from(artistSet).filter(a => a !== 'ดนตรี');

    if (allArtists.length === 0) { container.innerHTML = '<div style="color: var(--text-3); text-align: center;">ไม่พบข้อมูลศิลปิน</div>'; return; }

    const randomArtist = allArtists[Math.floor(Math.random() * allArtists.length)];
    const artistSongs = window.songs.filter(song => (song.artist || '').includes(randomArtist));
    const shuffledSongs = [...artistSongs].sort(() => 0.5 - Math.random());
    const displaySongs = shuffledSongs.slice(0, 3);
    let badgeColor = (window.SINGER_COLORS && window.SINGER_COLORS[randomArtist]) ? window.SINGER_COLORS[randomArtist] : '#0a84ff';

    let html = `
        <div class="widget-artist-header">
            <div class="widget-artist-name" style="color: ${badgeColor};">${randomArtist}</div>
            <button class="widget-refresh-btn" onclick="renderArtistWidget()" title="สุ่มใหม่"><i class="fa-solid fa-arrows-rotate"></i></button>
        </div>
        <div class="widget-song-list">
    `;

    displaySongs.forEach(song => {
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';
        html += `
            <div class="widget-song-item" onclick="playSong('${song.id}')">
                <img src="${thumbUrl}" onerror="this.style.display='none'">
                <div class="widget-song-info">
                    <div class="widget-song-title">${song.title}</div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
};

window.renderRandomPlaylist = function() {
    const container = document.getElementById('randomSongList');
    if (!container || !window.songs || window.songs.length === 0) return;

    container.innerHTML = '';

    let shuffled = [...window.songs].sort(() => 0.5 - Math.random());
    let selected = shuffled.slice(0, 5);

    selected.forEach(song => {
        const item = document.createElement('div');
        item.className = 'random-song-item';
        item.onclick = () => window.playSong(song.id);

        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';

        item.innerHTML = `
            <img src="${thumbUrl}" onerror="this.src=''">
            <div class="random-song-info">
                <div class="random-song-title">${song.title}</div>
                <div class="random-song-artist">🎤 ${song.artist || '-'}</div>
            </div>
        `;
        container.appendChild(item);
    });
};

window.renderRecentlyAdded = function() {
    const container = document.getElementById('recentlyAddedList');
    if (!container || !window.songs || window.songs.length === 0) return;

    container.innerHTML = '';

    const recent = [...window.songs]
        .filter(s => s.createdAt)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5);

    recent.forEach(song => {
        const item = document.createElement('div');
        item.className = 'random-song-item';
        item.onclick = () => window.playSong(song.id);

        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';

        let dateStr = '';
        const ts = song.createdAt;
        if (ts) {
            let ms = (typeof ts === 'number') ? ts
                : (typeof ts === 'object' && ts.seconds) ? ts.seconds * 1000
                : new Date(ts).getTime();
            if (!isNaN(ms)) {
                const d = new Date(ms);
                dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
            }
        }

        item.innerHTML = `
            <img src="${thumbUrl}" onerror="this.src=''">
            <div class="random-song-date">${dateStr || '—'}</div>
            <div class="random-song-info">
                <div class="random-song-title">${song.title}</div>
                <div class="random-song-artist">🎤 ${song.artist || '-'}</div>
            </div>
        `;
        container.appendChild(item);
    });
};

// ==========================================
// 📊 สถิติการฟัง (แสดงบนหน้าแรก) มาจาก firestore userData
// ==========================================
window.renderHomeStats = function() {
    const container = document.getElementById('homeStats');
    if (!container || !window.stats) return;

    const st = window.stats;
    const hasData = (st.totalPlays > 0 || st.totalSeconds > 0) && window.songs && window.songs.length > 0;

    if (!hasData) {
        container.innerHTML = `
            <div class="stats-card">
                <div class="stats-card-head">
                    <h2 class="section-title">📊 สถิติการฟังของคุณ</h2>
                    ${accountTag()}
                </div>
                <div class="stats-empty">
                    ยังไม่มีสถิติการฟัง<br>
                    <span style="font-size:.9em; color:var(--text-3);">กดเล่นเพลงจากคลังเพลงหรือหน้าแรก แล้วสถิติจะถูกบันทึกที่นี่ 🎧</span>
                </div>
            </div>
        `;
        return;
    }

    // 🔥 เพลงที่ฟังบ่อยสุด (เรียงตามจำนวนครั้งที่เล่น)
    const topEntries = Object.entries(st.songs || {})
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.plays - a.plays) || (b.seconds - a.seconds))
        .slice(0, 4);

    // 🕘 เพิ่งฟังไป (จาก recent)
    const recentList = (st.recent || []).slice(0, 5);

    const topSongsHtml = topEntries.map(e => {
        const song = (window.songs || []).find(s => s.id === e.id);
        if (!song) return '';
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';
        return `
            <div class="stat-song-item" onclick="playSong('${e.id}')">
                <img src="${thumbUrl}" onerror="this.style.display='none'">
                <div class="stat-song-info">
                    <div class="stat-song-title">${song.title}</div>
                    <div class="stat-song-artist">🎤 ${song.artist || '-'}</div>
                </div>
                <div class="stat-song-meta">${e.plays} ครั้ง<br>${window.formatShortDuration(e.seconds)}</div>
            </div>
        `;
    }).join('');

    const recentSongsHtml = recentList.map(r => {
        const song = (window.songs || []).find(s => s.id === r.songId);
        if (!song) return '';
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';
        return `
            <div class="stat-song-item" onclick="playSong('${r.songId}')">
                <img src="${thumbUrl}" onerror="this.style.display='none'">
                <div class="stat-song-info">
                    <div class="stat-song-title">${song.title}</div>
                    <div class="stat-song-artist">🎤 ${song.artist || '-'}</div>
                </div>
                <div class="stat-song-meta">${window.formatShortDuration(r.sec || 0)}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="stats-card">
            <div class="stats-card-head">
                <h2 class="section-title">📊 สถิติการฟังของคุณ</h2>
                ${accountTag()}
            </div>
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-value">${window.formatDuration(st.totalSeconds)}</div>
                    <div class="stat-label">⏱ เวลาฟังทั้งหมด</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${st.totalPlays}</div>
                    <div class="stat-label">🎵 เพลงที่เคยเล่น</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${window.formatShortDuration(st.todaySeconds || 0)}</div>
                    <div class="stat-label">🎧 วันนี้ (${st.todayCount || 0} เพลง)</div>
                </div>
            </div>
            <div class="stats-lists">
                <div class="stats-col">
                    <div class="stats-col-title">🔥 เพลงที่ฟังบ่อย</div>
                    ${topSongsHtml || '<div class="stats-empty">ยังไม่มีข้อมูล</div>'}
                </div>
                <div class="stats-col">
                    <div class="stats-col-title">🕘 เพิ่งฟังไป</div>
                    ${recentSongsHtml || '<div class="stats-empty">ยังไม่มีข้อมูล</div>'}
                </div>
            </div>
        </div>
    `;

    function accountTag() {
        const name = window.currentUser ? (window.currentUser.displayName || window.currentUser.email || '') : '';
        return window.isLoggedIn
            ? `<span class="stats-account-tag" title="บันทึกตามบัญชี ${name || ''}">🤍 ${name || 'บัญชีของคุณ'}</span>`
            : '<span class="stats-account-tag">🔒 ยังไม่ได้ล็อกอิน (บันทึกชั่วคราว)</span>';
    }
};
