// library.js
// จัดการส่วนของคลังเพลง การค้นหา และการกรองข้อมูล
// เน้นการใช้ DocumentFragment และ createElement เพื่อป้องกัน XSS และเพิ่ม Performance

import { AppState } from './state.js';
import { extractYouTubeID, getSingersList } from './utils.js';
import { playSong } from './player.js'; // จะสร้างในขั้นตอนต่อไป

export function renderSongList(query = '', artistFilter = 'All') {
    const listContainer = document.getElementById('songList');
    const chipContainer = document.getElementById('artistChips');
    if (!listContainer) return;

    // 1. จัดการแถบปุ่มศิลปิน (Artist Chips)
    if (chipContainer) {
        let artistSet = new Set();
        AppState.songsArray.forEach(s => {
            getSingersList(s.artist).forEach(n => artistSet.add(n));
        });
        
        const sortedArtists = Array.from(artistSet).sort((a, b) => a.localeCompare(b, 'th')); 
        const artists = ['All', ...sortedArtists];
        
        chipContainer.textContent = ''; // ล้างข้อมูลเดิม
        const chipFragment = document.createDocumentFragment();
        
        artists.forEach(a => {
            const btn = document.createElement('button');
            btn.className = `chip ${artistFilter === a ? 'active' : ''}`;
            btn.textContent = a === 'All' ? 'ทั้งหมด' : a;
            
            // ใช้ addEventListener แทน onclick
            btn.addEventListener('click', () => filterByArtist(a));
            chipFragment.appendChild(btn);
        });
        chipContainer.appendChild(chipFragment);
    }

    // 2. จัดการรายการเพลง
    listContainer.textContent = ''; // ล้างข้อมูลเดิม
    const fragment = document.createDocumentFragment();
    const q = query.toLowerCase();

    // กรองข้อมูล
    const filtered = AppState.songsArray.filter(song => {
        const artist = song.artist || '';
        const matchQuery = (song.title && song.title.toLowerCase().includes(q)) || artist.toLowerCase().includes(q);
        const matchArtist = (artistFilter === 'All' || artist.includes(artistFilter));
        return matchQuery && matchArtist;
    });

    // สร้าง DOM Elements (ป้องกัน XSS อย่างเด็ดขาดเพราะใช้ textContent)
    filtered.forEach(song => {
        const item = document.createElement('div');
        item.className = 'song-item';

        const videoId = extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
        
        const img = document.createElement('img');
        img.src = thumbUrl;
        img.onerror = () => img.style.display = 'none';

        const infoDiv = document.createElement('div');
        const titleDiv = document.createElement('div');
        titleDiv.className = 'song-title';
        titleDiv.textContent = song.title; 
        
        const artistDiv = document.createElement('div');
        artistDiv.className = 'song-artist';
        artistDiv.textContent = `🎤 ${song.artist || '-'}`; 
        
        infoDiv.append(titleDiv, artistDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'song-actions';
        
        const playBtn = document.createElement('button');
        playBtn.className = 'btn-primary';
        playBtn.textContent = '▶ เล่น';
        playBtn.addEventListener('click', () => playSong(song.id));
        actionsDiv.appendChild(playBtn);

        // แสดงปุ่มแก้ไข/ลบ เฉพาะ Admin
        if (AppState.isAdmin) {
            const editBtn = document.createElement('button');
            editBtn.className = 'btn-secondary';
            editBtn.textContent = '✏️';
            // ปล่อยให้เรียกฟังก์ชันจากฝั่ง admin (จะสร้างภายหลัง)
            editBtn.addEventListener('click', () => { if(window.editSong) window.editSong(song.id); }); 

            const delBtn = document.createElement('button');
            delBtn.className = 'btn-secondary';
            delBtn.style.color = '#ff3b30';
            delBtn.textContent = 'ลบ';
            delBtn.addEventListener('click', () => { if(window.deleteSong) window.deleteSong(song.id); });

            actionsDiv.append(editBtn, delBtn);
        }

        item.append(img, infoDiv, actionsDiv);
        fragment.appendChild(item);
    });

    listContainer.appendChild(fragment); // Render รวดเดียว! Performance พุ่ง
}

export function filterByArtist(artistName) {
    AppState.currentFilter = artistName;
    const searchInput = document.getElementById('searchInput');
    renderSongList(searchInput ? searchInput.value : '', artistName);
}

export function filterSongs() {
    const searchInput = document.getElementById('searchInput');
    renderSongList(searchInput ? searchInput.value : '', AppState.currentFilter);
}

// ผูก Event ให้ Search Input (สมมติว่าเรียกตอน Initialize แอป)
export function initLibraryEvents() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterSongs);
    }
}
