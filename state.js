// state.js
// จัดการ State หลักของแอปพลิเคชัน เพื่อลดการใช้ window.* (Global Variables)

export const AppState = {
    songsMap: new Map(), // ใช้ Map เพื่อ O(1) Lookup
    songsArray: [],
    currentSongId: null,
    currentLyricsArray: [],
    currentLyricIndex: -1,
    currentCoverIndex: -1,
    currentFilter: 'All',
    ytPlayer: null,
    syncInterval: null,
    isAdmin: false,
    isLoggedIn: false,
    isShuffleEnabled: false,

    // โหลดการตั้งค่าเริ่มต้นจาก localStorage
    loadSettings() {
        this.isShuffleEnabled = localStorage.getItem('ws_shuffle') === '1';
    },

    // อัปเดตรายชื่อเพลงทั้งหมด (สร้าง Map อัตโนมัติ)
    setSongs(songsList) {
        this.songsArray = songsList;
        this.songsMap.clear();
        songsList.forEach(song => this.songsMap.set(song.id, song));
    },

    // ดึงข้อมูลเพลงจาก ID (O(1) Performance)
    getSong(id) {
        return this.songsMap.get(id);
    },

    // รีเซ็ตสถานะเมื่อเปลี่ยนเพลงหรือหยุดเล่น
    resetPlayerState() {
        this.currentSongId = null;
        this.currentCoverIndex = -1;
        this.currentLyricsArray = [];
        this.currentLyricIndex = -1;
    }
};

// โหลดการตั้งค่าเมื่อเริ่มต้น
AppState.loadSettings();
