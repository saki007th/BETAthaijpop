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
