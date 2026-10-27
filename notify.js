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
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    container.style.gap = '24px';
    container.style.padding = '24px';
    container.style.width = '100%';
    container.style.boxSizing = 'border-box';

    if (allSortedSongs.length === 0) {
        container.style.gridTemplateColumns = '1fr';
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--text-3); padding:60px 0;">ไม่มีข้อมูลประวัติการเพิ่มเพลง</div>';
    } else {
        allSortedSongs.forEach(song => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.flexDirection = 'column';
            item.style.gap = '10px';
            item.style.background = 'var(--bg-elevated)';
            item.style.borderRadius = 'var(--r-m)';
            item.style.padding = '14px';
            item.style.cursor = 'pointer';
            item.style.transition = 'background 0.2s';
            item.onclick = () => { window.closeSheet(); window.playSong(song.id); };
            item.onmouseover = () => { item.style.background = 'var(--bg-elevated-hover)'; };
            item.onmouseout = () => { item.style.background = 'var(--bg-elevated)'; };

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
                ${thumbUrl ? `<img src="${thumbUrl}" style="width:100%; height:180px; object-fit:cover; border-radius:var(--r-s); background:var(--bg-surface-2);" onerror="this.style.display='none'">` : '<div style="width:100%; height:180px; background:var(--bg-surface-2); border-radius:var(--r-s); display:flex; align-items:center; justify-content:center; color:var(--text-3);">ไม่มีภาพ</div>'}
                <div style="font-weight:600; font-size:14px; color:var(--text-1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${song.title}</div>
                <div style="font-size:12px; color:var(--text-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🎤 ${song.artist || '-'}</div>
                <div style="font-size:11px; color:var(--text-3); margin-top:4px;">📅 ${dateStr || '—'}</div>
            `;
            container.appendChild(item);
        });
    }

    window.openSheet('📋 ประวัติการเพิ่มเพลงทั้งหมด', container);
};
