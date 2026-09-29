// ==========================================
// artists.js - หน้า "ศิลปิน" (แยกจากคลังเพลง)
// รวมศิลปินทุกคนที่มีเพลงในคลัง แล้วคลิกเพื่อกรองคลังเพลงต่อ
// ==========================================

const FALLBACK_ARTIST_COLORS = [
    '#0a84ff', '#ff375f', '#30d158', '#ff9f0a', '#bf5af2',
    '#64d2ff', '#ff6482', '#ffd60a', '#5e5ce6', '#66d4cf'
];

window.artistSort = 'name';

window.getArtistColor = function(name) {
    if (window.SINGER_COLORS && window.SINGER_COLORS[name]) return window.SINGER_COLORS[name];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return FALLBACK_ARTIST_COLORS[hash % FALLBACK_ARTIST_COLORS.length];
};

// รวมชื่อนักร้องจากทุกเพลง -> { name, color, count, plays, latestAt, cover }
window.getArtistList = function() {
    const map = new Map();
    const songs = window.songs || [];

    const ensure = (rawName) => {
        const name = (rawName || '').trim();
        if (!name || name === 'ดนตรี') return null;
        if (!map.has(name)) {
            map.set(name, { name, color: window.getArtistColor(name), count: 0, plays: 0, latestAt: 0, cover: '' });
        }
        return map.get(name);
    };

    if (window.SINGER_COLORS) Object.keys(window.SINGER_COLORS).forEach(n => ensure(n));

    songs.forEach(song => {
        window.getSingersList(song.artist).forEach(rawName => {
            const entry = ensure(rawName);
            if (!entry) return;
            entry.count++;
            entry.plays += song.plays || 0;
            entry.latestAt = Math.max(entry.latestAt, song.createdAt || 0);
            if (!entry.cover) {
                const videoId = window.extractYouTubeID(song.audioPath);
                if (videoId) entry.cover = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            }
        });
    });

    return Array.from(map.values());
};

function sortArtistList(list) {
    const mode = window.artistSort;
    return list.sort((a, b) => {
        if (mode === 'songs') return b.count - a.count || a.name.localeCompare(b.name, 'th');
        if (mode === 'plays') return b.plays - a.plays || a.name.localeCompare(b.name, 'th');
        if (mode === 'newest') return b.latestAt - a.latestAt || a.name.localeCompare(b.name, 'th');
        return a.name.localeCompare(b.name, 'th');
    });
}

window.setArtistSort = function(value) {
    window.artistSort = value;
    window.renderArtistList();
};

window.filterArtistList = function() {
    window.renderArtistList();
};

// คลิกการ์ดศิลปิน -> เปิดคลังเพลงพร้อมกรองเฉพาะศิลปินคนนั้น
window.openArtistSongs = function(artistName) {
    window.currentFilter = artistName;
    if (window.wm) window.wm.openLibrary();
    else if (window.filterByArtist) window.filterByArtist(artistName);
};

window.renderArtistList = function() {
    const grid = document.getElementById('artistGrid');
    if (!grid) return;

    const searchEl = document.getElementById('artistSearch');
    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();

    const countEl = document.getElementById('artistCount');

    if (!window.songs || window.songs.length === 0) {
        grid.innerHTML = '';
        if (countEl) countEl.textContent = '';
        return;
    }

    let list = window.getArtistList();
    const total = list.length;

    if (q) list = list.filter(a => a.name.toLowerCase().includes(q));

    list = sortArtistList(list);

    if (countEl) {
        countEl.textContent = q
            ? `พบ ${list.length} จาก ${total} ศิลปิน`
            : `${total} ศิลปิน`;
    }

    if (list.length === 0) {
        grid.innerHTML = `<div class="artist-empty">ไม่พบศิลปินที่ค้นหา</div>`;
        return;
    }

    grid.innerHTML = list.map(a => {
        const safeName = a.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const coverStyle = a.cover ? ` style="background-image:url('${a.cover}')"` : '';
        return `
            <div class="artist-card" onclick="openArtistSongs('${safeName}')" title="ดูเพลงของ ${a.name}">
                <div class="artist-card-avatar"${coverStyle}>
                    <span class="artist-card-initial" style="color:${a.color};">${a.name.charAt(0).toUpperCase()}</span>
                </div>
                <div class="artist-card-info">
                    <div class="artist-card-name" style="color:${a.color};">${a.name}</div>
                    <div class="artist-card-meta">${a.count} เพลง · 👁 ${a.plays}</div>
                </div>
            </div>
        `;
    }).join('');
};
