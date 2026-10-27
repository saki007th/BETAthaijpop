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
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
    container.style.gap = '20px';
    container.style.padding = '24px';
    container.style.width = '100%';
    container.style.boxSizing = 'border-box';

    if (allSortedSongs.length === 0) {
        container.style.gridTemplateColumns = '1fr';
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--text-3); padding:60px 0;">ไม่มีข้อมูลประวัติการเพิ่มเพลง</div>';
    } else {
        allSortedSongs.forEach(song => {
            const item = document.createElement('div');
            item.style.position = 'relative';
            item.style.display = 'flex';
            item.style.flexDirection = 'column';
            item.style.background = 'var(--bg-surface-2)';
            item.style.border = '1px solid var(--border-soft)';
            item.style.borderRadius = 'var(--r-l)';
            item.style.overflow = 'hidden';
            item.style.cursor = 'pointer';
            item.style.transition = 'transform .2s var(--ease), box-shadow .2s var(--ease), border-color .2s var(--ease)';
            item.onclick = () => { window.closeSheet(); window.playSong(song.id); };
            item.onmouseenter = () => {
                item.style.transform = 'translateY(-4px)';
                item.style.boxShadow = '0 16px 40px rgba(0,0,0,.5)';
                item.style.borderColor = 'var(--border-strong)';
                const ov = item.querySelector('.history-overlay');
                if (ov) ov.style.display = 'flex';
            };
            item.onmouseleave = () => {
                item.style.transform = 'translateY(0)';
                item.style.boxShadow = 'none';
                item.style.borderColor = 'var(--border-soft)';
                const ov = item.querySelector('.history-overlay');
                if (ov) ov.style.display = 'none';
            };

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
                <div style="position:relative; width:100%; height:180px; background:var(--bg-surface-2); overflow:hidden;">
                    ${thumbUrl ? `<img src="${thumbUrl}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.style.display='none'">` : '<div style="width:100%; height:100%; background:var(--bg-surface-2); display:flex; align-items:center; justify-content:center; color:var(--text-3); font-size:11px;">ไม่มีภาพ</div>'}
                    <div class="history-overlay" style="position:absolute; inset:0; z-index:2; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.45);">
                        <div style="width:44px; height:44px; background:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#000; font-size:17px; font-weight:700; box-shadow:0 4px 12px rgba(0,0,0,.4);">▶</div>
                    </div>
                    <div style="position:absolute; top:12px; left:12px; z-index:4; background:rgba(0,0,0,.65); backdrop-filter:blur(6px); color:#fff; font-size:11px; font-weight:600; padding:4px 10px; border-radius:var(--r-pill); border:1px solid rgba(255,255,255,.2); white-space:nowrap;">📅 ${dateStr || '—'}</div>
                </div>
                <div style="padding:12px 14px 14px; display:flex; flex-direction:column; gap:6px; flex:1;">
                    <div style="font-weight:600; font-size:15px; color:var(--text-1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.3;">${song.title}</div>
                    <div style="font-size:12px; color:var(--text-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🎤 ${song.artist || '-'}</div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    window.openSheet('📋 ประวัติการเพิ่มเพลงทั้งหมด', container);
};
