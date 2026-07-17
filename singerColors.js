// singerColors.js
// ระบบจัดการสีชื่อนักร้องที่แสดงในเนื้อเพลง 
// รีแฟคเตอร์โดยลดการใช้ innerHTML และปรับโครงสร้างให้ทำงานร่วมกับ ES Modules และ AppState

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { AppState } from './state.js';
import { renderLyricsToContainer } from './lyrics.js';

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

export async function openSingerColorManager(db) {
    if (window.colorManagerWin) {
        window.colorManagerWin.focus();
        return;
    }

    const allSingers = new Set();
    
    if (window.SINGER_COLORS) {
        Object.keys(window.SINGER_COLORS).forEach(s => allSingers.add(s));
    }
    // ดึงชื่อนักร้องจาก AppState 
    if (AppState.songsArray) {
        AppState.songsArray.forEach(song => {
            if (song.artist) song.artist.split(',').forEach(s => allSingers.add(s.trim()));
        });
    }

    // สร้างเนื้อหาข้างในด้วย DOM API (ลดการใช้ HTML String และ Inline Style)
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'color-manager-wrapper'; 
    
    // 1. ส่วนเพิ่มสีใหม่ (ส่วนนี้ไม่มีข้อมูล user จึงใช้ innerHTML ได้)
    const addSection = document.createElement('div');
    addSection.className = 'color-add-section';
    addSection.innerHTML = `
        <div style="font-size: 0.85em; margin-bottom: 10px; color: #ccc;">➕ เพิ่มนักร้องใหม่ / หาไม่เจอพิมพ์เองเลย:</div>
        <div style="display:flex; gap:10px;">
            <input type="text" id="newSingerName" placeholder="พิมพ์ชื่อศิลปิน..." style="flex:1; padding:10px 12px; border-radius:8px; border:none; outline:none; background: rgba(255,255,255,0.1); color: #fff; font-family: inherit;">
            <input type="color" id="newSingerColor" value="#0a84ff" style="cursor:pointer; background:none; border:none; height:36px; width:36px; padding:0; border-radius:6px;">
            <button id="btnAddManualSinger" style="background:#0a84ff; color:white; border:none; padding:0 18px; border-radius:8px; cursor:pointer; font-weight:bold;">เพิ่ม</button>
        </div>
    `;
    contentWrapper.appendChild(addSection);
    
    // 2. ส่วนรายการสี (ส่วนนี้เสี่ยง XSS ต้องใช้ DOM Methods)
    const listContainer = document.createElement('div');
    listContainer.id = 'singerListContainer';
    listContainer.className = 'color-list-container';
    
    const fragment = document.createDocumentFragment();

    Array.from(allSingers).sort().forEach(singer => {
        if(!singer || singer === 'ดนตรี') return;
        const currentColor = window.SINGER_COLORS[singer] || '#ffffff';
        
        const row = document.createElement('div');
        row.className = 'color-item-row';
        
        const nameSpan = document.createElement('span');
        nameSpan.id = `preview_${singer}`;
        nameSpan.className = 'color-preview-name';
        nameSpan.style.color = currentColor;
        nameSpan.textContent = singer; // ป้องกัน XSS จากชื่อนักร้อง

        const controlsDiv = document.createElement('div');
        controlsDiv.style.cssText = 'display:flex; align-items:center; gap: 10px;';
        
        const hexSpan = document.createElement('span');
        hexSpan.id = `hex_${singer}`;
        hexSpan.className = 'color-hex-code';
        hexSpan.textContent = currentColor;
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'color-input';
        colorInput.dataset.name = singer; // เก็บชื่อไว้ใน Data Attribute ปลอดภัย
        colorInput.value = currentColor;
        
        controlsDiv.append(hexSpan, colorInput);
        row.append(nameSpan, controlsDiv);
        fragment.appendChild(row);
    });

    listContainer.appendChild(fragment);
    contentWrapper.appendChild(listContainer);

    // ฟังก์ชันย่อยสำหรับเซฟลง Firebase
    const saveColorToDatabase = async (newColorsDict) => {
        try {
            const colorDocRef = doc(db, 'settings', 'singerColors');
            await setDoc(colorDocRef, newColorsDict, { merge: true }); 
            window.SINGER_COLORS = newColorsDict;
            
            // อัปเดตเนื้อเพลงที่แสดงอยู่ทันที
            if (AppState.currentSongId) {
                renderLyricsToContainer();
            }
        } catch (error) {
            console.error(error);
            alert('❌ เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
        }
    };

    // 🪟 สร้างหน้าต่างด้วย WinBox 
    window.colorManagerWin = new WinBox("🎨 ตั้งค่าสีนักร้อง", {
        mount: contentWrapper,
        width: "400px",
        height: "70%",
        x: "center",
        y: "center",
        top: 70,
        class: ["wb-dark"], 
        onclose: function(force) {
            if (!force) {
                this.addClass('closing'); 
                setTimeout(() => this.close(true), 300); 
                return true; 
            }
            window.colorManagerWin = null;
        }
    });

    // 👁️ ผูกระบบ Live Preview และ 💾 Auto-Save 
    contentWrapper.querySelectorAll('.color-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const singerName = e.target.getAttribute('data-name');
            const newColor = e.target.value;
            // ใช้ querySelector ค้นหาจาก ID ให้รอบคอบโดยการอ้างอิงผ่าน Attributes (ป้องกัน ID ที่มีช่องว่าง)
            const previewEl = contentWrapper.querySelector(`[id="preview_${singerName}"]`);
            const hexEl = contentWrapper.querySelector(`[id="hex_${singerName}"]`);
            if (previewEl) previewEl.style.color = newColor;
            if (hexEl) hexEl.textContent = newColor;
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
    const btnAddManual = contentWrapper.querySelector('#btnAddManualSinger');
    if (btnAddManual) {
        btnAddManual.addEventListener('click', async () => {
            const name = contentWrapper.querySelector('#newSingerName').value.trim();
            const color = contentWrapper.querySelector('#newSingerColor').value;
            if (!name) return alert('กรุณาพิมพ์ชื่อนักร้องก่อนครับ 😅');
            
            const newColors = { ...window.SINGER_COLORS };
            newColors[name] = color; 
            
            await saveColorToDatabase(newColors);
            
            // ปิดหน้าต่างแล้วเปิดใหม่เพื่อรีเฟรชรายชื่อ
            window.colorManagerWin.close(true); 
            setTimeout(() => openSingerColorManager(db), 50); 
        });
    }
}