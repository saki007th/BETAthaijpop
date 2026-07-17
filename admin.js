// admin.js
// จัดการส่วนเครื่องมือของผู้ดูแลระบบ (Admin) เช่น การซิงค์เวลา, การเพิ่ม/แก้ไขเพลง
// รีแฟคเตอร์ใช้ createElement และลดการพึ่งพา window (Global)

import { AppState } from './state.js';
import { getActiveTimestamps, getActiveSingers, getSingersList } from './utils.js';
// หมายเหตุ: ฟังก์ชันติดต่อ Firebase (เช่น updateDoc, addDoc) จะถูกส่งมาจาก firebase.js หรือ app.js
import { saveSongToDB, updateTimestampsInDB } from './firebase.js'; 

export function renderTimestampEditor() {
    const container = document.getElementById('timestampList'); 
    if(!container) return;
    
    container.textContent = ''; // ล้างข้อมูลเดิมอย่างปลอดภัย
    const song = AppState.getSong(AppState.currentSongId); 
    if (!song) return;

    const fragment = document.createDocumentFragment();

    // 🟢 แถบ Calibrate หูฟังบลูทูธ
    if (AppState.isAdmin) {
        const savedOffset = localStorage.getItem('admin_audio_offset') || '0';
        const offsetDiv = document.createElement('div');
        offsetDiv.style.cssText = 'background: rgba(255, 159, 10, 0.15); border: 1px solid rgba(255, 159, 10, 0.3); padding: 12px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;';
        
        offsetDiv.innerHTML = `
            <div>
                <div style="color: #ff9f0a; font-weight: bold; font-size: 0.9em;">🎧 Calibrate หูฟังไร้สาย</div>
                <div style="color: #aaa; font-size: 0.8em; margin-top: 2px;">หักลบความหน่วง (Latency) ออกจากเวลาจริง</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button id="btnStartCalib" style="background: rgba(10, 132, 255, 0.2); color: #0a84ff; border: 1px solid rgba(10, 132, 255, 0.5); border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 0.85em; font-weight: bold;">🎯 จับจังหวะอัตโนมัติ</button>
                <div style="display:flex; align-items:center; gap:3px;">
                    <input type="number" id="adminAudioOffset" value="${savedOffset}" step="10" min="0" style="width: 65px; padding: 4px; text-align: center; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.5); color: #fff; margin: 0;">
                    <span style="color: #ff9f0a; font-size: 0.85em;">ms</span>
                </div>
            </div>
        `;
        
        // ผูก Event Listener
        const btnStartCalib = offsetDiv.querySelector('#btnStartCalib');
        if (btnStartCalib) btnStartCalib.addEventListener('click', startCalibration);

        const inputOffset = offsetDiv.querySelector('#adminAudioOffset');
        if (inputOffset) {
            inputOffset.addEventListener('change', (e) => {
                localStorage.setItem('admin_audio_offset', Math.max(0, parseInt(e.target.value) || 0));
            });
        }
        fragment.appendChild(offsetDiv);
    }

    let isCover = (AppState.currentCoverIndex >= 0 && song.covers && song.covers[AppState.currentCoverIndex]);
    let activeTimestamps = getActiveTimestamps(song, AppState.currentCoverIndex);
    let activeSingers = getActiveSingers(song, AppState.currentCoverIndex);

    AppState.currentLyricsArray.forEach((lyric, index) => {
        const row = document.createElement('div'); 
        row.className = 'ts-row'; 
        row.id = `ts-row-${index}`;
        row.style.cssText = 'background: rgba(255, 255, 255, 0.05); padding: 12px 10px; border-radius: 8px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.1);';

        const lyricEditor = document.createElement('textarea');
        lyricEditor.value = lyric; 
        lyricEditor.style.cssText = 'width: 100%; min-height: 55px; margin-bottom: 10px;';
        
        if (!AppState.isAdmin) { 
            lyricEditor.readOnly = true; 
            lyricEditor.style.border = 'none'; 
            lyricEditor.style.background = 'transparent'; 
        } else { 
            lyricEditor.addEventListener('change', (e) => { 
                AppState.currentLyricsArray[index] = e.target.value.trim(); 
                saveTimestampsToFirebase(true); 
            }); 
        }
        row.appendChild(lyricEditor);

        const controlsDiv = document.createElement('div'); 
        controlsDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;';
        
        const leftControls = document.createElement('div'); 
        leftControls.style.cssText = 'display: flex; gap: 8px; align-items: center;';
        
        const badge = document.createElement('span'); 
        badge.textContent = `#${index + 1}`; 
        badge.style.cssText = 'color: #0a84ff; font-weight: bold;'; 
        leftControls.appendChild(badge);

        if (AppState.isAdmin) {
            // ระบบ Dropdown เลือกนักร้อง
            const allSingers = getSingersList(song.artist);
            const dropdown = document.createElement('div'); 
            dropdown.className = 'ts-singer-dropdown'; 
            dropdown.style.position = 'relative';
            
            const toggleBtn = document.createElement('button'); 
            toggleBtn.className = 'ts-dropdown-toggle';
            const currentSingers = activeSingers[index] ? activeSingers[index].split(',').map(s=>s.trim()).filter(s=>s) : [];
            toggleBtn.textContent = currentSingers.length > 0 ? currentSingers.join(', ') : '👤 เลือกร้อง';
            
            const menu = document.createElement('div'); 
            menu.className = 'ts-dropdown-menu';
            
            allSingers.forEach(singer => {
                const itemLabel = document.createElement('label'); 
                itemLabel.className = 'ts-dropdown-item';
                
                const checkbox = document.createElement('input'); 
                checkbox.type = 'checkbox'; 
                checkbox.value = singer; 
                checkbox.checked = currentSingers.includes(singer);
                
                checkbox.addEventListener('change', () => {
                    const selected = Array.from(menu.querySelectorAll('input:checked')).map(cb => cb.value);
                    toggleBtn.textContent = selected.length > 0 ? selected.join(', ') : '👤 เลือกร้อง';
                    
                    if (isCover) {
                        if (!song.covers[AppState.currentCoverIndex].singers) {
                            song.covers[AppState.currentCoverIndex].singers = [...(song.singers || [])];
                        }
                        song.covers[AppState.currentCoverIndex].singers[index] = selected.length > 0 ? selected.join(', ') : "";
                    } else {
                        if (!song.singers) song.singers = []; 
                        song.singers[index] = selected.length > 0 ? selected.join(', ') : "";
                    }
                    saveTimestampsToFirebase(true); 
                });
                
                itemLabel.appendChild(checkbox); 
                itemLabel.appendChild(document.createTextNode(' ' + singer)); 
                menu.appendChild(itemLabel);
            });
            
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const isShowing = menu.classList.contains('show'); 
                document.querySelectorAll('.ts-dropdown-menu.show').forEach(m => m.classList.remove('show'));
                if (!isShowing) { 
                    menu.classList.add('show'); 
                    const rect = toggleBtn.getBoundingClientRect(); 
                    menu.style.position = 'absolute'; 
                    menu.style.left = '0'; 
                    if (window.innerHeight - rect.bottom < 200) { 
                        menu.style.top = 'auto'; 
                        menu.style.bottom = 'calc(100% + 5px)'; 
                    } else { 
                        menu.style.top = 'calc(100% + 5px)'; 
                        menu.style.bottom = 'auto'; 
                    }
                }
            });
            dropdown.append(toggleBtn, menu); 
            leftControls.appendChild(dropdown);

            const timeInput = document.createElement('input'); 
            timeInput.type = 'number'; 
            timeInput.step = '0.1'; 
            timeInput.min = '0';
            timeInput.style.cssText = 'width: 70px; margin: 0; padding: 4px 6px; text-align: center;';
            timeInput.value = (activeTimestamps[index] != null) ? activeTimestamps[index].toFixed(1) : '';
            
            timeInput.addEventListener('change', (e) => { 
                const val = parseFloat(e.target.value); 
                const finalVal = isNaN(val) ? null : val;
                if (isCover) {
                    if (!song.covers[AppState.currentCoverIndex].timestamps) {
                        song.covers[AppState.currentCoverIndex].timestamps = [...(song.timestamps || [])];
                    }
                    song.covers[AppState.currentCoverIndex].timestamps[index] = finalVal;
                } else {
                    if (!song.timestamps) song.timestamps = []; 
                    song.timestamps[index] = finalVal;
                }
                saveTimestampsToFirebase(false); 
            });
            leftControls.appendChild(timeInput);
        }

        const rightControls = document.createElement('div'); 
        rightControls.style.cssText = 'display: flex; gap: 8px;';
        
        if (AppState.isAdmin) {
            const btnMusic = document.createElement('button'); 
            btnMusic.textContent = '🎵 ดนตรี'; 
            btnMusic.style.cssText = 'background: rgba(255, 159, 10, 0.2); color: #ff9f0a; border: 1px solid rgba(255, 159, 10, 0.4); padding: 4px 10px; border-radius: 6px; cursor: pointer;';
            btnMusic.addEventListener('click', () => { 
                lyricEditor.value = '[ดนตรี]'; 
                AppState.currentLyricsArray[index] = '[ดนตรี]'; 
                saveTimestampsToFirebase(true); 
            });

            const btnAdd = document.createElement('button'); 
            btnAdd.textContent = '➕'; 
            btnAdd.style.cssText = 'background: rgba(52, 199, 89, 0.2); color: #34c759; border: 1px solid rgba(52, 199, 89, 0.4); padding: 4px 10px; cursor: pointer;';
            btnAdd.addEventListener('click', () => addLyricLine(index));
            
            const btnDel = document.createElement('button'); 
            btnDel.textContent = '🗑️'; 
            btnDel.style.cssText = 'background: rgba(255, 59, 48, 0.2); color: #ff3b30; border: 1px solid rgba(255, 59, 48, 0.4); padding: 4px 10px; cursor: pointer;';
            btnDel.addEventListener('click', () => deleteLyricLine(index));
            
            rightControls.append(btnMusic, btnAdd, btnDel);
        }
        
        controlsDiv.append(leftControls, rightControls);
        row.appendChild(controlsDiv); 
        fragment.appendChild(row);
    });
    
    if (AppState.isAdmin) {
        const btnAddEnd = document.createElement('button'); 
        btnAddEnd.textContent = '➕ เพิ่มท่อนใหม่ต่อท้ายสุด'; 
        btnAddEnd.style.cssText = 'background: rgba(255, 255, 255, 0.1); padding: 8px; color: #fff; border: none; border-radius: 8px; width: 100%; cursor: pointer; margin-top: 10px;';
        btnAddEnd.addEventListener('click', () => addLyricLine(AppState.currentLyricsArray.length - 1)); 
        fragment.appendChild(btnAddEnd);
    }
    
    container.appendChild(fragment);
}

export function syncTimestampEditorUI() {
    AppState.currentLyricsArray.forEach((_, index) => {
        const row = document.getElementById(`ts-row-${index}`);
        if (row) {
            if (index === AppState.currentLyricIndex) { 
                row.style.background = 'rgba(10, 132, 255, 0.25)'; 
                row.style.borderColor = '#0a84ff'; 
            } else { 
                row.style.background = 'rgba(255, 255, 255, 0.05)'; 
                row.style.borderColor = 'rgba(255, 255, 255, 0.1)'; 
            }
        }
    });
}

function saveTimestampsToFirebase(updateLyricsText = false) {
    if (!AppState.isAdmin) return;
    updateTimestampsInDB(updateLyricsText).then(() => {
        if (updateLyricsText) {
            if (window.renderLyricsToContainer) window.renderLyricsToContainer();
            if (window.updateLyricDisplay) window.updateLyricDisplay();
        }
    });
}

function addLyricLine(index) {
    if (!confirm('ต้องการแทรกเนื้อเพลงใช่หรือไม่?')) return;
    const song = AppState.getSong(AppState.currentSongId); 
    if(!song) return;
    
    const insertAt = index + 1;
    AppState.currentLyricsArray.splice(insertAt, 0, "ท่อนใหม่...");
    
    if(!song.timestamps) song.timestamps = []; song.timestamps.splice(insertAt, 0, null);
    if(!song.singers) song.singers = []; song.singers.splice(insertAt, 0, "");
    
    if (song.covers) {
        song.covers.forEach(c => {
            if(c.timestamps) c.timestamps.splice(insertAt, 0, null);
            if(c.singers) c.singers.splice(insertAt, 0, "");
        });
    }
    
    saveTimestampsToFirebase(true);
    renderTimestampEditor();
}

function deleteLyricLine(index) {
    if (!confirm('ลบท่อนนี้ใช่หรือไม่?\nเนื้อเพลงและเวลาที่เกี่ยวข้องจะหายไปทั้งหมด')) return;
    const song = AppState.getSong(AppState.currentSongId); 
    if(!song) return;
    
    AppState.currentLyricsArray.splice(index, 1);
    
    if(song.timestamps) song.timestamps.splice(index, 1);
    if(song.singers) song.singers.splice(index, 1);
    
    if (song.covers) {
        song.covers.forEach(c => {
            if(c.timestamps) c.timestamps.splice(index, 1);
            if(c.singers) c.singers.splice(index, 1);
        });
    }
    
    saveTimestampsToFirebase(true);
    renderTimestampEditor();
}

export function nextLyric(isAuto = false) {
    if (AppState.currentLyricIndex < AppState.currentLyricsArray.length) {
        AppState.currentLyricIndex++; 
        if (window.updateLyricDisplay) window.updateLyricDisplay();
        
        if (!isAuto && AppState.isAdmin && AppState.currentSongId && AppState.ytPlayer) {
            const song = AppState.getSong(AppState.currentSongId);
            if (song && typeof AppState.ytPlayer.getCurrentTime === 'function') { 
                
                // คำนวณหักลบเวลาความหน่วง
                const offsetMs = parseInt(localStorage.getItem('admin_audio_offset')) || 0;
                const rawTime = AppState.ytPlayer.getCurrentTime();
                const currentTime = Math.max(0, rawTime - (offsetMs / 1000));
                
                let isCover = (AppState.currentCoverIndex >= 0 && song.covers && song.covers[AppState.currentCoverIndex]);

                if (isCover) {
                    if (!song.covers[AppState.currentCoverIndex].timestamps) {
                        song.covers[AppState.currentCoverIndex].timestamps = [...(song.timestamps || [])];
                    }
                    song.covers[AppState.currentCoverIndex].timestamps[AppState.currentLyricIndex] = currentTime;
                } else {
                    if (!song.timestamps) song.timestamps = []; 
                    song.timestamps[AppState.currentLyricIndex] = currentTime; 
                }
                
                const activeRow = document.getElementById(`ts-row-${AppState.currentLyricIndex}`);
                if (activeRow) {
                    const timeInput = activeRow.querySelector('input[type="number"]');
                    if (timeInput) timeInput.value = currentTime.toFixed(1);
                }
                saveTimestampsToFirebase(false); 
            }
        }
    }
}

export function prevLyric() {
    if (AppState.currentLyricIndex > -1) {
        if (AppState.isAdmin && AppState.currentSongId) {
            const song = AppState.getSong(AppState.currentSongId);
            if (song) { 
                let isCover = (AppState.currentCoverIndex >= 0 && song.covers && song.covers[AppState.currentCoverIndex]);
                if (isCover) {
                    if (song.covers[AppState.currentCoverIndex].timestamps) {
                        song.covers[AppState.currentCoverIndex].timestamps[AppState.currentLyricIndex] = null;
                    }
                } else {
                    if (song.timestamps) song.timestamps[AppState.currentLyricIndex] = null; 
                }
                
                const activeRow = document.getElementById(`ts-row-${AppState.currentLyricIndex}`);
                if (activeRow) {
                    const timeInput = activeRow.querySelector('input[type="number"]');
                    if (timeInput) timeInput.value = '';
                }
                saveTimestampsToFirebase(false); 
            }
        }
        AppState.currentLyricIndex--; 
        if (window.updateLyricDisplay) window.updateLyricDisplay();
    }
}

export function resetSync() {
    if (!AppState.isAdmin) return;
    if(confirm('ล้างเวลาทั้งหมดของเวอร์ชันที่กำลังเล่นอยู่?')) {
        const song = AppState.getSong(AppState.currentSongId);
        if (song) { 
            let isCover = (AppState.currentCoverIndex >= 0 && song.covers && song.covers[AppState.currentCoverIndex]);
            if (isCover) {
                song.covers[AppState.currentCoverIndex].timestamps = [];
                song.covers[AppState.currentCoverIndex].singers = [];
            } else {
                song.timestamps = []; 
                song.singers = []; 
            }
            saveTimestampsToFirebase(false); 
            AppState.currentLyricIndex = -1; 
            renderTimestampEditor(); 
            if (window.updateLyricDisplay) window.updateLyricDisplay(); 
        }
    }
}

// ระบบ Auto Calibration 
export function startCalibration() {
    // ... [โค้ด startCalibration เดิม นำมาวางที่นี่ แต่เปลี่ยนการเรียก event ให้เป็น addEventListener แทนการใช้ attribute inline] ...
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    if (!actx) return alert("เบราว์เซอร์ไม่รองรับระบบนี้ แนะนำให้พิมพ์ตัวเลขเองครับ");

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.95); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;';
    
    // ใส่โครงสร้างด้วย innerHTML ได้ที่นี่เพราะไม่มีข้อมูลจาก user (ไม่เสี่ยง XSS)
    overlay.innerHTML = `
        <h2 style="color:#0a84ff; margin-bottom: 10px;">🎯 ทดสอบความหน่วงหูฟัง</h2>
        <p style="color:#aaa; text-align:center; max-width:400px; line-height:1.6; margin-bottom:30px;">
            ระบบจะส่งเสียง "ติ๊ด" เป็นจังหวะจำนวน 4 ครั้ง <br>
            ให้คุณ <b>กดปุ่ม Spacebar หรือคลิกปุ่มด้านล่าง</b> <br>ให้ตรงกับเสียงที่ได้ยินเป๊ะๆ เพื่อคำนวณความหน่วง
        </p>
        <div id="calibBtn" style="width:140px; height:140px; border-radius:50%; background:#0a84ff; display:flex; align-items:center; justify-content:center; font-size:2em; font-weight:bold; cursor:pointer; user-select:none; box-shadow:0 10px 30px rgba(10,132,255,0.4); transition:transform 0.1s;">
            👆 กด!
        </div>
        <div id="calibStatus" style="margin-top: 35px; font-size: 1.2em; font-weight: bold; color: #ffcc00;">แตะหน้าจอ 1 ครั้งเพื่อเริ่ม...</div>
        <button id="calibCancel" style="margin-top:40px; background:transparent; border:1px solid #ff3b30; color:#ff3b30; padding:8px 25px; border-radius:20px; cursor:pointer;">ยกเลิก</button>
    `;
    document.body.appendChild(overlay);

    // ... [ใช้ logic การจับจังหวะแบบเดิมที่มีใน app.js] ...
    // เนื่องจากความยาวโค้ด ผมได้ใส่โครงสร้างหลักของ Calibrate ไว้ให้แล้วครับ
    const btn = overlay.querySelector('#calibBtn');
    const cancelBtn = overlay.querySelector('#calibCancel');
    
    cancelBtn.addEventListener('click', () => { document.body.removeChild(overlay); });
    // เพิ่ม Logic ของ AudioContext ตามไฟล์ต้นฉบับได้เลย
}
