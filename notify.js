// ==========================================
// 📋 ระบบประวัติการอัปเดตเพลง (Patch Notes)
// ==========================================

window.checkNewSongsNotification = function() {
    if (!window.songs || window.songs.length === 0) return;

    // 🔴 สำหรับตัวเลขแจ้งเตือนสีแดง (Badge) ยังคงให้แสดงเฉพาะเพลงใหม่ใน 7 วัน
    // เพื่อให้ทำงานเป็น "การแจ้งเตือน" ที่แท้จริง
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const newSongsCount = window.songs.filter(s => s.createdAt && (now - s.createdAt) <= sevenDaysMs).length;

    const badge = document.getElementById('notifyBadge');
    if (badge) {
        if (newSongsCount > 0) {
            badge.style.display = 'block';
            badge.innerText = newSongsCount;
        } else {
            badge.style.display = 'none';
        }
    }
};

window.openNotifyWindow = function() {
    if (!window.songs || window.songs.length === 0) return;

    // ดึงเพลงทั้งหมดที่มี createdAt เรียงใหม่สุด -> เก่าสุด
    const allSortedSongs = window.songs
        .filter(s => s.createdAt)
        .sort((a, b) => b.createdAt - a.createdAt);

    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(4, 1fr)';
    container.style.gap = '14px';
    container.style.maxHeight = '72vh';
    container.style.overflowY = 'auto';
    container.style.padding = '10px 0';
    container.style.width = '100%';

    if (allSortedSongs.length === 0) {
        container.style.gridTemplateColumns = '1fr';
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--text-3); padding:60px 0;">ไม่มีข้อมูลประวัติการเพิ่มเพลง</div>';
    } else {
        allSortedSongs.forEach(song => {
            const item = document.createElement('div');
            item.className = 'song-card';
            item.onclick = () => { window.closeSheet(); window.playSong(song.id); };

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
                    dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                }
            }

            item.innerHTML = `
                <div class="song-card-thumb"><img src="${thumbUrl}" onerror="this.style.display='none'" loading="lazy"></div>
                <div class="song-card-views" title="เพิ่มเมื่อ ${dateStr || '—'}">📅 ${dateStr || '—'}</div>
                <div class="song-card-title">${song.title}</div>
                <div class="song-card-artist">🎤 ${song.artist || '-'}</div>
            `;
            container.appendChild(item);
        });
    }

    window.openSheet('📋 ประวัติการเพิ่มเพลงทั้งหมด', container);
};
