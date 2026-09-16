// ==========================================
// main.js - bootstrap
// ==========================================
import { auth, provider, signInWithPopup, signOut, onAuthStateChanged, db, ALLOWED_EMAILS } from './config.js';
import { fetchSongs } from './library.js';
import { initializeSingerColors } from './singerColors.js';

window.isLoggedIn = false;
window.isAdmin = false;

function applyProfileUI(user) {
    const profileName   = document.getElementById('profileName');
    const profileEmail  = document.getElementById('profileEmail');
    const profileAvatar = document.getElementById('profileAvatar');
    const avatarIcon    = document.getElementById('profileAvatarIcon');
    const profileBar    = document.getElementById('profileBar');
    const adminTag      = document.getElementById('profileAdminTag');

    if (user) {
        profileName.textContent  = user.displayName || (user.email ? user.email.split('@')[0] : 'ผู้ใช้');
        profileEmail.textContent = user.email || '';
        if (user.photoURL) {
            profileAvatar.style.backgroundImage = `url('${user.photoURL}')`;
            avatarIcon.style.display = 'none';
        } else {
            avatarIcon.style.display = '';
        }
        adminTag.style.display = ALLOWED_EMAILS.includes(user.email) ? 'inline-block' : 'none';
        profileBar.title = 'บัญชี Google';
    } else {
        profileName.textContent  = 'เข้าสู่ระบบ';
        profileEmail.textContent = 'ใช้บัญชี Google';
        profileAvatar.style.backgroundImage = '';
        avatarIcon.style.display = '';
        adminTag.style.display = 'none';
        profileBar.title = 'เข้าสู่ระบบ';
    }
}

window.handleProfileClick = function() {
    if (!window.isLoggedIn) window.loginWithGoogle();
};

window.loginWithGoogle = async function() {
    try { await signInWithPopup(auth, provider); } catch (e) { alert("เข้าสู่ระบบไม่สำเร็จ"); }
};

window.logout = async function() {
    if (confirm('ต้องการออกจากระบบใช่หรือไม่?')) { await signOut(auth); }
};

onAuthStateChanged(auth, async (user) => {
    window.isLoggedIn = !!user;
    window.isAdmin = user && ALLOWED_EMAILS.includes(user.email);
    window.currentUser = user || null;

    applyProfileUI(user);

    document.getElementById('btnHeaderLogout').style.display = window.isLoggedIn ? 'flex' : 'none';
    document.getElementById('btnHeaderLogin').style.display = window.isLoggedIn ? 'none' : 'flex';
    document.getElementById('btnAddSong').style.display = window.isAdmin ? 'inline-block' : 'none';
    document.getElementById('btnDockAdminSync').style.display = window.isAdmin ? 'flex' : 'none';

    document.getElementById('sidebarAdminSection').style.display = window.isAdmin ? 'block' : 'none';
    document.getElementById('sidebarAdminDivider').style.display = window.isAdmin ? 'block' : 'none';

    if (window.loadUserData) await window.loadUserData();

    if (document.getElementById('view-library').classList.contains('active') && window.renderSongList) window.renderSongList();
    if (window.currentSongId && window.renderTimestampEditor) window.renderTimestampEditor();

    await initializeSingerColors(db);
    fetchSongs();
});

window.wm.showView('home');
