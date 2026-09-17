// ==========================================
// main.js - bootstrap
// ==========================================
import { auth, provider, signInWithPopup, signOut, onAuthStateChanged, db, ALLOWED_EMAILS } from './config.js';
import { fetchSongs } from './library.js';
import { initializeSingerColors } from './singerColors.js';

window.isLoggedIn = false;
window.isAdmin = false;

/* ---------- profile menu ---------- */
let profileMenuOpen = false;

function toggleProfileMenu(show) {
    const menu = document.getElementById('profileMenu');
    if (show === undefined) show = !profileMenuOpen;
    profileMenuOpen = show;
    menu.classList.toggle('open', show);
    if (show) document.addEventListener('click', onOutsideProfileClick, true);
    else      document.removeEventListener('click', onOutsideProfileClick, true);
}

function onOutsideProfileClick(e) {
    if (!document.getElementById('profileBar').contains(e.target) &&
        !document.getElementById('profileMenu').contains(e.target)) {
        toggleProfileMenu(false);
    }
}

function applyProfileUI(user) {
    const profileName   = document.getElementById('profileName');
    const profileEmail  = document.getElementById('profileEmail');
    const profileAvatar = document.getElementById('profileAvatar');
    const avatarIcon    = document.getElementById('profileAvatarIcon');
    const profileBar    = document.getElementById('profileBar');
    const adminTag      = document.getElementById('profileAdminTag');

    const menuName      = document.getElementById('profileMenuName');
    const menuEmail     = document.getElementById('profileMenuEmail');
    const menuAvatar    = document.getElementById('profileMenuAvatar');
    const menuAvatarIcon= document.getElementById('profileMenuAvatarIcon');

    if (user) {
        const name  = user.displayName || (user.email ? user.email.split('@')[0] : 'ผู้ใช้');
        const email = user.email || '';

        profileName.textContent  = name;
        profileEmail.textContent = email;
        if (user.photoURL) {
            profileAvatar.style.backgroundImage = `url('${user.photoURL}')`;
            avatarIcon.style.display = 'none';
        } else { avatarIcon.style.display = ''; }
        adminTag.style.display = ALLOWED_EMAILS.includes(user.email) ? 'inline-block' : 'none';
        profileBar.title = 'บัญชี Google';

        menuName.textContent  = name;
        menuEmail.textContent = email;
        if (user.photoURL) {
            menuAvatar.style.backgroundImage = `url('${user.photoURL}')`;
            menuAvatarIcon.style.display = 'none';
        } else { menuAvatarIcon.style.display = ''; }
    } else {
        profileName.textContent  = 'เข้าสู่ระบบ';
        profileEmail.textContent = 'ใช้บัญชี Google';
        profileAvatar.style.backgroundImage = '';
        avatarIcon.style.display = '';
        adminTag.style.display = 'none';
        profileBar.title = 'เข้าสู่ระบบ';
        menuName.textContent  = '-';
        menuEmail.textContent = '';
        menuAvatar.style.backgroundImage = '';
        menuAvatarIcon.style.display = '';
        toggleProfileMenu(false);
    }
}

window.handleProfileClick = function() {
    if (!window.isLoggedIn) { window.loginWithGoogle(); return; }
    toggleProfileMenu();
};

window.loginWithGoogle = async function() {
    try { await signInWithPopup(auth, provider); } catch (e) { alert("เข้าสู่ระบบไม่สำเร็จ"); }
};

window.logout = async function() {
    if (confirm('ต้องการออกจากระบบใช่หรือไม่?')) {
        toggleProfileMenu(false);
        await signOut(auth);
    }
};

/* ---------- auth state ---------- */
onAuthStateChanged(auth, async (user) => {
    window.isLoggedIn = !!user;
    window.isAdmin = user && ALLOWED_EMAILS.includes(user.email);
    window.currentUser = user || null;

    applyProfileUI(user);

    document.getElementById('btnHeaderLogin').style.display = window.isLoggedIn ? 'none' : 'flex';
    document.getElementById('btnAddSong').style.display = window.isAdmin ? 'inline-block' : 'none';
    document.getElementById('btnDockAdminSync').style.display = window.isAdmin ? 'flex' : 'none';

    document.getElementById('sidebarAdminSection').style.display = window.isAdmin ? 'block' : 'none';
    document.getElementById('sidebarAdminDivider').style.display = window.isAdmin ? 'block' : 'none';

    if (window.loadUserData) await window.loadUserData();
    if (window.loadStats) await window.loadStats();
    if (window.loadGlobalViews) window.loadGlobalViews();   // โหลดวิวรวมสาธารณะทั้งเว็บ

    if (document.getElementById('view-library').classList.contains('active') && window.renderSongList) window.renderSongList();
    if (window.currentSongId && window.renderTimestampEditor) window.renderTimestampEditor();

    await initializeSingerColors(db);
    fetchSongs();
});

window.wm.showView('home');
