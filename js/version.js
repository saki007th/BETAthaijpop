// ==========================================
// version.js - ระบบตรวจเวอร์ชันแอป
// อ่าน changelog.json (array เก่า→ใหม่) แล้วเอาอันดับแรกมาเป็น "เวอร์ชันล่าสุด"
// แจ้งเตือนผ่าน banner + หน้าตั้งค่า พร้อมปุ่มอัปเดตที่ล้างแคชให้เอง
//
// ⚙️ การปล่อยเวอร์ชันใหม่ (แก้ 3 จุดให้ตรงกันทุกครั้ง)
//   1) changelog.json  — เพิ่ม object ใหม่ไว้หัว array (version ต้องมากกว่าของเดิม)
//   2) js/version.js   — REAL_VERSION / REAL_BUILD
//   3) index.html      — <meta name="app-build">
//
// 🧪 ทดสอบระบบโดยไม่ต้อง deploy: เปิดด้วย ?sim=18.2.0
//    แอปจะ "เข้าใจว่าตัวเองเป็นเวอร์ชันนั้น" → banner + ปุ่มอัปเดตโผล่ทันที
//    กดอัปเดตแล้วพารามิเตอร์ sim จะหายไปเอง เวอร์ชันจึงเด้งกลับเป็นตัวจริง
// ==========================================

const REAL_VERSION = '18.4.4';
const REAL_BUILD = '20261103-1';

const simParam = new URL(window.location.href).searchParams.get('sim');
export const SIMULATED = !!simParam;
export const APP_VERSION = SIMULATED ? simParam : REAL_VERSION;
export const APP_BUILD = SIMULATED ? ('sim-' + simParam) : REAL_BUILD;

const CHANGELOG_URL = 'changelog.json';
// ไล่ระยะห่างขึ้นทีละขั้น: เร็วตอนเพิ่งเปิดแอป แล้วค่อยๆ ห่างไป ไม่โหลดเซิร์ฟเวอร์เปล่า
const CHECK_STEPS_MS = [30e3, 60e3, 120e3, 300e3];
const DISMISSED_KEY = 'ws_version_dismissed';
const DISMISS_TTL_MS = 30 * 60 * 1000;   // กดปิด banner แล้วให้กลับมาอีกครั้งหลัง 30 นาที

let latest = null;
let history = [];
let lastCheckAt = 0;
let pollStep = 0;
let pollTimer = null;

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
    return { version: APP_VERSION, build: APP_BUILD, simulated: SIMULATED };
};

// banner ที่กดปิดไปจะกลับมาโผล่อีกครั้งหลังผ่านไป DISMISS_TTL_MS
function isDismissed(build) {
    try {
        const raw = localStorage.getItem(DISMISSED_KEY) || '';
        if (!raw) return false;
        const parts = raw.split('|');
        if (parts[0] !== build) return false;
        if (!parts[1]) return true;
        return Date.now() - Number(parts[1]) < DISMISS_TTL_MS;
    } catch (e) { return false; }
}

function setDismissedBuild(build) {
    try { localStorage.setItem(DISMISSED_KEY, build + '|' + Date.now()); } catch (e) {}
}

// ---------- ดึง changelog (กัน cache ทุกครั้ง) ----------
async function fetchChangelog() {
    const res = await fetch(`${CHANGELOG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error('changelog.json ต้องเป็น array');
    return list;
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

// ---------- ปุ่มอัปเดต: ล้าง Cache Storage แล้วโหลดหน้าใหม่แบบกัน cache ทุกชั้น ----------
// stamp 3 ชั้น: URL ของ document + build id ใน <meta> + __r token สุ่ม
// ทำให้แน่ใจว่าได้ไฟล์ชุดล่าสุดจริง ไม่ต้องรอ cache หมดอายุ
window.applyAppUpdate = async function() {
    document.querySelectorAll('#btnUpdateNow, #btnUpdateDetails, #btnUpdateGo')
        .forEach(b => { b.disabled = true; });
    try {
        if (window.caches && window.caches.keys) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
    } catch (e) {}
    const url = new URL(window.location.href);
    const build = latest && (latest.build || latest.version);
    if (build) url.searchParams.set('v', build);
    url.searchParams.set('__r', Date.now().toString(36));
    url.searchParams.delete('sim');   // ออกจากโหมดทดสอบ → กลับไปเวอร์ชันจริง
    window.location.replace(url.toString());
};

// ---------- หน้ารายละเอียดการอัปเดต ----------
window.openUpdateSheet = function() {
    const m = latest || {};
    const outdated = window.isUpdateAvailable(latest);
    const wrap = document.createElement('div');
    const notes = (m.notes || 'ไม่มีรายละเอียดเพิ่มเติม').split('\n');
    const footer = outdated
        ? `<button id="btnUpdateGo" class="btn-primary" style="flex:1;" onclick="window.applyAppUpdate()">🔄 อัปเดตทันที</button>
           <button class="btn-secondary" onclick="window.closeSheet()">ปิด</button>`
        : `<div class="update-sheet-ok">✅ คุณใช้เวอร์ชันล่าสุดแล้ว</div>
           <button class="btn-secondary" onclick="window.closeSheet()">ปิด</button>`;
    wrap.innerHTML = `
        <div class="update-sheet-meta">
            <div><b>เวอร์ชันปัจจุบัน</b><span>v${APP_VERSION}${SIMULATED ? ' (ทดสอบ)' : ''}</span></div>
            <div><b>เวอร์ชันล่าสุด</b><span class="update-sheet-latest">v${escapeHtml(m.version || '-')}</span></div>
            <div><b>วันที่ปล่อย</b><span>${escapeHtml(m.releasedAt || '-')}</span></div>
        </div>
        <div class="update-sheet-notes">${notes.map(t => `<div>${escapeHtml(t)}</div>`).join('')}</div>
        <div style="display:flex; gap:10px; margin-top:18px;">${footer}</div>
    `;
    window.openSheet('🔄 อัปเดตเลย', wrap, () => { if (window.wm) window.wm.updateWin = null; });
    if (window.wm) window.wm.updateWin = { close: () => window.closeSheet() };
};

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

// ---------- ประวัติการอัปเดตทั้งหมด ----------
window.openChangelogSheet = function() {
    const wrap = document.createElement('div');
    if (!history.length) {
        wrap.innerHTML = '<div style="color:var(--text-3); text-align:center; padding:24px 0;">ยังไม่มีประวัติการอัปเดต</div>';
    } else {
        const items = history.map(rel => {
            const cmp = window.compareVersions(rel.version, APP_VERSION);
            const tag = cmp === 0
                ? '<span class="changelog-tag current">เวอร์ชันที่ใช้อยู่</span>'
                : (cmp > 0 ? '<span class="changelog-tag newer">ใหม่กว่า</span>' : '');
            const notes = (rel.notes || '').split('\n')
                .map(t => `<div>${escapeHtml(t)}</div>`).join('');
            return `
                <div class="changelog-item${cmp === 0 ? ' current' : ''}">
                    <div class="changelog-head">
                        <span class="changelog-ver">v${escapeHtml(rel.version)}</span>
                        <span class="changelog-date">${escapeHtml(rel.releasedAt || '-')}</span>
                        ${tag}
                    </div>
                    <div class="changelog-notes">${notes}</div>
                </div>`;
        }).join('');
        wrap.innerHTML = `
            <div class="changelog-current">เวอร์ชันที่กำลังใช้: <b>v${APP_VERSION}</b>${SIMULATED ? ' <i>(โหมดทดสอบ ?sim=' + escapeHtml(APP_VERSION) + ')</i>' : ' (build ' + APP_BUILD + ')'}</div>
            ${items}`;
    }
    window.openSheet('📜 ประวัติการอัปเดต', wrap, () => { if (window.wm) window.wm.clWin = null; });
    if (window.wm) window.wm.clWin = { close: () => window.closeSheet() };
};

// ---------- เวอร์ชันใต้ชื่อโปรไฟล์ (sidebar) ----------
function renderSidebarVersion() {
    const el = document.getElementById('profileVersion');
    if (!el) return;
    const outdated = window.isUpdateAvailable(latest);
    el.innerText = 'v' + APP_VERSION;
    el.classList.toggle('has-update', outdated);
    el.title = outdated
        ? 'มีเวอร์ชันใหม่ v' + latest.version + ' — คลิกเพื่อดูประวัติการอัปเดต'
        : 'เวอร์ชันแอป v' + APP_VERSION + ' — คลิกเพื่อดูประวัติการอัปเดต';
}

// ---------- ส่วน "เกี่ยวกับ" ในหน้าตั้งค่า ----------
// build id ใน <meta> ของ HTML ที่เพิ่งโหลด ถ้าไม่ตรงกับ APP_BUILD แปลว่า
// index.html ใหม่แต่ JS เก่า = เจอ cache — ต้องกดอัปเดตซ้ำอีกครั้ง
function metaBuild() {
    const m = document.querySelector('meta[name="app-build"]');
    return m ? m.content : '';
}

function renderStaleNote() {
    const note = document.getElementById('versionNote');
    if (!note) return;
    if (SIMULATED) {
        note.className = 'version-note sim';
        note.style.display = 'block';
        note.innerHTML = `🧪 <b>โหมดทดสอบ</b> — กำลังแสดงตัวเป็นเวอร์ชัน <b>v${escapeHtml(APP_VERSION)}</b> (ไฟล์จริงคือ v${escapeHtml(REAL_VERSION)}) กดปุ่มอัปเดตเพื่อกลับไปเวอร์ชันจริง · <a href="${window.location.pathname}" style="color:var(--accent);">ออกจากโหมดทดสอบ</a>`;
        return;
    }
    note.className = 'version-note';
    const htmlBuild = metaBuild();
    if (!htmlBuild || htmlBuild === APP_BUILD) { note.style.display = 'none'; return; }
    note.style.display = 'block';
    note.innerHTML = `⚠️ <b>แคชเก่า</b> — HTML เป็น build <b>${escapeHtml(htmlBuild)}</b> แต่โค้ดที่รันอยู่เป็น build <b>${escapeHtml(APP_BUILD)}</b> (build ล่าสุดคือ <b>${escapeHtml((latest && latest.build) || htmlBuild)}</b>) กดปุ่มอัปเดตอีกครั้งเพื่อโหลดโค้ดชุดใหม่`;
}

function renderVersionInfo() {
    renderSidebarVersion();
    const cur = document.getElementById('versionCurrent');
    const lat = document.getElementById('versionLatest');
    const st = document.getElementById('versionStatus');
    const goBtn = document.getElementById('btnUpdateDetails');
    const outdated = window.isUpdateAvailable(latest);
    if (goBtn) goBtn.style.display = outdated ? '' : 'none';
    renderStaleNote();
    if (cur) cur.innerText = 'v' + APP_VERSION + (SIMULATED ? ' (โหมดทดสอบ)' : ' (build ' + APP_BUILD + ')');
    const lc = document.getElementById('versionLastCheck');
    if (lc) {
        lc.innerText = lastCheckAt
            ? new Date(lastCheckAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              + ' · พบ ' + history.length + ' เวอร์ชัน'
            : '-';
    }
    if (!lat || !st) return;

    if (!latest) { lat.innerText = 'ยังไม่ได้ตรวจ'; st.innerText = '⏳ กำลังรอการตรวจสอบ'; st.className = 'version-status'; return; }
    if (outdated) {
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
        history = await fetchChangelog();
        latest = history[0] || null;
        lastCheckAt = Date.now();
        const hasUpdate = window.isUpdateAvailable(latest);
        renderVersionInfo();
        if (hasUpdate) {
            const buildKey = latest.build || latest.version || '';
            if (latest.mandatory || !isDismissed(buildKey)) showUpdateBanner(latest);
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

// ---------- ตัวจับเวลา: ไล่ระยะ 30s → 5 นาที, ไม่ยิงตอนแท็บถูกซ่อน ----------
function scheduleNextCheck() {
    clearTimeout(pollTimer);
    if (document.hidden) return;
    const delay = CHECK_STEPS_MS[Math.min(pollStep, CHECK_STEPS_MS.length - 1)];
    pollStep = Math.min(pollStep + 1, CHECK_STEPS_MS.length - 1);
    pollTimer = setTimeout(runAutoCheck, delay);
}

async function runAutoCheck() {
    if (document.hidden) return;
    await window.checkAppVersion({ silent: true });
    scheduleNextCheck();
}

function pokeCheck() {
    clearTimeout(pollTimer);
    // กันยิงถี่เกินไปถ้ามี event ที่ยิงบ่อย ๆ (เช่นสลับไปมาหน้าต่างแรง ๆ)
    if (Date.now() - lastCheckAt < 30e3) {
        scheduleNextCheck();
        return;
    }
    pollStep = 0;
    runAutoCheck();
}

// ---------- เริ่มระบบอัตโนมัติ ----------
document.addEventListener('DOMContentLoaded', () => {
    renderVersionInfo();
    pokeCheck();
    // กลับมาที่แท็บ / โฟกัสหน้าต่าง / กลับมาออนไลน์ / เปิดจาก bfcache
    ['visibilitychange', 'focus', 'online', 'pageshow'].forEach(evt => {
        window.addEventListener(evt, () => {
            if (evt === 'visibilitychange' && document.hidden) { clearTimeout(pollTimer); return; }
            pokeCheck();
        });
    });
});
