# Tutorial: Menghubungkan AHSP RAB Studio ke Firebase

## Prasyarat
- Node.js 18+ sudah terinstall
- Akun Google (untuk Firebase Console)

---

## Langkah 1 — Buat Proyek Firebase

1. Buka **https://console.firebase.google.com**
2. Klik **"Add project"** → beri nama (misal: `ahsp-rab-studio`) → Next
3. Google Analytics boleh dimatikan → **Create project**

---

## Langkah 2 — Daftarkan Web App & Salin Config

1. Di dashboard proyek, klik ikon **`</>`** (Web)
2. Isi nama app (misal: `rab-web`) → **Register app**
3. Salin blok `firebaseConfig` yang muncul, contoh:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "ahsp-rab.firebaseapp.com",
     projectId: "ahsp-rab",
     storageBucket: "ahsp-rab.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123...:web:abc..."
   };
   ```
4. Paste nilai-nilai tersebut ke file **`.env.local`** di root proyek

---

## Langkah 3 — Aktifkan Firestore Database

1. Menu kiri → **Build → Firestore Database**
2. Klik **"Create database"**
3. Pilih **"Start in test mode"** (untuk development) → pilih region `asia-southeast2 (Jakarta)` → **Enable**

---

## Langkah 4 — (Opsional) Aktifkan Authentication

1. Menu kiri → **Build → Authentication**
2. Klik **"Get started"** → tab **"Sign-in method"**
3. Aktifkan **Email/Password** → Save

---

## Langkah 5 — Install & Jalankan

```bash
# Masuk ke folder proyek
cd ahsp-rab-project

# Install dependensi
npm install

# Jalankan dev server
npm run dev
```

Buka browser → `http://localhost:5173`

---

## Langkah 6 — Sambungkan State ke Firebase

File **`src/firebase.js`** sudah menyediakan semua helper function.
Cara menggunakannya di `AhspRabStudio.jsx`:

### A. Real-time Listener (otomatis sync ke semua user)

Ganti `useState(SEED_MATERIALS)` dengan `useEffect` + `subscribeMaterials`:

```jsx
// Di dalam AhspRabStudio(), tambahkan:
import { subscribeMaterials, saveMaterial, deleteMaterial } from './firebase.js';

const PROJECT_ID = 'proyek-001'; // atau dari auth user

useEffect(() => {
  // onSnapshot → otomatis update state saat data Firestore berubah
  const unsub = subscribeMaterials(PROJECT_ID, (data) => {
    setMaterials(data);
  });
  return () => unsub(); // cleanup saat komponen unmount
}, []);
```

### B. Simpan Material saat Diedit

```jsx
// Ganti fungsi updateMaterial menjadi:
const updateMaterial = async (id, patch) => {
  setMaterials(ms => ms.map(m => m.id === id ? { ...m, ...patch } : m)); // optimistic update
  const material = materials.find(m => m.id === id);
  await saveMaterial(PROJECT_ID, { ...material, ...patch }); // sync ke Firestore
};
```

### C. Pola yang Sama untuk Templates & BoQ

```jsx
// Templates
const unsub2 = subscribeTemplates(PROJECT_ID, setTemplates);

// BoQ
const unsub3 = subscribeBoq(PROJECT_ID, setBoq);
```

---

## Struktur Data di Firestore

```
projects/
  └── proyek-001/
        ├── name: "Rumah Tinggal 2 Lantai — Yogyakarta"
        ├── zoneId: "diy"
        ├── opGlobal: 10
        ├── ppn: 11
        ├── materials/
        │     ├── M01: { code, name, unit, type, basePrice }
        │     └── M02: { ... }
        ├── templates/
        │     └── A01: { code, name, unit, source, components: [...] }
        └── boq/
              └── B01: { category, ahspId, volume, op }
```

---

## Aturan Keamanan Firestore (Firestore Rules)

Ganti rules default di **Console → Firestore → Rules**:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Hanya user yang login bisa akses proyeknya sendiri
    match /projects/{projectId}/{document=**} {
      allow read, write: if request.auth != null
        && resource.data.ownerId == request.auth.uid;
    }
  }
}
```

---

## Build untuk Production

```bash
npm run build
# Output di folder /dist — upload ke Firebase Hosting atau Vercel
```

Untuk Firebase Hosting:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # pilih dist sebagai public folder
firebase deploy
```

---

## Catatan Penting

- File `.env.local` **jangan di-commit ke Git** (sudah ada di `.gitignore`)
- Harga & koefisien pada seed data bersifat **ilustratif** — verifikasi dengan
  AHSP resmi (Permen PUPR No. 1/2022) sebelum dipakai untuk penawaran nyata
- Untuk produksi, ganti Firestore rules ke mode ketat (hapus "test mode")
