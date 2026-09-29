// ==========================================
// sync-hotkeys.js - ปุ่มลัดคีย์บอร์ดสำหรับแอดมินจัดทำซิงค์เนื้อเพลง
// ทำงานเฉพาะตอนเปิดแผง "⏱ จัดการซิงค์" และเป็นแอดมินเท่านั้น เพื่อไม่ไปกวนการเล่นเพลงปกติ
//
//   Space / → / ↓   = จับจังหวะ (ถัดไป + บันทึกเวลา)
//   Backspace / ← / ↑ = ย้อน (ลบเวลาท่อนก่อนหน้า)
//   Esc             = ปิดแผงซิงค์
// ==========================================

// ห้ามทำงานทับตอนผู้ใช้กำลังพิมพ์ในช่องข้อความ/ช่องตัวเลขของแผงซิงค์
const isTypingTarget = (el) => {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

const canHandle = () => {
    if (!window.isAdmin || !window.currentSongId) return false;

    const panel = document.getElementById('syncPanel');
    if (!panel || panel.style.display === 'none') return false;

    // หน้าต่าง calibrate หูฟังมีตัวดัก Space ของตัวเองอยู่แล้ว ต้องไม่ให้ชนกัน
    if (document.getElementById('calibBtn')) return false;

    // ถ้ามี modal (เพิ่มเพลง / จัดการสี / แจ้งเตือน) เปิดอยู่ ให้ปุ่มลัดทำงานตามปกติของเบราว์เซอร์
    if (document.querySelector('.modal-sheet.active')) return false;

    return true;
};

// YouTube iframe ดูด focus ไปเองตอนคลิก ทำให้ keydown ไม่ถึงตัว document
// ระหว่างซิงค์จึงดึง focus กลับมาที่หน้าเว็บทุกครั้งที่คลิกบริเวณวิดีโอ
const releaseIframeFocus = () => {
    const active = document.activeElement;
    if (active && active.tagName === 'IFRAME') active.blur();
};

document.addEventListener('mousedown', () => {
    if (!canHandle()) return;
    setTimeout(releaseIframeFocus, 0);
}, true);

document.addEventListener('focusin', () => {
    if (!canHandle()) return;
    setTimeout(releaseIframeFocus, 0);
}, true);

document.addEventListener('keydown', (e) => {
    if (!canHandle()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;

    // ทุกการกดปุ่มลัดจะเขียน Firestore 1 ครั้ง (ดู nextLyric) จึงห้ามทำซ้ำเมื่อกดค้าง
    if (e.repeat) return;

    // ปุ่มในแผงซิงค์ถ้ายังโฟกัสอยู่จะถูก Space กดซ้ำเองตอนกดคีย์บอร์ด
    // ดึง focus กลับมาที่ document เพื่อกันไม่ให้ทำงานสองรอบ
    if (e.code === 'Space' && document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }

    // โหมดจับเวลาทีละคำ (word refine) — ดักก่อนปุ่มอื่นทั้งหมด
    if (window.karaokeRefine && window.karaokeRefine.isActive()) {
        if (e.code === 'KeyW') { e.preventDefault(); window.karaokeRefine.stop(); return; }
        if (e.code === 'Space' || e.code === 'ArrowRight') {
            e.preventDefault(); window.karaokeRefine.tapCurrentTime(); return;
        }
        if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
            e.preventDefault(); window.karaokeRefine.move(e.code === 'ArrowDown' ? 1 : -1); return;
        }
        if (e.code === 'Escape') { e.preventDefault(); window.karaokeRefine.stop(); return; }
    }

    // เข้าโหมดจับเวลาทีละคำ
    if (e.code === 'KeyW') {
        e.preventDefault();
        window.karaokeRefine.start();
        return;
    }

    switch (e.code) {
        case 'Space':
        case 'ArrowRight':
        case 'ArrowDown':
            e.preventDefault();
            window.nextLyric();
            break;

        case 'Backspace':
        case 'ArrowLeft':
        case 'ArrowUp':
            e.preventDefault();
            window.prevLyric();
            break;

        case 'Escape':
            e.preventDefault();
            if (window.wm) window.wm.toggleSyncPanel();
            break;
    }
});
