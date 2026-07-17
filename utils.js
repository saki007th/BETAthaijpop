// utils.js
// รวมฟังก์ชันช่วยเหลือทั่วไป (Helper Functions) เพื่อให้โมดูลอื่นเรียกใช้งาน

// ดึง YouTube Video ID จาก URL
export function extractYouTubeID(url) {
    if (!url) return null;
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
}

// แยกรายชื่อนักร้องจาก String (เช่น "A, B [C]" -> ["A", "B", "C"])
export function getSingersList(artistStr) {
    if (!artistStr) return [];
    let parts = [];
    if (artistStr.includes('[')) {
        const matches = artistStr.match(/\[(.*?)\]/g);
        if (matches) parts = matches.map(m => m.replace(/[\[\]]/g, ''));
        else parts = [artistStr];
    } else { 
        parts = artistStr.split(/[,/&]+/); 
    }
    return parts.map(p => p.trim()).filter(p => p);
}

// แปลงเวลา Timestamp เป็นข้อความที่อ่านง่าย (เช่น "วันนี้", "เมื่อวาน", "3 วันที่แล้ว")
export function getRelativeDayLabel(timestamp) {
    if (!timestamp) return "ไม่ทราบวันที่";
    
    const songDate = new Date(timestamp);
    const today = new Date();
    
    // เทียบแค่วันที่ ไม่คิดชั่วโมง
    const songZero = new Date(songDate.getFullYear(), songDate.getMonth(), songDate.getDate());
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const diffTime = todayZero - songZero;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "🔥 เพิ่มวันนี้ (Today)";
    if (diffDays === 1) return "⏳ เพิ่มเมื่อวาน (Yesterday)";
    if (diffDays <= 7) return `📅 ย้อนหลัง ${diffDays} วันที่แล้ว`;
    
    return songDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

// ดึงข้อมูล Timestamps ที่กำลังใช้งาน (เช็คว่ากำลังเล่น Original หรือ Cover)
export function getActiveTimestamps(song, currentCoverIndex) {
    if (!song) return [];
    if (currentCoverIndex >= 0 && song.covers && song.covers[currentCoverIndex]) {
        const coverTs = song.covers[currentCoverIndex].timestamps;
        if (coverTs && coverTs.some(t => t != null)) return coverTs; 
    }
    return song.timestamps || []; 
}

// ดึงข้อมูลรายชื่อนักร้องรายท่อนที่กำลังใช้งาน
export function getActiveSingers(song, currentCoverIndex) {
    if (!song) return [];
    if (currentCoverIndex >= 0 && song.covers && song.covers[currentCoverIndex]) {
        const coverSg = song.covers[currentCoverIndex].singers;
        if (coverSg && coverSg.some(s => s !== "")) return coverSg;
    }
    return song.singers || [];
}
