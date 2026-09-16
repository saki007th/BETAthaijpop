// ==========================================
// userdata.js - คิวเพลง (Queue) + Playlist ส่วนตัว (อิงตามบัญชี Google)
// ==========================================
import { db, doc, setDoc, getDoc } from './config.js';

window.playQueue = [];          // array ของ song id ที่จะเล่นถัดไปตามลำดับ
window.userPlaylists = [];      // [{ pid, name, songIds: [] }]

const GUEST_QUEUE_KEY = 'ujm_guest_queue';
const GUEST_PLAYLISTS_KEY = 'ujm_guest_playlists';

function getUid() { return (window.currentUser && window.currentUser.uid) ? window.currentUser.uid : null; }

function userDataDocRef() {
    const uid = getUid();
    if (!uid) return null;
    return doc(db, 'userData', uid);
}

// ---------- Toast แจ้งเตือนเล็กๆ ----------
window.showToast = function(message) {
    let toast = document.getElementById('queue-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'queue-toast';
        toast.style.cssText = 'position:fixed; bottom:86px; left:50%; transform:translateX(-50%); background:rgba(10,132,255,.95); color:#fff; padding:10px 20px; border-radius:30px; font-size:13px; font-weight:600; box-shadow:0 6px 20px rgba(0,0,0,.4); z-index:99999; opacity:0; transition:opacity .3s ease; pointer-events:none; white-space:nowrap;';
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
};

// ---------- Load จาก localStorage (guest) ----------
function loadGuestData() {
    try { window.playQueue = JSON.parse(localStorage.getItem(GUEST_QUEUE_KEY)) || []; } catch (e) { window.playQueue = []; }
    try { window.userPlaylists = JSON.parse(localStorage.getItem(GUEST_PLAYLISTS_KEY)) || []; } catch (e) { window.userPlaylists = []; }
}

function saveGuestData() {
    try { localStorage.setItem(GUEST_QUEUE_KEY, JSON.stringify(window.playQueue)); } catch (e) {}
    try { localStorage.setItem(GUEST_PLAYLISTS_KEY, JSON.stringify(window.userPlaylists)); } catch (e) {}
}

// ==========================================
// ⬇️ โหลดข้อมูลคิว + Playlist ของผู้ใช้ที่ล็อกอิน
// ==========================================
window.loadUserData = async function() {
    const uid = getUid();
    const userDocRef = userDataDocRef();

    if (!uid || !userDocRef) {
        loadGuestData();
        window.renderQueuePanel();
        window.renderPlaylistsView();
        return;
    }

    try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
            const data = snap.data();
            window.playQueue = Array.isArray(data.queue) ? data.queue : [];
            window.userPlaylists = Array.isArray(data.playlists) ? data.playlists : [];
        } else {
            window.playQueue = [];
            window.userPlaylists = [];
            await window.saveQueue();
            await window.savePlaylists();
        }
        // กันค่าไอดีเพลงเก่า/หาย (เฉพาะเมื่อโหลด songs มาแล้วเท่านั้น)
        window.cleanupUserData();

        window.updateQueueBadges();
        window.renderQueuePanel();
        window.renderPlaylistsView();
    } catch (e) {
        console.error("Error loading user data:", e);
    }
};

// ล้าง id เพลงที่ไม่มีอยู่จริงในคลังออก (เรียกใหม่ทุกครั้งที่โหลด songs เสร็จ)
window.cleanupUserData = function() {
    if (!window.songs || window.songs.length === 0) return false;
    const validIds = new Set(window.songs.map(s => s.id));
    const beforeLen = window.playQueue.length;
    const playlistNeedsClean = window.userPlaylists.some(p => (p.songIds || []).some(id => !validIds.has(id)));
    window.playQueue = window.playQueue.filter(id => validIds.has(id));
    window.userPlaylists = window.userPlaylists.map(p => ({ ...p, songIds: (p.songIds || []).filter(id => validIds.has(id)) }));
    if (beforeLen !== window.playQueue.length) window.saveQueue();
    if (playlistNeedsClean) window.savePlaylists();
    window.updateQueueBadges();
    window.renderQueuePanel();
    window.renderPlaylistsView();
    return beforeLen !== window.playQueue.length;
};

let _queueWriteChain = Promise.resolve();
async function persistQueue() {
    _queueWriteChain = _queueWriteChain.then(async () => {
        const uid = getUid();
        const ref = userDataDocRef();
        if (uid && ref) {
            await setDoc(ref, { queue: window.playQueue }, { merge: true });
        } else {
            saveGuestData();
        }
    }).catch(e => console.error("Error saving queue:", e));
    return _queueWriteChain;
}

let _playlistsWriteChain = Promise.resolve();
async function persistPlaylists() {
    _playlistsWriteChain = _playlistsWriteChain.then(async () => {
        const uid = getUid();
        const ref = userDataDocRef();
        if (uid && ref) {
            await setDoc(ref, { playlists: window.userPlaylists }, { merge: true });
        } else {
            saveGuestData();
        }
    }).catch(e => console.error("Error saving playlists:", e));
    return _playlistsWriteChain;
}

window.saveQueue = function() {
    window.updateQueueBadges();
    window.renderQueuePanel();
    return persistQueue();
};

window.savePlaylists = function() {
    window.renderPlaylistsView();
    return persistPlaylists();
};

// ==========================================
// 🔢 อัปเดตตัวเลขบนปุ่มคิว (แถบ player + sidebar)
// ==========================================
window.updateQueueBadges = function() {
    const count = window.playQueue ? window.playQueue.length : 0;
    const badge = document.getElementById('queueCountBadge');
    const navBadge = document.getElementById('queueNavCount');
    const panelCount = document.getElementById('queuePanelCount');
    const npBadge = document.getElementById('npQueueCount');
    const npControlsBadge = document.getElementById('npControlsQueueCount');
    if (badge) { badge.style.display = count > 0 ? 'flex' : 'none'; badge.innerText = count; }
    if (navBadge) { navBadge.style.display = count > 0 ? 'flex' : 'none'; navBadge.innerText = count; }
    if (panelCount) panelCount.innerText = count;
    if (npBadge) { npBadge.style.display = count > 0 ? 'flex' : 'none'; npBadge.innerText = count; }
    if (npControlsBadge) { npControlsBadge.style.display = count > 0 ? 'flex' : 'none'; npControlsBadge.innerText = count; }
};

// ==========================================
// 🎵 ระบบคิวเพลง
// ==========================================
window.addToQueue = function(songId) {
    if (!songId) return;
    const song = (window.songs || []).find(s => s.id === songId);
    if (window.playQueue.includes(songId)) {
        window.showToast('🎵 เพลงนี้อยู่ในคิวแล้ว');
        return;
    }
    window.playQueue.push(songId);
    window.saveQueue();
    window.showToast(`✅ เพิ่ม "${song ? song.title : 'เพลง'}" เข้าคิวแล้ว`);
};

window.removeFromQueue = function(index) {
    if (index < 0 || index >= window.playQueue.length) return;
    window.playQueue.splice(index, 1);
    window.saveQueue();
};

window.moveInQueue = function(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= window.playQueue.length) return;
    toIndex = Math.max(0, Math.min(window.playQueue.length - 1, toIndex));
    if (fromIndex === toIndex) return;
    const item = window.playQueue.splice(fromIndex, 1)[0];
    window.playQueue.splice(toIndex, 0, item);
    window.saveQueue();
};

window.clearQueue = function() {
    if (window.playQueue.length === 0) return;
    window.playQueue = [];
    window.saveQueue();
    window.showToast('🗑️ ล้างคิวเพลงแล้ว');
};

// หยิบเพลงแรกของคิวไปเล่น (กินเพลงนั้นออกจากคิว)
window.takeNextFromQueue = function() {
    if (!window.playQueue || window.playQueue.length === 0) return null;
    const nextId = window.playQueue.shift();
    window.saveQueue();
    return nextId;
};

window.playQueueHead = function() {
    const nextId = window.takeNextFromQueue();
    if (nextId && window.playSong) window.playSong(nextId);
};

// ==========================================
// 📃 ระบบ Playlist ส่วนตัว
// ==========================================
window.requireLogin = function() {
    if (!window.isLoggedIn) {
        window.showToast('🔒 กรุณาเข้าสู่ระบบด้วยบัญชี Google ก่อน');
        return false;
    }
    return true;
};

window.createPlaylist = function(name) {
    if (!name) return false;
    if (!window.requireLogin()) return false;
    const cleanName = name.trim();
    if (!cleanName) return false;
    if (window.userPlaylists.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
        window.showToast('⚠️ มี Playlist ชื่อนี้อยู่แล้ว');
        return false;
    }
    window.userPlaylists.push({ pid: 'pl_' + Date.now(), name: cleanName, songIds: [] });
    window.savePlaylists();
    window.openPlaylistsView();
    return true;
};

window.deletePlaylist = function(pid) {
    if (!confirm('ต้องการลบ Playlist นี้ใช่หรือไม่?')) return;
    window.userPlaylists = window.userPlaylists.filter(p => p.pid !== pid);
    window.savePlaylists();
    if (window._currentPlaylistId === pid) window._currentPlaylistId = null;
    window.openPlaylistsView();
};

window.renamePlaylist = function(pid) {
    const pl = window.userPlaylists.find(p => p.pid === pid);
    if (!pl) return;
    const newName = prompt('เปลี่ยนชื่อ Playlist:', pl.name);
    if (newName && newName.trim()) {
        pl.name = newName.trim();
        window.savePlaylists();
    }
};

window.addSongToPlaylist = function(songId, pid) {
    if (!window.requireLogin()) return;
    const pl = window.userPlaylists.find(p => p.pid === pid);
    if (!pl) return;
    if (pl.songIds.includes(songId)) { window.showToast('เพลงนี้อยู่ใน Playlist แล้ว'); return; }
    pl.songIds.push(songId);
    window.savePlaylists();
    const song = (window.songs || []).find(s => s.id === songId);
    window.showToast(`✅ เพิ่ม "${song ? song.title : 'เพลง'}" ลงใน "${pl.name}" แล้ว`);
};

window.removeSongFromPlaylist = function(pid, songId) {
    const pl = window.userPlaylists.find(p => p.pid === pid);
    if (!pl) return;
    pl.songIds = pl.songIds.filter(id => id !== songId);
    window.savePlaylists();
};

window.playPlaylist = function(pid) {
    const pl = window.userPlaylists.find(p => p.pid === pid);
    if (!pl || !window.playSong) return;
    const validIds = (window.songs || []).map(s => s.id);
    const ids = pl.songIds.filter(id => validIds.includes(id));
    if (ids.length === 0) { window.showToast('Playlist นี้ยังไม่มีเพลง'); return; }

    // เล่นเพลงแรกทันที เพลงที่เหลือเรียงเป็นคิวต่อ (เล่นจบแล้ววนใน Playlist ก่อน)
    const remaining = window.playQueue.filter(id => !ids.includes(id));
    window.playQueue = [...ids.slice(1), ...remaining];
    window.saveQueue();
    window.openQueuePanel();
    window.playSong(ids[0]);
    window.showToast(`▶️ กำลังเล่น "${pl.name}"`);
};

// เพิ่มทั้ง Playlist ต่อท้ายคิว
window.addPlaylistToQueue = function(pid) {
    const pl = window.userPlaylists.find(p => p.pid === pid);
    if (!pl) return;
    const validIds = (window.songs || []).map(s => s.id);
    const ids = pl.songIds.filter(id => validIds.includes(id) && !window.playQueue.includes(id));
    if (ids.length === 0) { window.showToast('ไม่มีเพลงใหม่ที่จะเพิ่ม'); return; }
    window.playQueue.push(...ids);
    window.saveQueue();
    window.showToast(`✅ เพิ่ม ${ids.length} เพลงจาก "${pl.name}" เข้าคิวแล้ว`);
};

// ==========================================
// 🖼️ วาด UI คิว
// ==========================================
window.openQueuePanel = function() {
    window.renderQueuePanel();
    const panel = document.getElementById('queuePanel');
    if (panel) panel.classList.add('active');
};

window.closeQueuePanel = function() {
    const panel = document.getElementById('queuePanel');
    if (panel) panel.classList.remove('active');
};

window.renderQueuePanel = function() {
    const container = document.getElementById('queueList');
    if (!container) return;

    window.updateQueueBadges();

    if (!window.playQueue || window.playQueue.length === 0) {
        container.innerHTML = '<div class="queue-empty">คิวยังว่าง<br><span style="font-size:.85em; color:var(--text-3);">กดปุ่ม ➕ คิว ที่เพลงเพื่อเพิ่มเพลงที่จะเล่นถัดไป</span></div>';
        return;
    }

    container.innerHTML = '';

    window.playQueue.forEach((songId, index) => {
        const song = (window.songs || []).find(s => s.id === songId);
        if (!song) return;
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';

        const item = document.createElement('div');
        item.className = 'queue-item';
        item.innerHTML = `
            <div class="queue-item-thumb"><img src="${thumbUrl}" onerror="this.style.display='none'"></div>
            <div class="queue-item-info">
                <div class="queue-item-title">${song.title}</div>
                <div class="queue-item-artist">🎤 ${song.artist || '-'}</div>
            </div>
            <div class="queue-item-controls">
                <button class="q-btn" onclick="window.moveInQueue(${index}, ${index - 1})" title="เลื่อนขึ้น" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button>
                <button class="q-btn" onclick="window.moveInQueue(${index}, ${index + 1})" title="เลื่อนลง" ${index === window.playQueue.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button>
                <button class="q-btn" onclick="window.playQueueEntry(${index})" title="เล่นเลย"><i class="fa-solid fa-play"></i></button>
                <button class="q-btn q-btn-danger" onclick="window.removeFromQueue(${index})" title="ลบออกจากคิว"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
};

// เล่นเพลงตำแหน่งว่าในคิว เอาตัวมันและของก่อนหน้าออก (กลายเป็นเพลงถัดไป)
window.playQueueEntry = function(index) {
    const targetId = window.playQueue[index];
    if (!targetId) return;
    window.playQueue = window.playQueue.filter((id, i) => i >= index);
    window.saveQueue();
    if (window.playSong) window.playSong(targetId);
};

// ==========================================
// 🖼️ หน้า Playlists
// ==========================================
window.openPlaylistsView = function() {
    if (window.wm) window.wm.showView('playlists');
    if (window.renderPlaylistsView) window.renderPlaylistsView();
};

window.renderPlaylistsView = function() {
    const container = document.getElementById('playlistsContainer');
    if (!container) return;

    // ถ้ากำลังดู Playlist เดี่ยว (detail)
    if (window._currentPlaylistId) {
        renderPlaylistDetail(window._currentPlaylistId);
        return;
    }

    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'playlist-header';
    header.innerHTML = `
        <div class="playlist-header-left">
            <span class="playlist-count">คุณมี ${window.userPlaylists.length} เพลย์ลิสต์</span>
        </div>
        <button class="btn-primary" onclick="window.promptNewPlaylist()">➕ สร้าง Playlist</button>
    `;
    container.appendChild(header);

    if (!window.isLoggedIn) {
        const guest = document.createElement('div');
        guest.className = 'playlist-login-hint';
        guest.innerHTML = '🔒 <b>เข้าสู่ระบบด้วยบัญชี Google</b> เพื่อสร้างและบันทึก Playlist ส่วนตัวของคุณ (จะถูกบันทึกไว้ตามบัญชีที่ใช้)';
        container.appendChild(guest);
    }

    if (window.userPlaylists.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'queue-empty';
        empty.innerHTML = 'ยังไม่มี Playlist<br><span style="font-size:.85em; color:var(--text-3);">กด "สร้าง Playlist" เพื่อเริ่มต้น แล้วเพิ่มเพลงจากคลังเพลงได้เลย</span>';
        container.appendChild(empty);
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'playlist-grid';
    window.userPlaylists.forEach(pl => {
        const card = document.createElement('div');
        card.className = 'playlist-card';

        // หน้าปก: สุ่มเพลงหนึ่งเพลงใน Playlist ขึ้นมาแสดง (ถ้ามีเพลง)
        let coverStyle = '';
        let coverEmoji = '🎧';
        if (pl.songIds.length > 0) {
            const validSongs = pl.songIds.map(id => (window.songs || []).find(s => s.id === id)).filter(Boolean);
            if (validSongs.length > 0) {
                const coverSong = validSongs[Math.floor(Math.random() * validSongs.length)];
                const vId = window.extractYouTubeID(coverSong.audioPath);
                if (vId) {
                    coverStyle = `background-image:url('https://img.youtube.com/vi/${vId}/mqdefault.jpg');`;
                    coverEmoji = '';
                }
            }
        }

        card.innerHTML = `
            <div class="playlist-card-top">
                <div class="playlist-card-cover" style="${coverStyle}">${coverEmoji}</div>
                <div class="playlist-card-name">${pl.name}</div>
                <div class="playlist-card-count">${pl.songIds.length} เพลง</div>
            </div>
            <div class="playlist-card-actions">
                <button class="btn-secondary" onclick="event.stopPropagation(); window.playPlaylist('${pl.pid}')">▶️ เล่น</button>
                <button class="btn-secondary" onclick="event.stopPropagation(); window.addPlaylistToQueue('${pl.pid}')">➕ คิว</button>
                <button class="btn-secondary" onclick="event.stopPropagation(); window.openPlaylistDetail('${pl.pid}')">เปิด</button>
                <button class="btn-secondary" style="color:var(--danger);" onclick="event.stopPropagation(); window.deletePlaylist('${pl.pid}')">🗑</button>
            </div>
        `;
        grid.appendChild(card);
    });
    container.appendChild(grid);
};

window.promptNewPlaylist = function() {
    if (!window.requireLogin()) return;
    const name = prompt('ชื่อ Playlist ใหม่:');
    if (name) window.createPlaylist(name);
};

window.openPlaylistDetail = function(pid) {
    window._currentPlaylistId = pid;
    window.renderPlaylistsView();
};

window.closePlaylistDetail = function() {
    window._currentPlaylistId = null;
    window.renderPlaylistsView();
};

function renderPlaylistDetail(pid) {
    const container = document.getElementById('playlistsContainer');
    const pl = window.userPlaylists.find(p => p.pid === pid);
    if (!pl) { window.closePlaylistDetail(); return; }
    container.innerHTML = '';

    const header = document.createElement('div');
    header.innerHTML = `
        <div class="playlist-detail-header">
            <button class="btn-secondary" onclick="window.closePlaylistDetail()">← กลับ</button>
            <div class="playlist-detail-title">🎧 ${pl.name}</div>
            <button class="btn-secondary" onclick="window.renamePlaylist('${pid}')">✏️ เปลี่ยนชื่อ</button>
        </div>
        <div class="playlist-detail-sub">
            <span>${pl.songIds.length} เพลง</span>
            <div style="display:flex; gap:8px;">
                <button class="btn-primary" onclick="window.playPlaylist('${pid}')">▶️ เล่นทั้งหมด</button>
                <button class="btn-secondary" onclick="window.addPlaylistToQueue('${pid}')">➕ เพิ่มคิว</button>
            </div>
        </div>
    `;
    container.appendChild(header);

    if (pl.songIds.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'queue-empty';
        empty.innerHTML = 'Playlist ยังว่าง<br><span style="font-size:.85em; color:var(--text-3);">ไปที่ คลังเพลง แล้วกดปุ่ม 📂 เพื่อเพิ่มเพลง</span>';
        container.appendChild(empty);
        return;
    }

    const list = document.createElement('div');
    list.className = 'queue-list-wide';
    pl.songIds.forEach(songId => {
        const song = (window.songs || []).find(s => s.id === songId);
        if (!song) return;
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
        const item = document.createElement('div');
        item.className = 'queue-item';
        item.innerHTML = `
            <div class="queue-item-thumb"><img src="${thumbUrl}" onerror="this.style.display='none'"></div>
            <div class="queue-item-info">
                <div class="queue-item-title">${song.title}</div>
                <div class="queue-item-artist">🎤 ${song.artist || '-'}</div>
            </div>
            <div class="queue-item-controls">
                <button class="q-btn" onclick="window.playSong('${song.id}')" title="เล่น"><i class="fa-solid fa-play"></i></button>
                <button class="q-btn" onclick="window.addToQueue('${song.id}')" title="เพิ่มคิว"><i class="fa-solid fa-plus"></i></button>
                <button class="q-btn q-btn-danger" onclick="window.removeSongFromPlaylist('${pid}','${song.id}')" title="ลบจาก Playlist"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        list.appendChild(item);
    });
    container.appendChild(list);
}