// ==========================================
// stats.js - สถิติการฟังเพลง (บันทึกไปยัง firestore userData / localStorage)
// ==========================================
import { db, doc, setDoc, getDoc, updateDoc, increment } from './config.js';

const STATS_KEY = 'ujm_stats_cache';
const RECENT_LIMIT = 8;
const FLUSH_INTERVAL = 30000;   // เก็บลงคลังทุก 30 วิ (กันเขียน Firestore ถี่เกินไป)
const MAX_TICK_GAP = 10;        // ข้ามช่วงหน้าจอซ่อน/บัฟเฟอร์ยาวๆ

function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function defaultStats() {
    return {
        totalSeconds: 0,
        totalPlays: 0,
        todaySeconds: 0,
        todayCount: 0,
        lastDate: todayStr(),
        songs: {},              // { [songId]: { plays, seconds } }
        recent: []              // [{ songId, ts, sec }]
    };
}

window.stats = defaultStats();
_stampDefaults(window.stats);

// เริ่ม session (สถานะการนับเวลาของเพลงที่กำลังเล่น)
let _sessionSongId = null;
let _sessionActive = false;
let _sessionSeconds = 0;        // วินาทีที่ฟังจริงของเพลงปัจจุบัน (สำหรับ recent)
let _lastTickAt = 0;
let _lastFlushAt = 0;
let _loaded = false;

function getUid() { return (window.currentUser && window.currentUser.uid) ? window.currentUser.uid : null; }
function statsDocRef() {
    const uid = getUid();
    if (!uid) return null;
    return doc(db, 'userData', uid);
}

// เติม field ที่ขาดให้ครบ (รองรับข้อมูลเก่า)
function _stampDefaults(s) {
    if (!s) return s;
    if (typeof s.totalSeconds !== 'number') s.totalSeconds = 0;
    if (typeof s.totalPlays !== 'number') s.totalPlays = 0;
    if (typeof s.todaySeconds !== 'number') s.todaySeconds = 0;
    if (typeof s.todayCount !== 'number') s.todayCount = 0;
    if (!s.lastDate) s.lastDate = todayStr();
    if (!s.songs) s.songs = {};
    if (!Array.isArray(s.recent)) s.recent = [];
    if (s.recent.length > RECENT_LIMIT) s.recent.length = RECENT_LIMIT;
    return s;
}

// รวมข้อมูลจาก 2 แหล่งแบบไม่ให้ตัวเลขหาย (เอาค่าน้อยสุด/มากสุดตามชนิด)
function mergeStats(a, b) {
    const out = _stampDefaults({ ...a, songs: {}, recent: [] });
    out.totalSeconds = Math.max(a.totalSeconds || 0, b.totalSeconds || 0);
    out.totalPlays = Math.max(a.totalPlays || 0, b.totalPlays || 0);
    out.todaySeconds = Math.max(a.todaySeconds || 0, b.todaySeconds || 0);
    out.todayCount = Math.max(a.todayCount || 0, b.todayCount || 0);
    out.lastDate = a.lastDate || todayStr();

    const keys = new Set([...Object.keys(a.songs || {}), ...Object.keys(b.songs || {})]);
    keys.forEach(k => {
        const sa = (a.songs || {})[k] || { plays: 0, seconds: 0 };
        const sb = (b.songs || {})[k] || { plays: 0, seconds: 0 };
        out.songs[k] = {
            plays: Math.max(sa.plays || 0, sb.plays || 0),
            seconds: Math.max(sa.seconds || 0, sb.seconds || 0)
        };
    });

    const recentAll = [...(a.recent || []), ...(b.recent || [])].sort((x, y) => (y.ts || 0) - (x.ts || 0));
    const seen = new Set();
    out.recent = [];
    recentAll.forEach(r => {
        const key = r.songId + '|' + r.ts;
        if (!seen.has(key)) { seen.add(key); out.recent.push(r); }
    });
    out.recent = out.recent.slice(0, RECENT_LIMIT);
    return out;
}

// โหลดจาก localStorage เร็วๆ (ใช้ตอนยังไม่ทันโหลดจาก Firestore)
function loadSync() {
    try {
        const local = JSON.parse(localStorage.getItem(STATS_KEY));
        window.stats = _stampDefaults(local || defaultStats());
    } catch (e) {
        window.stats = defaultStats();
    }
    rolloverDaily();
}

// โหลดสถิติจาก Firestore (ถ้าล็อกอิน) + localStorage เป็นฐานสำรอง
window.loadStats = async function() {
    loadSync();
    _loaded = true;

    const ref = statsDocRef();
    if (ref) {
        try {
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const remote = snap.data().stats || null;
                if (remote) {
                    window.stats = mergeStats(window.stats, remote);
                    persistStats(true);
                }
            }
        } catch (e) {
            console.error('Error loading stats:', e);
        }
    }
    rolloverDaily();
    if (window.renderHomeStats) window.renderHomeStats();
};

// รีเซ็ตตัวเลข "วันนี้" ถ้าเปลี่ยนวันใหม่
function rolloverDaily() {
    const today = todayStr();
    if (window.stats.lastDate !== today) {
        window.stats.lastDate = today;
        window.stats.todaySeconds = 0;
        window.stats.todayCount = 0;
    }
}

// ---------- เขียนลงคลัง (Firestore userData + localStorage) ----------
let _writeChain = Promise.resolve();
function persistStats(force) {
    if (!_loaded) return;
    const now = Date.now();
    if (!force && (now - _lastFlushAt) < FLUSH_INTERVAL) return;
    _lastFlushAt = now;

    try { localStorage.setItem(STATS_KEY, JSON.stringify(window.stats)); } catch (e) {}

    const ref = statsDocRef();
    if (!ref) return;
    const payload = JSON.parse(JSON.stringify(window.stats));
    _writeChain = _writeChain
        .then(() => setDoc(ref, { stats: payload }, { merge: true }))
        .catch(e => console.error('Error saving stats:', e));
}

window.flushStats = function() { persistStats(true); };
window.forceFlushStats = window.flushStats;

// ---------- 🎯 ตัวนับยอดวิวสาธารณะ (เขียนลง songs/{songId}) ----------
// ต้องมีคนล็อกอินเท่านั้น (rules บังคับ) — ใช้ increment() ฝั่ง server กันอ่าน-เขียน clash
function bumpSongCounter(songId, patch) {
    if (!songId || !window.isLoggedIn) return;
    const data = {};
    if (patch.plays) data.plays = increment(patch.plays);
    if (patch.seconds && patch.seconds >= 1) data.seconds = increment(patch.seconds);
    if (Object.keys(data).length === 0) return;
    updateDoc(doc(db, 'songs', songId), data).catch(e => console.error('Error updating song counter:', e));
}

// ---------- เริ่ม/หยุด session ติดตามการฟัง ----------
window.startListeningStats = function(songId) {
    if (!_loaded) loadSync();
    if (!songId) return;

    // ถ้าเปลี่ยนเพลง ให้ปิด session เก่าก่อน
    if (_sessionActive && _sessionSongId && _sessionSongId !== songId) {
        endListeningStats();
    }
    // เล่นเพลงเดิมซ้ำในขณะที่ยังนับอยู่ ให้นับต่อเนื่อง (ไม่นับ play ซ้ำ)
    if (_sessionActive && _sessionSongId === songId) return;

    _sessionActive = true;
    _sessionSongId = songId;
    _sessionSeconds = 0;
    _lastTickAt = 0;

    rolloverDaily();
    window.stats.totalPlays += 1;
    window.stats.todayCount += 1;
    if (!window.stats.songs[songId]) window.stats.songs[songId] = { plays: 0, seconds: 0 };
    window.stats.songs[songId].plays += 1;

    // นับยอดวิวรวมทุกคน (songs/{songId}.plays) — ต้องล็อกอิน ถูก rules บังคับ
    bumpSongCounter(songId, { plays: 1 });

    persistStats(true);
    maybeRenderHome();
};

window.tickStats = function() {
    if (!_sessionActive) return;
    const yp = window.ytPlayer;
    if (!yp || typeof yp.getPlayerState !== 'function') return;
    // นับเฉพาะตอนกำลังเล่นจริง (1 = playing)
    if (yp.getPlayerState() !== 1) { _lastTickAt = 0; return; }

    const now = Date.now();
    if (_lastTickAt === 0) { _lastTickAt = now; return; }
    const delta = (now - _lastTickAt) / 1000;
    _lastTickAt = now;
    if (delta <= 0 || delta > MAX_TICK_GAP) return;

    rolloverDaily();
    window.stats.totalSeconds += delta;
    window.stats.todaySeconds += delta;
    _sessionSeconds += delta;

    if (!window.stats.songs[_sessionSongId]) window.stats.songs[_sessionSongId] = { plays: 0, seconds: 0 };
    window.stats.songs[_sessionSongId].seconds += delta;

    persistStats(false);
    maybeRenderHome();
};

// จบ session (เปลี่ยนเพลง / เพลงจบ) บันทึกเพลงที่เพิ่งฟังลง recent
function endListeningStats() {
    if (!_sessionActive) return;
    const sessionSec = Math.floor(_sessionSeconds);
    if (_sessionSongId && sessionSec >= 1) {
        window.stats.recent.unshift({ songId: _sessionSongId, ts: Date.now(), sec: sessionSec });
        if (window.stats.recent.length > RECENT_LIMIT) window.stats.recent.length = RECENT_LIMIT;
        // เวลาฟังรวมทุกคน (songs/{songId}.seconds)
        bumpSongCounter(_sessionSongId, { seconds: sessionSec });
    }
    _sessionActive = false;
    _sessionSongId = null;
    _sessionSeconds = 0;
    _lastTickAt = 0;
    persistStats(true);
    maybeRenderHome();
}
window.endListeningStats = endListeningStats;

// รีเฟรชหน้าแรกให้เห็นตัวเลขสด (จำกัดแค่เมื่อเปิดหน้าแรกอยู่)
let _lastHomeRender = 0;
function maybeRenderHome() {
    const now = Date.now();
    if (now - _lastHomeRender < 30000) return;
    const homeEl = document.getElementById('view-home');
    if (homeEl && homeEl.classList.contains('active') && window.renderHomeStats) {
        _lastHomeRender = now;
        window.renderHomeStats();
    }
}

// ---- รูปแบบเวลาแสดงผล ----
window.formatDuration = function(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h} ชม. ${m} นาที`;
    if (m > 0) return `${m} นาที ${s} วินาที`;
    return `${s} วินาที`;
};

window.formatShortDuration = function(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}ช ${m}ม`;
    if (m > 0) return `${m}น ${(sec % 60)}วิ`;
    return `${sec}วิ`;
};

window.timeAgo = function(ts) {
    const min = Math.floor((Date.now() - (ts || 0)) / 60000);
    if (min < 1) return 'เมื่อกี้';
    if (min < 60) return `${min} นาทีที่แล้ว`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} ชม.ที่แล้ว`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} วันที่แล้ว`;
    return new Date(ts).toLocaleDateString();
};

// เก็บข้อมูลครั้งสุดท้ายก่อนปิด/ซ่อนหน้า
window.addEventListener('beforeunload', () => persistStats(true));
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistStats(true);
});