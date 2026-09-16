import { doc, getDoc, setDoc } from './config.js';

// ==========================================
// 1. ฟังก์ชันโหลดสีตอนเปิดเว็บ
// ==========================================
export async function initializeSingerColors(db) {
    window.SINGER_COLORS = {};
    const colorDocRef = doc(db, 'settings', 'singerColors');

    try {
        const docSnap = await getDoc(colorDocRef);
        if (docSnap.exists()) {
            window.SINGER_COLORS = docSnap.data();
            console.log("🎨 โหลดสีนักร้องสำเร็จ!");
        } else {
            console.log("🛠️ ไม่พบฐานข้อมูลสี... กำลังสร้างแฟ้มใหม่อัตโนมัติ");
            const defaultColors = {
                "Tokoyami Towa": "#FF69B4",
                "Yozora Mel": "#FFD700",
                "Hoshimachi Suisei": "#87CEEB",
                "Minato Aqua": "#FFB6C1",
                "Nekomata Okayu": "#9370DB"
            };
            await setDoc(colorDocRef, defaultColors);
            window.SINGER_COLORS = defaultColors;
        }
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการโหลดสี:", error);
    }
}

// ==========================================
// 2. ฟังก์ชันเปิดหน้าต่างแอดมิน (แสดงเป็นชีทกลางจอ แทนหน้าต่างลอย)
// ==========================================
export async function openSingerColorManager(db) {
    // 🔴 ป้องกันหน้าต่างเปิดซ้อนกัน (เนื้อหาเดิมเปิดอยู่แล้ว)
    if (window.colorManagerWin) {
        return;
    }

    const allSingers = new Set();

    if (window.SINGER_COLORS) {
        Object.keys(window.SINGER_COLORS).forEach(s => allSingers.add(s));
    }
    if (window.songs) {
        window.songs.forEach(song => {
            if (song.artist) song.artist.split(',').forEach(s => allSingers.add(s.trim()));
        });
    }

    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = `
        display: flex; 
        flex-direction: column; 
        height: 100%; 
        box-sizing: border-box; 
        color: #fff;
    `;

    let html = `
        <div style="margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size: 0.85em; margin-bottom: 10px; color: #ccc;">➕ เพิ่มนักร้องใหม่ / หาไม่เจอพิมพ์เองเลย:</div>
            <div style="display:flex; gap:10px;">
                <input type="text" id="newSingerName" placeholder="พิมพ์ชื่อศิลปิน..." style="flex:1; padding:10px 12px; border-radius:8px; border:none; outline:none; background: rgba(255,255,255,0.1); color: #fff; font-family: inherit; margin-bottom:0;">
                <input type="color" id="newSingerColor" value="#0a84ff" style="cursor:pointer; background:none; border:none; height:36px; width:36px; padding:0; border-radius:6px;">
                <button id="btnAddManualSinger" style="background:#0a84ff; color:white; border:none; padding:0 18px; border-radius:8px; cursor:pointer; font-weight:bold;">เพิ่ม</button>
            </div>
        </div>
        <div id="singerListContainer" style="flex:1; overflow-y:auto; padding-right:8px; max-height:50vh;">
    `;

    Array.from(allSingers).sort().forEach(singer => {
        if (!singer || singer === 'ดนตรี') return;
        const currentColor = window.SINGER_COLORS[singer] || '#ffffff';
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; background:rgba(0,0,0,0.2); padding:10px 15px; border-radius:10px;">
                <span id="preview_${singer}" style="font-size:1em; font-weight:bold; color:${currentColor}; text-shadow: 1px 1px 3px rgba(0,0,0,0.8);">${singer}</span>
                <div style="display:flex; align-items:center; gap: 10px;">
                    <span id="hex_${singer}" style="font-size:0.75em; color:#aaa; font-family:monospace;">${currentColor}</span>
                    <input type="color" class="color-input" data-name="${singer}" value="${currentColor}" style="cursor:pointer; background:none; border:none; height:30px; width:34px; padding:0;">
                </div>
            </div>
        `;
    });

    html += `</div>`;
    contentWrapper.innerHTML = html;

    // ฟังก์ชันย่อยสำหรับเซฟลง Firebase
    const saveColorToDatabase = async (newColorsDict) => {
        try {
            const colorDocRef = doc(db, 'settings', 'singerColors');
            await setDoc(colorDocRef, newColorsDict, { merge: true });
            window.SINGER_COLORS = newColorsDict;
            if (window.renderLyricsToContainer) window.renderLyricsToContainer();
        } catch (error) {
            console.error(error);
            alert('❌ เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
        }
    };

    // ==========================================
    // 🪟 แสดงเป็นชีทกลางจอ (แทนหน้าต่าง WinBox เดิม)
    // ==========================================
    window.openSheet('🎨 ตั้งค่าสีนักร้อง', contentWrapper, () => { window.colorManagerWin = null; });
    window.colorManagerWin = { close: () => window.closeSheet() };

    // ==========================================
    // 👁️ ผูกระบบ Live Preview และ 💾 Auto-Save
    // ==========================================
    contentWrapper.querySelectorAll('.color-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const singerName = e.target.getAttribute('data-name');
            const newColor = e.target.value;
            const previewEl = contentWrapper.querySelector(`#preview_${singerName}`);
            const hexEl = contentWrapper.querySelector(`#hex_${singerName}`);
            if (previewEl) previewEl.style.color = newColor;
            if (hexEl) hexEl.innerText = newColor;
        });

        input.addEventListener('change', async (e) => {
            const singerName = e.target.getAttribute('data-name');
            const newColor = e.target.value;
            const newColors = { ...window.SINGER_COLORS };
            newColors[singerName] = newColor;
            await saveColorToDatabase(newColors);
        });
    });

    // ปุ่มเพิ่มนักร้องเอง
    contentWrapper.querySelector('#btnAddManualSinger').onclick = async () => {
        const name = contentWrapper.querySelector('#newSingerName').value.trim();
        const color = contentWrapper.querySelector('#newSingerColor').value;
        if (!name) return alert('กรุณาพิมพ์ชื่อนักร้องก่อนครับ 😅');

        const newColors = { ...window.SINGER_COLORS };
        newColors[name] = color;

        await saveColorToDatabase(newColors);

        // ปิดชีทแล้วเปิดใหม่เพื่อรีเฟรชรายชื่อ
        window.colorManagerWin.close();
        setTimeout(() => openSingerColorManager(db), 50);
    };
}

window.openSingerColorManager = openSingerColorManager;
