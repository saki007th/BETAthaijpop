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

    // 1. ดึงเพลง "ทั้งหมด" ที่มีการบันทึกเวลาไว้ และ 🔴 เรียงจาก "ใหม่สุด -> เก่าสุด" (b - a)
    const allSortedSongs = window.songs
        .filter(s => s.createdAt)
        .sort((a, b) => b.createdAt - a.createdAt);

    // 2. จัดกลุ่มตาม "วันที่"
    const groups = {};
    allSortedSongs.forEach(song => {
        const dateObj = new Date(song.createdAt);
        const dateStr = dateObj.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(song);
    });

    // 3. วาด UI (หน้าต่างเนื้อหา)
    let html = '<div>';

    if (Object.keys(groups).length === 0) {
        html += '<div style="color:#aaa; text-align:center; margin-top:30px;">ไม่มีข้อมูลประวัติการเพิ่มเพลง</div>';
    } else {
        // วนลูปสร้างกลุ่มวันที่ (ระบบเรียงให้วันใหม่สุดอยู่บนสุดแล้ว)
        for (const [dateStr, songs] of Object.entries(groups)) {
            html += `
                <div style="color: #ffcc00; font-weight: bold; font-size: 0.95em; margin: 20px 0 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">
                    📅 เพิ่มเมื่อ ${dateStr}
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
            `;

            // วาดรายการเพลงในกลุ่มนั้นๆ
            songs.forEach(song => {
                const videoId = window.extractYouTubeID(song.audioPath);
                const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';

                // 🟢 แก้ไขให้ใช้ song.id ในการกดเล่นเพลง เพื่อความแม่นยำ
                html += `
                    <div style="display: flex; align-items: center; background: rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 12px; cursor: pointer; transition: background 0.2s;" 
                         onclick="window.playSong('${song.id}'); window.closeSheet();"
                         onmouseover="this.style.background='rgba(255, 255, 255, 0.15)'"
                         onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
                        
                        <img src="${thumbUrl}" style="width: 45px; height: 45px; border-radius: 8px; object-fit: cover; margin-right: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);" onerror="this.style.display='none'">
                        
                        <div style="flex: 1; overflow: hidden;">
                            <div style="font-weight: bold; font-size: 0.9em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div>
                            <div style="font-size: 0.75em; color: #aaa; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🎤 ${song.artist || '-'}</div>
                        </div>
                        
                        <button style="background: #0a84ff; border: none; width: 32px; height: 32px; border-radius: 50%; color: #fff; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 2px 8px rgba(10, 132, 255, 0.4); margin-left: 10px;">
                            ▶
                        </button>
                    </div>
                `;
            });

            html += `</div>`;
        }
    }
    html += '</div>';

    // 4. แสดงเป็นชีทกลางจอ (แทนหน้าต่าง WinBox เดิม)
    const container = document.createElement('div');
    container.innerHTML = html;

    window.openSheet('📋 ประวัติการเพิ่มเพลงทั้งหมด', container, () => { window.wm.notifyWin = null; });
    window.wm.notifyWin = { close: () => window.closeSheet() };
};
