// ==========================================
// discord-presence.js - ระบบเชื่อมต่อ Discord Rich Presence & Media Session
// - ส่งข้อมูลเพลงเข้า OS Media Session (Windows / Mac / มือถือ) อัตโนมัติบนเว็บ
// - เชื่อมต่อ Discord Rich Presence ผ่านแอป Desktop (Electron IPC หรือ Local Bridge :8787)
// - หน้าต่างดาวน์โหลดแอป & ตั้งค่า Discord (เชื่อม Firebase settings/discord)
// ==========================================
import { db, doc, getDoc, setDoc } from './config.js';

const BRIDGE_URL = 'http://127.0.0.1:8787';

window.discordConfig = {
    clientId: localStorage.getItem('ws_discord_client_id') || '',
    downloadUrl: localStorage.getItem('ws_discord_download_url') || '',
    bridgeConnected: false,
    rpcReady: false,
    isElectron: !!(window.electronAPI && window.electronAPI.isElectron)
};

// เดา URL ดาวน์โหลดจาก GitHub Pages อัตโนมัติ (กรณีโฮสต์บน <user>.github.io/<repo>)
function getAutoGithubReleaseUrl() {
    try {
        const host = window.location.hostname;
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (host.endsWith('.github.io') && pathParts.length >= 1) {
            const owner = host.replace('.github.io', '');
            const repo = pathParts[0];
            return `https://github.com/${owner}/${repo}/releases/latest/download/Ultimate-JP-Mix-Portable.exe`;
        }
    } catch (e) {}
    return '';
}

export async function loadDiscordSettings() {
    try {
        const snap = await getDoc(doc(db, 'settings', 'discord'));
        if (snap.exists()) {
            const data = snap.data() || {};
            if (data.clientId && !localStorage.getItem('ws_discord_client_id_custom')) {
                window.discordConfig.clientId = String(data.clientId).trim();
                localStorage.setItem('ws_discord_client_id', window.discordConfig.clientId);
            }
            if (data.downloadUrl) {
                window.discordConfig.downloadUrl = String(data.downloadUrl).trim();
                localStorage.setItem('ws_discord_download_url', window.discordConfig.downloadUrl);
            }
        }
    } catch (e) {}
    await window.checkDiscordBridgeStatus();
}

window.checkDiscordBridgeStatus = async function() {
    if (window.electronAPI && typeof window.electronAPI.getStatus === 'function') {
        try {
            const st = await window.electronAPI.getStatus();
            window.discordConfig.isElectron = true;
            window.discordConfig.bridgeConnected = true;
            window.discordConfig.rpcReady = !!st.rpcReady;
            updateDiscordUiBadges();
            return st;
        } catch (e) {}
    }

    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1200);
        const res = await fetch(`${BRIDGE_URL}/api/discord/status`, { signal: ctrl.signal });
        clearTimeout(timer);
        if (res.ok) {
            const st = await res.json();
            window.discordConfig.bridgeConnected = true;
            window.discordConfig.rpcReady = !!st.rpcReady;
            updateDiscordUiBadges();
            return st;
        }
    } catch (e) {}

    window.discordConfig.bridgeConnected = false;
    window.discordConfig.rpcReady = false;
    updateDiscordUiBadges();
    return { ok: false };
};

function updateDiscordUiBadges() {
    const dot = document.getElementById('discordNavDot');
    const settingsStatus = document.getElementById('discordSettingsStatusText');
    const isActive = window.discordConfig.isElectron || window.discordConfig.bridgeConnected;

    if (dot) {
        dot.style.display = isActive ? 'inline-block' : 'none';
        dot.style.background = window.discordConfig.rpcReady ? '#34c759' : '#ff9f0a';
    }
    if (settingsStatus) {
        if (window.discordConfig.rpcReady) {
            settingsStatus.innerHTML = '<span style="color:#34c759; font-weight:600;">🟢 เชื่อมต่อกับ Discord สำเร็จแล้ว</span>';
        } else if (isActive) {
            settingsStatus.innerHTML = '<span style="color:#ff9f0a; font-weight:600;">🟡 เปิดแอป Desktop แล้ว (รอเชื่อมต่อโปรแกรม Discord หรือตั้งค่า Client ID)</span>';
        } else {
            settingsStatus.innerHTML = '<span style="color:var(--text-3);">⚪ ใช้งานผ่านเว็บเบราว์เซอร์ (ดาวน์โหลดแอปเพื่อโชว์สถานะบน Discord)</span>';
        }
    }
}

// ==========================================
// 🎵 1. อัปเดต OS Media Session (ทำงานบนเว็บเบราว์เซอร์ 100%)
// ==========================================
window.updateMediaSession = function(song, videoId, isPlaying) {
    if (!('mediaSession' in navigator)) return;
    if (!song) {
        try {
            navigator.mediaSession.playbackState = 'none';
            navigator.mediaSession.metadata = null;
        } catch (e) {}
        return;
    }

    try {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title || '-',
            artist: song.artist || '-',
            album: 'Ultimate JP Mix',
            artwork: videoId ? [
                { src: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
                { src: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }
            ] : []
        });
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        navigator.mediaSession.setActionHandler('play', () => { if (window.toggleLivePlay) window.toggleLivePlay(); });
        navigator.mediaSession.setActionHandler('pause', () => { if (window.toggleLivePlay) window.toggleLivePlay(); });
        navigator.mediaSession.setActionHandler('previoustrack', () => { if (window.prevLiveSong) window.prevLiveSong(); });
        navigator.mediaSession.setActionHandler('nexttrack', () => { if (window.nextLiveSong) window.nextLiveSong(); });
    } catch (e) {}
};

// ==========================================
// 🎮 2. ส่งข้อมูลเพลงเข้า Discord Rich Presence
// ==========================================
window.updateDiscordPresence = async function(activity) {
    if (window.electronAPI && typeof window.electronAPI.updatePresence === 'function') {
        const ok = await window.electronAPI.updatePresence(activity);
        window.discordConfig.bridgeConnected = true;
        window.discordConfig.rpcReady = !!ok;
        updateDiscordUiBadges();
        return ok;
    }

    if (!window.discordConfig.bridgeConnected) return false;

    try {
        const res = await fetch(`${BRIDGE_URL}/api/discord/presence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activity)
        });
        const data = await res.json();
        window.discordConfig.rpcReady = !!data.rpcReady;
        updateDiscordUiBadges();
        return !!data.ok;
    } catch (e) {
        window.discordConfig.bridgeConnected = false;
        window.discordConfig.rpcReady = false;
        updateDiscordUiBadges();
        return false;
    }
};

window.clearDiscordPresence = async function() {
    if ('mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {}
    }
    if (window.electronAPI && typeof window.electronAPI.clearPresence === 'function') {
        await window.electronAPI.clearPresence();
        return;
    }
    if (!window.discordConfig.bridgeConnected) return;
    try { await fetch(`${BRIDGE_URL}/api/discord/clear`, { method: 'POST' }); } catch (e) {}
};

window.syncDiscordPresence = async function() {
    const song = (window.songs || []).find(s => s.id === window.currentSongId) || null;
    if (!song) {
        window.updateMediaSession(null, null, false);
        if (window.clearDiscordPresence) window.clearDiscordPresence();
        return;
    }

    // รองรับชื่อนักร้องและวิดีโอตามเวอร์ชัน Cover ที่กำลังเลือกฟังอยู่
    let activeArtist = song.artist || 'ไม่ระบุศิลปิน';
    let targetAudioPath = song.audioPath;
    if (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]) {
        const cov = song.covers[window.currentCoverIndex];
        if (cov.coverArtist) activeArtist = cov.coverArtist;
        if (cov.audioPath) targetAudioPath = cov.audioPath;
    }

    const videoId = window.extractYouTubeID ? window.extractYouTubeID(targetAudioPath) : null;
    window.updateMediaSession({ title: song.title, artist: activeArtist }, videoId, true);

    const elapsed = (window.ytPlayer && typeof window.ytPlayer.getCurrentTime === 'function')
        ? (window.ytPlayer.getCurrentTime() || 0) : 0;
    const duration = (window.ytPlayer && typeof window.ytPlayer.getDuration === 'function')
        ? (window.ytPlayer.getDuration() || 0) : 0;

    const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
    const slug = window.createCleanSlug ? window.createCleanSlug(song.title) : '';
    const shareUrl = (window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('127.0.0.1'))
        ? `${window.location.origin}${window.location.pathname}?track=${slug}`
        : (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');

    if (window.updateDiscordPresence) {
        window.updateDiscordPresence({
            clientId: window.discordConfig.clientId,
            statusDisplayType: 1, // 1 = แสดงชื่อนักร้อง (state) หลังคำว่า "กำลังฟัง..."
            name: activeArtist,
            songTitle: song.title,
            artist: activeArtist,
            state: song.title,
            details: activeArtist,
            largeText: 'Ultimate JP Mix',
            elapsed: Math.floor(elapsed),
            duration: Math.floor(duration),
            thumbUrl,
            buttons: shareUrl ? [{ label: '🎧 ฟังเพลงนี้', url: shareUrl }] : []
        });
    }
};

window.openYouTubeLoginPopup = function() {
    if (window.electronAPI && typeof window.electronAPI.openYouTubeLogin === 'function') {
        window.electronAPI.openYouTubeLogin();
        return;
    }
    window.open(
        'https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com',
        'ytLoginPopup',
        'width=520,height=680'
    );
};

// ==========================================
// 🪟 3. หน้าต่างดาวน์โหลดแอป & ตั้งค่า Discord บนหน้าเว็บ
// ==========================================
window.openDiscordSheet = async function() {
    await window.checkDiscordBridgeStatus();

    const downloadUrl = window.discordConfig.downloadUrl || getAutoGithubReleaseUrl();
    const isActive = window.discordConfig.isElectron || window.discordConfig.bridgeConnected;
    const isRpcOk = window.discordConfig.rpcReady;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:18px; color:var(--text-1);';

    let statusBanner = '';
    if (isRpcOk) {
        statusBanner = `
            <div style="background:rgba(52,199,89,0.14); border:1px solid rgba(52,199,89,0.4); border-radius:14px; padding:16px; display:flex; align-items:center; gap:14px;">
                <div style="font-size:28px;">🟢</div>
                <div style="flex:1;">
                    <div style="font-weight:700; color:#34c759; font-size:15px;">เชื่อมต่อกับ Discord สำเร็จแล้ว!</div>
                    <div style="font-size:13px; color:var(--text-2); margin-top:4px;">เมื่อคุณกดเล่นเพลง สถานะ <b>"กำลังฟัง Ultimate JP Mix"</b> พร้อมชื่อเพลงและปกจะแสดงบนโปรไฟล์ Discord ของคุณทันที</div>
                </div>
            </div>`;
    } else if (isActive) {
        statusBanner = `
            <div style="background:rgba(255,159,10,0.14); border:1px solid rgba(255,159,10,0.4); border-radius:14px; padding:16px; display:flex; align-items:center; gap:14px;">
                <div style="font-size:28px;">🟡</div>
                <div style="flex:1;">
                    <div style="font-weight:700; color:#ff9f0a; font-size:15px;">เปิดใช้งานแอป Desktop แล้ว (รอเชื่อมต่อ Discord)</div>
                    <div style="font-size:13px; color:var(--text-2); margin-top:4px;">กรุณาตรวจสอบว่าเปิดโปรแกรม <b>Discord Desktop</b> ทิ้งไว้ และใส่ <b>Discord Application ID</b> ด้านล่างเรียบร้อยแล้ว</div>
                </div>
            </div>`;
    } else {
        statusBanner = `
            <div style="background:rgba(88,101,242,0.14); border:1px solid rgba(88,101,242,0.4); border-radius:14px; padding:16px; display:flex; align-items:center; gap:14px;">
                <div style="font-size:28px;"><i class="fa-brands fa-discord" style="color:#5865F2;"></i></div>
                <div style="flex:1;">
                    <div style="font-weight:700; color:#fff; font-size:15px;">แสดงสถานะกำลังฟังเพลงบนโปรไฟล์ Discord</div>
                    <div style="font-size:13px; color:var(--text-2); margin-top:4px;">เนื่องจากเว็บเบราว์เซอร์ทั่วไปถูกจำกัดไม่ให้สั่งโปรแกรม Discord ในเครื่องโดยตรง คุณสามารถดาวน์โหลดแอปตัวช่วยด้านล่างไปเปิดใช้งานได้ทันที (ไม่ต้องลง Node.js)</div>
                </div>
            </div>`;
    }

    const downloadBtnHtml = downloadUrl
        ? `<a href="${downloadUrl}" target="_blank" rel="noopener"
              style="display:flex; align-items:center; justify-content:center; gap:10px; background:#5865F2; color:#fff; text-decoration:none; padding:14px 20px; border-radius:12px; font-weight:700; font-size:15px; box-shadow:0 8px 24px rgba(88,101,242,0.35);">
              <i class="fa-solid fa-download"></i> ดาวน์โหลดแอปสำหรับ Windows (.exe)
           </a>`
        : `<button id="btnDiscordNoLink" style="display:flex; align-items:center; justify-content:center; gap:10px; background:rgba(88,101,242,0.35); color:#fff; border:1px solid rgba(88,101,242,0.5); padding:14px 20px; border-radius:12px; font-weight:700; font-size:14px; cursor:pointer;">
              <i class="fa-solid fa-circle-info"></i> ยังไม่ได้ตั้งลิงก์ดาวน์โหลดไฟล์ .exe (ตั้งค่าได้ด้านล่าง)
           </button>`;

    const adminSectionHtml = window.isAdmin ? `
        <div style="background:rgba(255,255,255,0.04); border:1px solid var(--border-soft); border-radius:14px; padding:16px;">
            <div style="font-weight:700; font-size:14px; color:#0a84ff; margin-bottom:10px;">🛠️ ตั้งค่าสำหรับแอดมิน (บันทึกให้ผู้ใช้ทุกคนบนเว็บ)</div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <div>
                    <label style="font-size:12px; color:var(--text-2); display:block; margin-bottom:4px;">1. Discord Application ID (สร้างฟรีที่ <a href="https://discord.com/developers/applications" target="_blank" style="color:#5865F2;">Discord Developer Portal</a> → New Application → คัดลอก Application ID):</label>
                    <input type="text" id="inputDiscordClientId" value="${window.discordConfig.clientId || ''}" placeholder="เช่น 1234567890123456789" style="width:100%; margin:0; padding:10px 12px; border-radius:8px; border:1px solid var(--border-soft); background:rgba(0,0,0,0.35); color:#fff; box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:12px; color:var(--text-2); display:block; margin-bottom:4px;">2. ลิงก์ดาวน์โหลดไฟล์แอป (.exe) จาก GitHub Releases หรือ Google Drive (เว้นว่างเพื่อใช้ลิงก์ GitHub อัตโนมัติ):</label>
                    <input type="text" id="inputDiscordDownloadUrl" value="${window.discordConfig.downloadUrl || ''}" placeholder="https://github.com/.../releases/download/desktop-latest/Ultimate-JP-Mix-Portable.exe" style="width:100%; margin:0; padding:10px 12px; border-radius:8px; border:1px solid var(--border-soft); background:rgba(0,0,0,0.35); color:#fff; box-sizing:border-box;">
                </div>
                <button id="btnSaveDiscordConfig" class="btn-primary" style="margin:4px 0 0 0;">💾 บันทึกตั้งค่า Discord ลงระบบ</button>
            </div>
        </div>
    ` : `
        <details style="background:rgba(255,255,255,0.03); border:1px solid var(--border-soft); border-radius:12px; padding:12px 14px;">
            <summary style="cursor:pointer; font-size:13px; color:var(--text-2); font-weight:600;">⚙️ ตั้งค่า Discord Application ID ส่วนตัว (ทางเลือก)</summary>
            <div style="margin-top:10px; display:flex; gap:8px;">
                <input type="text" id="inputDiscordClientId" value="${window.discordConfig.clientId || ''}" placeholder="ใส่ Application ID..." style="flex:1; margin:0; padding:8px 12px; border-radius:8px; border:1px solid var(--border-soft); background:rgba(0,0,0,0.35); color:#fff;">
                <button id="btnSaveDiscordLocal" class="btn-secondary" style="margin:0;">บันทึก</button>
            </div>
        </details>
    `;

    wrap.innerHTML = `
        ${statusBanner}

        <div style="background:var(--bg-surface-2); border:1px solid var(--border-soft); border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:14px;">
            <div style="font-weight:700; font-size:15px;">🚀 วิธีใช้งานง่ายๆ (สำหรับผู้ใช้ทั่วไป)</div>
            <div style="font-size:13px; color:var(--text-2); line-height:1.65;">
                1. กดดาวน์โหลดไฟล์แอป <b>Ultimate-JP-Mix-Portable.exe</b> ด้านล่าง (เป็นไฟล์ตัวเดียว เปิดใช้ได้เลยไม่ต้องติดตั้ง)<br>
                2. เปิดโปรแกรม <b>Discord</b> ในคอมพิวเตอร์ของคุณทิ้งไว้<br>
                3. เปิดไฟล์แอปที่ดาวน์โหลดมา แล้วกดเล่นเพลง (หรือเปิดแอปย่อไว้แล้วเล่นเพลงบนหน้าเว็บนี้ก็ได้!) สถานะกำลังฟังเพลงจะแสดงบน Discord อัตโนมัติ
            </div>
            ${downloadBtnHtml}
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button id="btnRecheckDiscord" class="btn-secondary" style="flex:1; margin:0;">
                    <i class="fa-solid fa-plug-circle-check"></i> ตรวจสอบการเชื่อมต่ออีกครั้ง
                </button>
                <button onclick="window.openYouTubeLoginPopup()" class="btn-secondary" style="flex:1; margin:0; border-color:rgba(255,59,48,0.45); color:#ff6961;">
                    <i class="fa-brands fa-youtube"></i> ล็อกอิน YouTube Premium ในแอป
                </button>
            </div>
        </div>

        ${adminSectionHtml}
    `;

    window.openSheet('🎧 เชื่อมต่อสถานะกำลังฟังเพลงกับ Discord', wrap);

    const btnRecheck = wrap.querySelector('#btnRecheckDiscord');
    if (btnRecheck) {
        btnRecheck.onclick = async () => {
            btnRecheck.disabled = true;
            btnRecheck.innerText = '⏳ กำลังตรวจสอบ...';
            await window.checkDiscordBridgeStatus();
            if (window.currentSongId && window.syncDiscordPresence) {
                await window.syncDiscordPresence();
            }
            window.openDiscordSheet();
        };
    }

    const btnSaveAdmin = wrap.querySelector('#btnSaveDiscordConfig');
    if (btnSaveAdmin) {
        btnSaveAdmin.onclick = async () => {
            const cid = (wrap.querySelector('#inputDiscordClientId')?.value || '').trim();
            const durl = (wrap.querySelector('#inputDiscordDownloadUrl')?.value || '').trim();
            btnSaveAdmin.disabled = true;
            btnSaveAdmin.innerText = '⏳ กำลังบันทึก...';
            try {
                await setDoc(doc(db, 'settings', 'discord'), {
                    clientId: cid,
                    downloadUrl: durl,
                    updatedAt: Date.now()
                }, { merge: true });
                window.discordConfig.clientId = cid;
                window.discordConfig.downloadUrl = durl;
                localStorage.setItem('ws_discord_client_id', cid);
                localStorage.setItem('ws_discord_download_url', durl);
                if (window.syncDiscordPresence) await window.syncDiscordPresence();
                alert('✅ บันทึกการตั้งค่า Discord เรียบร้อยแล้ว!');
                window.openDiscordSheet();
            } catch (e) {
                alert('❌ บันทึกไม่สำเร็จ: ' + e.message);
                btnSaveAdmin.disabled = false;
                btnSaveAdmin.innerText = '💾 บันทึกตั้งค่า Discord ลงระบบ';
            }
        };
    }

    const btnSaveLocal = wrap.querySelector('#btnSaveDiscordLocal');
    if (btnSaveLocal) {
        btnSaveLocal.onclick = async () => {
            const cid = (wrap.querySelector('#inputDiscordClientId')?.value || '').trim();
            window.discordConfig.clientId = cid;
            localStorage.setItem('ws_discord_client_id', cid);
            localStorage.setItem('ws_discord_client_id_custom', cid ? '1' : '');
            if (window.syncDiscordPresence) await window.syncDiscordPresence();
            alert('✅ บันทึก Application ID เรียบร้อยแล้ว!');
            window.openDiscordSheet();
        };
    }

    const btnNoLink = wrap.querySelector('#btnDiscordNoLink');
    if (btnNoLink) {
        btnNoLink.onclick = () => {
            alert('แอดมินสามารถนำโค้ดขึ้น GitHub เพื่อให้ GitHub Actions สร้างไฟล์ .exe อัตโนมัติ หรือนำลิงก์ไฟล์ .exe มาใส่ในช่องตั้งค่าด้านล่างได้เลยครับ');
        };
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadDiscordSettings();
    // ตรวจสถานะ Bridge ซ้ำทุก 15 วินาที เผื่อผู้ใช้เพิ่งกดเปิดแอป
    setInterval(() => {
        window.checkDiscordBridgeStatus();
    }, 15000);
});
