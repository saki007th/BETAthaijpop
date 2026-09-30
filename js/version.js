// ==========================================
// version.js - ระบบตรวจเวอร์ชันแอป
// เทียบเวอร์ชันที่ deploy ล่าสุด (version.json) กับเวอร์ชันที่กำลังใช้อยู่
// แล้วแจ้งเตือนผ่าน banner + หน้าตั้งค่า พร้อมปุ่มอัปเดตที่ล้างแคชให้เอง
// ==========================================

export const APP_VERSION = '18.2.1';
export const APP_BUILD = '20260930-1';

const MANIFEST_URL = 'version.json';
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const DISMISSED_KEY = 'ws_version_dismissed';

let latest = null;

// ---------- เทียบเวอร์ชัน (semver แบบย่อ เช่น 18.2 หรือ 18.2.1) ----------
function parseVersion(v) {
    return String(v == null ? '0' : v).split('.').map(p => parseInt(p, 10) || 0);
}

window.compareVersions = function(a, b) {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff) return diff > 0 ? 1 : -1;
    }
    return 0;
};

// build ต่างกัน = deploy ใหม่เสมอ / ถ้าไม่มี build ให้ดูเฉพาะเลขเวอร์ชัน
window.isUpdateAvailable = function(manifest) {
    if (!manifest) return false;
    if (manifest.build && manifest.build === APP_BUILD) return false;
    return window.compareVersions(manifest.version, APP_VERSION) > 0;
};

window.getAppVersion = function() {
    return { version: APP_VERSION, build: APP_BUILD };
};

function dismissedBuild() {
    try { return localStorage.getItem(DISMISSED_KEY) || ''; } catch (e) { return ''; }
}

function setDismissedBuild(build) {
    try { localStorage.setItem(DISMISSED_KEY, build); } catch (e) {}
}

// ---------- ดึง manifest ล่าสุด (กัน cache ทุกครั้ง) ----------
async function fetchManifest() {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
}

// ---------- Banner แจ้งเตือนเวอร์ชันใหม่ ----------
function bannerTarget() { return document.getElementById('updateBanner'); }

window.hideUpdateBanner = function() {
    const el = bannerTarget();
    if (el) el.classList.remove('show');
};

function showUpdateBanner(manifest) {
    const el = bannerTarget();
    if (!el) return;
    const label = el.querySelector('#updateBannerVersion');
    if (label) label.innerText = 'v' + (manifest.version || '?');
    const badge = el.querySelector('#updateBannerBadge');
    if (badge) badge.style.display = manifest.mandatory ? 'inline-block' : 'none';
    el.classList.add('show');
    el.dataset.build = manifest.build || manifest.version || '';
}

window.dismissUpdateBanner = function() {
    const el = bannerTarget();
    if (el && el.dataset.build) setDismissedBuild(el.dataset.build);
    window.hideUpdateBanner();
};

// ---------- ปุ่มอัปเดต: ล้าง Cache Storage แล้วโหลดหน้าใหม่แบบมี stamp ----------
window.applyAppUpdate = async function() {
    const btn = document.getElementById('btnUpdateNow');
    if (btn) { btn.disabled = true; btn.innerText = 'กำลังอัปเดต...'; }
    try {
        if (window.caches && window.caches.keys) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
    } catch (e) {}
    const url = new URL(window.location.href);
    url.searchParams.set('v', (latest && (latest.build || latest.version)) || Date.now().toString());
    window.location.replace(url.toString());
};

// ---------- หน้ารายละเอียดการอัปเดต ----------
window.openUpdateSheet = function() {
    const m = latest || {};
    const wrap = document.createElement('div');
    const notes = (m.notes || 'ไม่มีรายละเอียดเพิ่มเติม').split('\n');
    wrap.innerHTML = `
        <div class="update-sheet-meta">
            <div><b>เวอร์ชันปัจจุบัน</b><span>v${APP_VERSION}</span></div>
            <div><b>เวอร์ชันล่าสุด</b><span class="update-sheet-latest">v${m.version || '-'}</span></div>
            <div><b>วันที่ปล่อย</b><span>${escapeHtml(m.releasedAt || '-')}</span></div>
        </div>
        <div class="update-sheet-notes">${notes.map(t => `<div>${escapeHtml(t)}</div>`).join('')}</div>
        <div style="display:flex; gap:10px; margin-top:18px;">
            <button class="btn-primary" style="flex:1;" onclick="window.applyAppUpdate()">🔄 อัปเดตทันที</button>
            <button class="btn-secondary" onclick="window.closeSheet()">ปิด</button>
        </div>
    `;
    window.openSheet('🔄 อัปเดตเลย', wrap, () => { if (window.wm) window.wm.updateWin = null; });
    if (window.wm) window.wm.updateWin = { close: () => window.closeSheet() };
};

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

// ---------- เวอร์ชันใต้ชื่อโปรไฟล์ (sidebar) ----------
function renderSidebarVersion() {
    const el = document.getElementById('profileVersion');
    if (!el) return;
    const outdated = window.isUpdateAvailable(latest);
    el.innerText = 'v' + APP_VERSION;
    el.classList.toggle('has-update', outdated);
    el.title = outdated
        ? 'มีเวอร์ชันใหม่ v' + latest.version + ' — คลิกเพื่อดูรายละเอียด'
        : 'เวอร์ชันแอป v' + APP_VERSION;
}

// ---------- ส่วน "เกี่ยวกับ" ในหน้าตั้งค่า ----------
function renderVersionInfo() {
    renderSidebarVersion();
    const cur = document.getElementById('versionCurrent');
    const lat = document.getElementById('versionLatest');
    const st = document.getElementById('versionStatus');
    if (cur) cur.innerText = 'v' + APP_VERSION + ' (build ' + APP_BUILD + ')';
    if (!lat || !st) return;

    if (!latest) { lat.innerText = 'ยังไม่ได้ตรวจ'; st.innerText = '⏳ กำลังรอการตรวจสอบ'; st.className = 'version-status'; return; }
    if (window.isUpdateAvailable(latest)) {
        lat.innerText = 'v' + latest.version + (latest.releasedAt ? ' (' + latest.releasedAt + ')' : '');
        st.innerText = '🆕 มีเวอร์ชันใหม่ให้อัปเดต';
        st.className = 'version-status outdated';
    } else {
        lat.innerText = 'v' + latest.version;
        st.innerText = '✅ เป็นเวอร์ชันล่าสุดแล้ว';
        st.className = 'version-status uptodate';
    }
}

// ---------- จุดตรวจเวอร์ชัน (เรียกได้จากปุ่มในหน้าตั้งค่า / เรียกอัตโนมัติ) ----------
window.checkAppVersion = async function(options) {
    const opts = options || {};
    const btn = document.getElementById('btnCheckVersion');
    if (btn && !opts.silent) { btn.disabled = true; btn.innerText = '⏳ กำลังตรวจสอบ...'; }

    try {
        latest = await fetchManifest();
        const hasUpdate = window.isUpdateAvailable(latest);
        renderVersionInfo();
        if (hasUpdate) {
            const buildKey = latest.build || latest.version || '';
            if (latest.mandatory || dismissedBuild() !== buildKey) showUpdateBanner(latest);
        } else {
            window.hideUpdateBanner();
        }
        return { hasUpdate, manifest: latest };
    } catch (e) {
        if (btn) {
            const st = document.getElementById('versionStatus');
            if (st && !latest) { st.innerText = '⚠️ ตรวจสอบไม่สำเร็จ (ออฟไลน์?)'; st.className = 'version-status'; }
        }
        return { hasUpdate: false, error: e };
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> ตรวจสอบเวอร์ชัน'; }
    }
};

// ---------- เริ่มระบบอัตโนมัติ ----------
document.addEventListener('DOMContentLoaded', () => {
    renderVersionInfo();
    window.checkAppVersion({ silent: true });
    setInterval(() => window.checkAppVersion({ silent: true }), CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) window.checkAppVersion({ silent: true });
    });
});
