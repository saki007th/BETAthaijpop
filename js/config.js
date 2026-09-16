// ==========================================
// config.js - Firebase init, shared across modules
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, deleteDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const ALLOWED_EMAILS = ["sashikiwa@gmail.com", "panupong.bb27115@gmail.com"];

const firebaseConfig = {
    apiKey: "AIzaSyDV-gefPFqCmAvYmrSXeb5W1JUKf4Ev50Q",
    authDomain: "musix-syn.firebaseapp.com",
    projectId: "musix-syn",
    storageBucket: "musix-syn.firebasestorage.app",
    messagingSenderId: "154980084057",
    appId: "1:154980084057:web:e0af2ed833cb127f3b8448",
    measurementId: "G-2NCK3PQEFV"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const songsCollection = collection(db, 'songs');

export {
    getFirestore, collection, getDocs, addDoc, updateDoc, doc, deleteDoc, setDoc, getDoc,
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
};

// kept on window for backward-compatible access (singerColors.js sidebar button, console debugging)
window.db = db;
window.setDoc = setDoc;
window.getDoc = getDoc;
