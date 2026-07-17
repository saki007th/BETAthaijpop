// firebase.js
// จัดการการเชื่อมต่อ Firebase (Auth & Firestore) แบบรวมศูนย์

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, deleteDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { AppState } from './state.js';
import { initializeSingerColors } from './singerColors.js';

// ค่า Config เปิดเผยได้สำหรับ Firebase Client SDK 
const firebaseConfig = {
    apiKey: "AIzaSyDV-gefPFqCmAvYmrSXeb5W1JUKf4Ev50Q",
    authDomain: "musix-syn.firebaseapp.com",
    projectId: "musix-syn",
    storageBucket: "musix-syn.firebasestorage.app",
    messagingSenderId: "154980084057",
    appId: "1:154980084057:web:e0af2ed833cb127f3b8448",
    measurementId: "G-2NCK3PQEFV"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const songsCollection = collection(db, 'songs');

// ⚠️ การเช็คผ่าน Front-end (แค่ซ่อน/แสดงปุ่ม UI) 
// โปรดใช้ Firestore Security Rules หรือ Custom Claims ร่วมด้วยบน Backend เพื่อความปลอดภัยที่แท้จริง
const ALLOWED_EMAILS = ["sashikiwa@gmail.com", "panupong.bb27115@gmail.com"];

export function initFirebaseAuth(onStateChangeCallback) {
    onAuthStateChanged(auth, async (user) => {  
        AppState.isLoggedIn = !!user;
        AppState.isAdmin = user && ALLOWED_EMAILS.includes(user.email);
        
        // อัปเดตสีนักร้องก่อน
        await initializeSingerColors(db);
        
        // ส่งต่อให้ UI รับทราบว่า State เปลี่ยน
        if (onStateChangeCallback) onStateChangeCallback();
    });
}

export async function loginWithGoogle() { 
    try { 
        await signInWithPopup(auth, provider); 
    } catch (e) { 
        alert("เข้าสู่ระบบไม่สำเร็จ: " + e.message); 
    } 
}

export async function logout() { 
    if(confirm('ต้องการออกจากระบบใช่หรือไม่?')) { 
        await signOut(auth); 
    } 
}

export async function fetchSongs() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    
    try {
        const querySnapshot = await getDocs(songsCollection);
        const songsList = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            songsList.push({ 
                id: doc.id, 
                title: data.title, 
                artist: data.artist, 
                audioPath: data.audioPath, 
                lyrics: data.lyrics, 
                timestamps: data.timestamps || [], 
                singers: data.singers || [], 
                covers: data.covers || [],
                createdAt: data.createdAt 
            });
        });
        
        // อัปเดต State
        AppState.setSongs(songsList);
        return true;
    } catch (error) { 
        console.error("Error fetching songs: ", error); 
        return false;
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

export async function saveSongToDB(songData, editingSongId = null) {
    if (!AppState.isAdmin) return false;
    
    try {
        if (editingSongId) { 
            await updateDoc(doc(db, "songs", editingSongId), songData); 
        } else { 
            songData.createdAt = Date.now();
            await addDoc(songsCollection, songData); 
        }
        return true;
    } catch (e) { 
        console.error("Error saving song:", e);
        return false; 
    }
}

export async function updateTimestampsInDB(updateLyricsText = false) {
    if (!AppState.isAdmin || !AppState.currentSongId) return false;
    
    const song = AppState.getSong(AppState.currentSongId);
    if (!song) return false;

    if (updateLyricsText) song.lyrics = AppState.currentLyricsArray.join('\n\n');
    const count = AppState.currentLyricsArray.length;
    
    let isCover = (AppState.currentCoverIndex >= 0 && song.covers && song.covers[AppState.currentCoverIndex]);

    // เติม Array ให้เต็มตามจำนวนบรรทัดเนื้อเพลง
    if (isCover) {
        if (!song.covers[AppState.currentCoverIndex].timestamps) song.covers[AppState.currentCoverIndex].timestamps = [...(song.timestamps || [])];
        if (!song.covers[AppState.currentCoverIndex].singers) song.covers[AppState.currentCoverIndex].singers = [...(song.singers || [])];
    }

    let currentTs = isCover ? song.covers[AppState.currentCoverIndex].timestamps : (song.timestamps || []);
    let currentSg = isCover ? song.covers[AppState.currentCoverIndex].singers : (song.singers || []);

    const safeTs = Array.from({length: count}, (_, i) => currentTs[i] != null ? currentTs[i] : null);
    const safeSg = Array.from({length: count}, (_, i) => currentSg[i] != null ? currentSg[i] : "");

    const payload = {};
    if (updateLyricsText) payload.lyrics = song.lyrics; 

    if (isCover) {
        song.covers[AppState.currentCoverIndex].timestamps = safeTs;
        song.covers[AppState.currentCoverIndex].singers = safeSg;
        payload.covers = song.covers;
    } else {
        song.timestamps = safeTs; 
        song.singers = safeSg;
        payload.timestamps = safeTs; 
        payload.singers = safeSg;
    }

    try {
        await updateDoc(doc(db, "songs", AppState.currentSongId), payload);
        return true;
    } catch (error) {
        console.error("Error updating timestamps:", error);
        return false;
    }
}

export async function deleteSongFromDB(id) {
    if (!AppState.isAdmin) return false;
    try { 
        await deleteDoc(doc(db, "songs", id)); 
        return true;
    } catch(e) { 
        console.error("Error deleting song:", e); 
        return false;
    }
}
