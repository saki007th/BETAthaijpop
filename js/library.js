// ==========================================
// library.js - song data, library list, admin add/edit/delete
// ==========================================
import { db, songsCollection, getDocs, addDoc, updateDoc, doc, deleteDoc } from './config.js';

window.songs = [];
window.currentFilter = 'All';
window.songSort = 'alpha';

window.setSongSort = function(value) {
    window.songSort = value;
    window.renderSongList(document.getElementById('searchInput').value.toLowerCase(), window.currentFilter);
};
window.setSongSort = window.setSongSort;

window.updateArtistSuggestions = function() {
    const datalist = document.getElementById('artistList');
    if (!datalist) return;

    const allSingers = new Set();
    if (window.SINGER_COLORS) Object.keys(window.SINGER_COLORS).forEach(s => allSingers.add(s));
    if (window.songs) {
        window.songs.forEach(song => {
            if (song.artist) song.artist.split(',').forEach(s => allSingers.add(s.trim()));
        });
    }

    datalist.innerHTML = '';
    Array.from(allSingers).sort().forEach(singer => {
        if (singer && singer !== 'ดนตรี') {
            const option = document.createElement('option');
            option.value = singer;
            datalist.appendChild(option);
        }
    });
};

export async function fetchSongs() {
    document.getElementById('loadingOverlay').style.display = 'flex';

    try {
        const querySnapshot = await getDocs(songsCollection);
        window.songs = [];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            window.songs.push({
                id: docSnap.id,
                title: data.title,
                artist: data.artist,
                audioPath: data.audioPath,
                lyrics: data.lyrics,
                timestamps: data.timestamps || [],
                singers: data.singers || [],
                covers: data.covers || [],
                createdAt: data.createdAt
            });
        });

        document.getElementById('loadingOverlay').style.display = 'none';

        if (window.cleanupUserData) window.cleanupUserData();

        window.renderRandomPlaylist();
        window.renderArtistWidget();
        if (window.renderRecentlyAdded) window.renderRecentlyAdded();
        if (window.renderHomeStats) window.renderHomeStats();

        if (window.checkNewSongsNotification) window.checkNewSongsNotification();
        if (window.updateArtistSuggestions) window.updateArtistSuggestions();
        if (document.getElementById('view-library').classList.contains('active')) window.renderSongList();

        const urlParams = new URLSearchParams(window.location.search);
        const songIdFromUrl = urlParams.get('song');

        if (songIdFromUrl) {
            const foundSong = window.songs.find(s => s.id === songIdFromUrl);
            if (foundSong) { window.playSong(foundSong.id); return; }
        }

        // 🟢 ตรวจสอบลิงก์แชร์ ถ้าไม่มีการเล่นเพลงจากลิงก์ ก็ปล่อยให้อยู่หน้าแรกตามปกติ
        window.checkSharedLink();

    } catch (error) {
        document.getElementById('loadingOverlay').style.display = 'none';
        console.error("Error fetching songs: ", error);
    }
}
window.fetchSongs = fetchSongs;

window.filterByArtist = function(artistName) {
    window.currentFilter = artistName;
    window.renderSongList(document.getElementById('searchInput').value.toLowerCase(), artistName);
};
window.filterSongs = function() {
    window.renderSongList(document.getElementById('searchInput').value.toLowerCase(), window.currentFilter);
};

window.renderSongList = function(query = '', artistFilter = 'All') {
    const listContainer = document.getElementById('songList');
    const chipContainer = document.getElementById('artistChips');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (chipContainer) {
        let artistSet = new Set();
        window.songs.forEach(s => window.getSingersList(s.artist).forEach(n => artistSet.add(n)));

        const sortedArtists = Array.from(artistSet).sort((a, b) => a.localeCompare(b, 'th'));
        const artists = ['All', ...sortedArtists];

        chipContainer.innerHTML = artists.map(a => `<button class="chip ${artistFilter === a ? 'active' : ''}" onclick="filterByArtist('${a}')">${a === 'All' ? 'ทั้งหมด' : a}</button>`).join('');
    }

    const filtered = window.songs.filter(song => {
        const q = query.toLowerCase(); const artist = song.artist || '';
        return ((song.title && song.title.toLowerCase().includes(q)) || artist.toLowerCase().includes(q)) && (artistFilter === 'All' || artist.includes(artistFilter));
    });

    filtered.sort((a, b) => {
        if (window.songSort === 'alpha') return (a.title || '').localeCompare(b.title || '', 'th');
        if (window.songSort === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
        if (window.songSort === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
        return 0;
    });

    filtered.forEach(song => {
        const item = document.createElement('div'); item.className = 'song-card';
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
        let actionsHtml = window.isAdmin ? `<button class="btn-secondary" onclick="event.stopPropagation(); editSong('${song.id}')">✏️</button><button class="btn-secondary" style="color:#ff3b30;" onclick="event.stopPropagation(); deleteSong('${song.id}')">ลบ</button>` : '';
        const safeTitle = song.title.replace(/'/g, "\\'");

        item.onclick = () => window.playSong(song.id);
        item.innerHTML = `
            <div class="song-card-thumb"><img src="${thumbUrl}" onerror="this.style.display='none'" loading="lazy">
                <span class="view-badge" data-song="${song.id}">👁 ${window.formatViewCount((window.globalViews || {})[song.id])}</span>
            </div>
            <div class="song-card-title">${song.title}</div>
            <div class="song-card-artist">🎤 ${song.artist || '-'}</div>
            <div class="song-card-actions">
                <button class="share-btn add-queue-btn" onclick="event.stopPropagation(); addToQueue('${song.id}')" title="เพิ่มเข้าคิว">➕ คิว</button>
                <button class="share-btn add-playlist-btn" onclick="event.stopPropagation(); openAddToPlaylistMenu(this, '${song.id}')" title="เพิ่มลงใน Playlist">📂</button>
                <button class="share-btn" onclick="event.stopPropagation(); copyShareLink('${safeTitle}', this)">🔗 แชร์</button>
                <div class="song-card-admin">${actionsHtml}</div>
            </div>
        `;
        listContainer.appendChild(item);
    });
};

// ==========================================
// 📂 เมนูเลือก Playlist สำหรับเพิ่มเพลงลงใน Playlist
// ==========================================
window.openAddToPlaylistMenu = function(btn, songId) {
    const existing = document.getElementById('addToPlaylistMenu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'addToPlaylistMenu';
    menu.className = 'add-playlist-menu';
    menu.innerHTML = '';

    if (!window.isLoggedIn) {
        const hint = document.createElement('div');
        hint.className = 'add-playlist-menu-hint';
        hint.innerHTML = '🔒 เข้าสู่ระบบเพื่อบันทึก Playlist ส่วนตัว';
        menu.appendChild(hint);
    }

    const title = document.createElement('div');
    title.className = 'add-playlist-menu-title';
    title.innerText = 'เพิ่มลงใน Playlist';
    menu.appendChild(title);

    if (window.userPlaylists && window.userPlaylists.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'add-playlist-menu-empty';
        empty.innerText = 'ยังไม่มี Playlist';
        menu.appendChild(empty);
    } else {
        (window.userPlaylists || []).forEach(pl => {
            const opt = document.createElement('div');
            opt.className = 'add-playlist-menu-item';
            const inList = pl.songIds.includes(songId);
            opt.innerHTML = `<span>🎧 ${pl.name}</span><span class="apm-arrow">${inList ? '✓' : '＋'}</span>`;
            if (inList) opt.classList.add('in-list');
            opt.onclick = () => { window.addSongToPlaylist(songId, pl.pid); menu.remove(); };
            menu.appendChild(opt);
        });
    }

    const create = document.createElement('div');
    create.className = 'add-playlist-menu-create';
    create.innerHTML = '➕ สร้าง Playlist ใหม่';
    create.onclick = () => {
        const name = prompt('ชื่อ Playlist ใหม่:');
        if (name && window.createPlaylist(name)) {
            const newPl = window.userPlaylists[window.userPlaylists.length - 1];
            window.addSongToPlaylist(songId, newPl.pid);
        }
        menu.remove();
    };
    menu.appendChild(create);

    const rect = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = rect.bottom + 6 + 'px';
    menu.style.left = Math.max(8, Math.min(window.innerWidth - 250, rect.left)) + 'px';
    document.body.appendChild(menu);

    const removeMenu = (e) => {
        const m = document.getElementById('addToPlaylistMenu');
        if (m && !m.contains(e.target) && e.target !== btn) m.remove();
        document.removeEventListener('click', removeMenu);
    };
    setTimeout(() => document.addEventListener('click', removeMenu), 0);
};

// ==========================================
// 🎧 ระบบจัดการข้อมูล Cover ในหน้าเพิ่ม/แก้ไข
// ==========================================
window.currentCoversDraft = [];

window.renderCoverInputs = function() {
    const container = document.getElementById('coverInputsContainer'); if (!container) return;
    container.innerHTML = '';

    window.currentCoversDraft.forEach((cover, index) => {
        const div = document.createElement('div');
        div.style.background = 'rgba(0, 0, 0, 0.2)'; div.style.padding = '10px'; div.style.borderRadius = '8px'; div.style.marginBottom = '10px'; div.style.border = '1px solid rgba(255, 255, 255, 0.05)';

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-size: 0.85em; font-weight: bold; color: #ccc;">Cover #${index + 1}</span>
                <button onclick="removeCoverInput(${index})" style="background: none; border: none; color: #ff3b30; cursor: pointer; font-size: 0.85em;">🗑 ลบ</button>
            </div>
            <input type="text" placeholder="ชื่อคนร้อง (เช่น Gawr Gura)" value="${cover.coverArtist || ''}" style="margin-bottom: 8px; padding: 8px; font-size: 0.9em;" onchange="window.currentCoversDraft[${index}].coverArtist = this.value.trim()">
            <input type="text" placeholder="ลิงก์ YouTube" value="${cover.audioPath || ''}" style="margin-bottom: 0; padding: 8px; font-size: 0.9em;" onchange="window.currentCoversDraft[${index}].audioPath = this.value.trim()">
        `;
        container.appendChild(div);
    });
};

window.addCoverInput = function() {
    window.currentCoversDraft.push({ coverId: 'c_' + Date.now(), coverArtist: '', audioPath: '', timestamps: null, singers: null });
    window.renderCoverInputs();
};
window.removeCoverInput = function(index) {
    if (confirm('ต้องการลบ Cover นี้ใช่หรือไม่? (ลบแล้วต้องกดบันทึกเพลงด้วยนะ)')) { window.currentCoversDraft.splice(index, 1); window.renderCoverInputs(); }
};

window.openAddView = function() {
    if (!window.isAdmin) return;
    window.editingSongId = null;
    document.getElementById('inputTitle').value = ''; document.getElementById('inputArtist').value = ''; document.getElementById('inputAudio').value = ''; document.getElementById('inputLyrics').value = '';
    window.currentCoversDraft = []; window.renderCoverInputs();
    window.wm.openAdd('✨ เพิ่มเพลงใหม่');
};

window.editSong = function(id) {
    if (!window.isAdmin) return;
    const song = window.songs.find(s => s.id === id); if (!song) return;
    window.editingSongId = id;
    document.getElementById('inputTitle').value = song.title; document.getElementById('inputArtist').value = song.artist || ''; document.getElementById('inputAudio').value = song.audioPath; document.getElementById('inputLyrics').value = song.lyrics;
    window.currentCoversDraft = song.covers ? JSON.parse(JSON.stringify(song.covers)) : []; window.renderCoverInputs();
    window.wm.openAdd('✏️ แก้ไขเพลง');
};

window.saveSong = async function() {
    if (!window.isAdmin) return;
    const title = document.getElementById('inputTitle').value.trim(); const artist = document.getElementById('inputArtist').value.trim(); const audioPath = document.getElementById('inputAudio').value.trim(); const lyrics = document.getElementById('inputLyrics').value.trim();
    const btnSave = document.getElementById('btnSave');

    if (!title || !lyrics || !window.extractYouTubeID(audioPath)) { alert("ข้อมูลไม่ครบ หรือลิงก์ผิด"); return; }
    btnSave.disabled = true; btnSave.innerText = "กำลังบันทึก...";

    const validCovers = (window.currentCoversDraft || []).filter(c => c.coverArtist && window.extractYouTubeID(c.audioPath));

    try {
        if (window.editingSongId) {
            await updateDoc(doc(db, "songs", window.editingSongId), { title, artist, audioPath, lyrics, covers: validCovers });
        } else {
            await addDoc(songsCollection, { title, artist, audioPath, lyrics, timestamps: [], singers: [], covers: validCovers, createdAt: Date.now() });
        }
        await fetchSongs();
        window.closeAddModal();
        window.renderSongList();
    } catch (e) { alert("บันทึกไม่สำเร็จ"); } finally { btnSave.disabled = false; btnSave.innerText = "💾 บันทึกเพลง"; window.editingSongId = null; }
};

window.deleteSong = async function(id) {
    if (!window.isAdmin) return;
    if (confirm('ต้องการลบเพลงนี้ใช่หรือไม่?')) {
        try { await deleteDoc(doc(db, "songs", id)); await fetchSongs(); window.renderSongList(); } catch (e) { console.error(e); }
    }
};
