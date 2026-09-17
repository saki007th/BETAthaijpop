import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDV-gefPFqCmAvYmrSXeb5W1JUKf4Ev50Q",
    authDomain: "musix-syn.firebaseapp.com",
    projectId: "musix-syn",
    storageBucket: "musix-syn.firebasestorage.app",
    messagingSenderId: "154980084057",
    appId: "1:154980084057:web:e0af2ed833cb127f3b8448",
    measurementId: "G-2NCK3PQEFV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const songsCollection = collection(db, 'songs');

window.mobileSongs = [];
window.currentMobileSongIndex = -1;
window.ytPlayer = null;

// ==========================================
// 1. โหลดข้อมูลเพลง
// ==========================================
async function fetchMobileSongs() {
    try {
        const querySnapshot = await getDocs(songsCollection);
        window.mobileSongs = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            window.mobileSongs.push({ id: doc.id, title: data.title, artist: data.artist, audioPath: data.audioPath, plays: data.plays || 0 });
        });
        
        renderLibrary();
        renderHomeWidget();
    } catch (error) {
        console.error("Error loading songs:", error);
    }
}

// ==========================================
// 2. วาด UI
// ==========================================
function extractYouTubeID(url) {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
}

function renderLibrary(query = '') {
    const container = document.getElementById('mobileSongList');
    container.innerHTML = '';
    
    const filtered = window.mobileSongs.filter(song => {
        const q = query.toLowerCase();
        return (song.title.toLowerCase().includes(q) || (song.artist && song.artist.toLowerCase().includes(q)));
    });

    filtered.forEach((song, index) => {
        const videoId = extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
        const realIndex = window.mobileSongs.findIndex(s => s.id === song.id);
        
        container.innerHTML += `
            <div class="song-item" onclick="playMobileSong(${realIndex})">
                <img src="${thumbUrl}" onerror="this.src=''">
                <div class="song-info">
                    <div class="song-title">${song.title} <span class="song-views">👁 ${song.plays || 0}</span></div>
                    <div class="song-artist">🎤 ${song.artist || '-'}</div>
                </div>
            </div>
        `;
    });
}

window.searchMobileSongs = function() {
    const q = document.getElementById('mobileSearch').value;
    renderLibrary(q);
}

function renderHomeWidget() {
    const container = document.getElementById('mobileRandomSongs');
    const artistContainer = document.getElementById('mobileArtistWidget');
    if(window.mobileSongs.length === 0) return;

    // 1. สุ่มเพลงน่าฟัง 5 เพลง
    let shuffled = [...window.mobileSongs].sort(() => 0.5 - Math.random());
    container.innerHTML = '';
    shuffled.slice(0, 5).forEach(song => {
        const videoId = extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';
        const realIndex = window.mobileSongs.findIndex(s => s.id === song.id);
        
        container.innerHTML += `
            <div class="song-item" onclick="playMobileSong(${realIndex})">
                <img src="${thumbUrl}">
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist || '-'}</div>
                </div>
            </div>
        `;
    });

    // 2. สุ่มศิลปิน
    const randomSong = window.mobileSongs[Math.floor(Math.random() * window.mobileSongs.length)];
    const artistName = randomSong.artist ? randomSong.artist.split(',')[0] : 'Unknown';
    const artistSongs = window.mobileSongs.filter(s => (s.artist||'').includes(artistName));
    
    let html = `<div class="artist-card-title">${artistName}</div>`;
    artistSongs.slice(0,3).forEach(song => {
        const videoId = extractYouTubeID(song.audioPath);
        const realIndex = window.mobileSongs.findIndex(s => s.id === song.id);
        html += `
            <div class="song-item" style="background: rgba(255,255,255,0.1); margin-bottom: 8px;" onclick="playMobileSong(${realIndex})">
                <img src="https://img.youtube.com/vi/${videoId}/default.jpg">
                <div class="song-info">
                    <div class="song-title" style="font-size: 13px;">${song.title}</div>
                </div>
            </div>
        `;
    });
    artistContainer.innerHTML = html;
}

// ==========================================
// 3. ระบบเล่นเพลง (YouTube)
// ==========================================
window.playMobileSong = function(index) {
    if(index < 0 || index >= window.mobileSongs.length) return;
    window.currentMobileSongIndex = index;
    const song = window.mobileSongs[index];
    const videoId = extractYouTubeID(song.audioPath);
    const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';

    // อัปเดต Mini Player
    document.getElementById('mini-player').classList.remove('hidden');
    document.getElementById('mini-thumb').src = thumbUrl;
    document.getElementById('mini-title').innerText = song.title;
    document.getElementById('mini-artist').innerText = song.artist || '-';
    
    // อัปเดต Full Player
    document.getElementById('full-thumb').src = thumbUrl;
    document.getElementById('full-title').innerText = song.title;
    document.getElementById('full-artist').innerText = song.artist || '-';

    // โหลดเพลง
    if(window.ytPlayer && typeof window.ytPlayer.loadVideoById === 'function') {
        window.ytPlayer.loadVideoById(videoId);
    } else {
        window.ytPlayer = new YT.Player('player-youtube', {
            videoId: videoId,
            playerVars: { 'playsinline': 1, 'controls': 0, 'autoplay': 1 },
            events: { 'onStateChange': onPlayerStateChange }
        });
    }
}

window.toggleMobilePlay = function() {
    if(!window.ytPlayer) return;
    const state = window.ytPlayer.getPlayerState();
    if(state === 1) window.ytPlayer.pauseVideo();
    else window.ytPlayer.playVideo();
}

window.nextMobileSong = function() {
    const nextIdx = (window.currentMobileSongIndex + 1) % window.mobileSongs.length;
    window.playMobileSong(nextIdx);
}
window.prevMobileSong = function() {
    let prevIdx = window.currentMobileSongIndex - 1;
    if(prevIdx < 0) prevIdx = window.mobileSongs.length - 1;
    window.playMobileSong(prevIdx);
}

function onPlayerStateChange(event) {
    const miniBtn = document.getElementById('mini-play-btn');
    const fullBtn = document.getElementById('full-play-btn');
    if (event.data === 1) { // Playing
        miniBtn.innerText = '⏸'; fullBtn.innerText = '⏸';
    } 
    else if (event.data === 2) { // Paused
        miniBtn.innerText = '▶'; fullBtn.innerText = '▶';
    }
    else if (event.data === 0) { // Ended
        window.nextMobileSong();
    }
}

// เริ่มโหลดข้อมูล
document.addEventListener('DOMContentLoaded', fetchMobileSongs);
