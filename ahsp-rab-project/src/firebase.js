// ─────────────────────────────────────────────────────────────────────────────
// src/firebase.js — Konfigurasi & helper Firebase untuk AHSP RAB Studio
//
// LANGKAH SETUP:
// 1. Buka https://console.firebase.google.com → Buat proyek baru
// 2. Tambah Web App (ikon </>) → salin firebaseConfig di bawah
// 3. Aktifkan Firestore Database (mode "test" dulu untuk development)
// 4. (Opsional) Aktifkan Authentication → Email/Password
// 5. Ganti nilai VITE_FIREBASE_* di file .env.local
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc, collection,
  getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// ── 1. Konfigurasi (isi dari Firebase Console → Project Settings) ──────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// ─────────────────────────────────────────────────────────────────────────────
// ── 2. STRUKTUR KOLEKSI FIRESTORE ────────────────────────────────────────────
//
//  projects/{projectId}
//    ├── name, zoneId, opGlobal, ppn, ownerId, createdAt, updatedAt
//    ├── materials/{materialId}   ← sub-koleksi
//    ├── templates/{templateId}   ← sub-koleksi
//    │     └── components[]      ← array di dalam dokumen template
//    └── boq/{boqItemId}         ← sub-koleksi
//
// ─────────────────────────────────────────────────────────────────────────────

// ── 3. HELPER FUNGSI — bisa dipanggil dari komponen atau Context ──────────

/** Ambil semua proyek milik user (gunakan auth.currentUser.uid sebagai ownerId) */
export async function getProjects(ownerId) {
  const q = query(collection(db, 'projects'), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.ownerId === ownerId);
}

/** Buat / update meta proyek */
export async function saveProject(projectId, data) {
  await setDoc(doc(db, 'projects', projectId), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Materials ────────────────────────────────────────────────────────────────

/** Real-time listener untuk material — otomatis sinkron saat data berubah */
export function subscribeMaterials(projectId, onChange) {
  const ref = collection(db, 'projects', projectId, 'materials');
  return onSnapshot(ref, snap => {
    onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function saveMaterial(projectId, material) {
  const { id, ...data } = material;
  await setDoc(doc(db, 'projects', projectId, 'materials', id), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function deleteMaterial(projectId, materialId) {
  await deleteDoc(doc(db, 'projects', projectId, 'materials', materialId));
}

// ── AHSP Templates ───────────────────────────────────────────────────────────

export function subscribeTemplates(projectId, onChange) {
  const ref = collection(db, 'projects', projectId, 'templates');
  return onSnapshot(ref, snap => {
    onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function saveTemplate(projectId, template) {
  const { id, ...data } = template;
  await setDoc(doc(db, 'projects', projectId, 'templates', id), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function deleteTemplate(projectId, templateId) {
  await deleteDoc(doc(db, 'projects', projectId, 'templates', templateId));
}

// ── BoQ Items ────────────────────────────────────────────────────────────────

export function subscribeBoq(projectId, onChange) {
  const ref = collection(db, 'projects', projectId, 'boq');
  return onSnapshot(ref, snap => {
    onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function saveBoqItem(projectId, item) {
  const { id, ...data } = item;
  await setDoc(doc(db, 'projects', projectId, 'boq', id), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function deleteBoqItem(projectId, itemId) {
  await deleteDoc(doc(db, 'projects', projectId, 'boq', itemId));
}
