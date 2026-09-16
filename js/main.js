// ==========================================
// main.js - bootstrap
// ==========================================
import { auth, provider, signInWithPopup, signOut, onAuthStateChanged, db, ALLOWED_EMAILS } from './config.js';
import { fetchSongs } from './library.js';
import { initializeSingerColors } from './singerColors.js';

window.isLoggedIn = false;
window.isAdmin = false;

window.loginWithGoogle = async function() {
    try { await signInWithPopup(auth, provider); } catch (e) { alert("เข้าสู่ระบบไม่สำเร็จ"); }
};
window.logout = async function() {
    if (confirm('ต้องการออกจากระบบใช่หรือไม่?')) { await signOut(auth); }
};

onAuthStateChanged(auth, async (user) => {
    window.isLoggedIn = !!user;
    window.isAdmin = user && ALLOWED_EMAILS.includes(user.email);

    document.getElementById('btnHeaderLogout').style.display = window.isLoggedIn ? 'flex' : 'none';
    document.getElementById('btnHeaderLogin').style.display = window.isLoggedIn ? 'none' : 'flex';
    document.getElementById('btnAddSong').style.display = window.isAdmin ? 'inline-block' : 'none';
    document.getElementById('btnDockAdminSync').style.display = window.isAdmin ? 'flex' : 'none';

    document.getElementById('sidebarAdminSection').style.display = window.isAdmin ? 'block' : 'none';
    document.getElementById('sidebarAdminDivider').style.display = window.isAdmin ? 'block' : 'none';

    // re-render whatever is currently visible so admin-only buttons appear/disappear immediately
    if (document.getElementById('view-library').classList.contains('active') && window.renderSongList) window.renderSongList();
    if (window.currentSongId && window.renderTimestampEditor) window.renderTimestampEditor();

    await initializeSingerColors(db);
    fetchSongs();
});

window.wm.showView('home');
