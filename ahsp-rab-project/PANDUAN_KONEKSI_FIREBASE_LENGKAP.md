# Panduan Koneksi Firebase untuk AHSP RAB Studio — LENGKAP (Pemula)

**Durasi:** ~20 menit | **Kesulitan:** ⭐ (sangat mudah)

---

## Daftar Isi
1. [Persiapan Awal](#persiapan-awal)
2. [Buat Proyek Firebase](#buat-proyek-firebase)
3. [Ambil Config & Isi .env.local](#ambil-config--isi-envlocal)
4. [Aktifkan Firestore Database](#aktifkan-firestore-database)
5. [Test Koneksi Lokal](#test-koneksi-lokal)
6. [Pahami Struktur Data](#pahami-struktur-data)
7. [Sambungkan Kode ke Firebase](#sambungkan-kode-ke-firebase)
8. [Deploy ke Production](#deploy-ke-production)

---

## Persiapan Awal

Pastikan sudah ada di komputer:
- ✅ **Node.js 18+** (cek: buka Command Prompt, ketik `node -v` → harus v18 ke atas)
- ✅ **Git** (opsional, tapi berguna)
- ✅ **Akun Google** (untuk buat Firebase project)
- ✅ **Visual Studio Code** (editor, atau text editor lain)
- ✅ **Folder proyek sudah extract** (dari ZIP `ahsp-rab-studio.zip`)

### Cek Node.js

Buka **Command Prompt** atau **PowerShell**:
```bash
node -v
npm -v
```

Harus muncul nomor versi (minimal v18.0.0). Kalau belum ada, download di https://nodejs.org

---

## Buat Proyek Firebase

### Langkah 1️⃣ — Buka Firebase Console

1. Buka browser → https://console.firebase.google.com
2. Login dengan **akun Google** kamu
3. Klik tombol **"Add project"** (biru, di tengah layar)

### Langkah 2️⃣ — Isi Nama Proyek

**Jendela pertama: "Project name"**
- Isi nama proyek (misal: `AHSP RAB 2024` atau `ahsp-tools`)
- Contoh nama yang bagus: `ahsp-rab-yogyakarta`
- Klik **Next**

**Jendela kedua: "Enable Google Analytics"**
- Centang/uncek sesuai keinginan (untuk pembelajaran, boleh tidak ada)
- Klik **Create project**

**Tunggu ~1 menit**, sampai layar berubah ke dashboard proyek.

---

## Ambil Config & Isi .env.local

### Langkah 3️⃣ — Daftarkan Web App

Setelah proyek berhasil dibuat, dashboard menampilkan:

```
Welcome to Firebase

Selamat datang di [nama-proyek]!
```

Cari dan klik tombol **`</>`** (icon di samping 🤖 Android icon)

Layar baru terbuka: **"Add Firebase to your web app"**

### Langkah 4️⃣ — Copy Firebase Config

Di jendela tersebut, akan ada blok kode seperti ini:

```js
const firebaseConfig = {
  apiKey: "AIzaSyAi4wTWgU85V0wrex-4wn-k18CfZEi9pbU",
  authDomain: "ahsp-tools.firebaseapp.com",
  projectId: "ahsp-tools",
  storageBucket: "ahsp-tools.firebasestorage.app",
  messagingSenderId: "72783604275",
  appId: "1:72783604275:web:4d9d728e38b9e6a9407a46"
};
```

**Salin masing-masing nilai:**

| Field | Nilai dari Console | Contoh |
|-------|-------------------|--------|
| `apiKey` | Copy dari console | `AIzaSyAi4wTWgU85V0wrex...` |
| `authDomain` | Copy dari console | `ahsp-tools.firebaseapp.com` |
| `projectId` | Copy dari console | `ahsp-tools` |
| `storageBucket` | Copy dari console | `ahsp-tools.firebasestorage.app` |
| `messagingSenderId` | Copy dari console | `72783604275` |
| `appId` | Copy dari console | `1:72783604275:web:4d9d...` |

### Langkah 5️⃣ — Buka File .env.local

Buka folder proyek dengan **Visual Studio Code**:
1. Buka VS Code
2. **File → Open Folder** → pilih folder `ahsp-rab-project`
3. Di panel kiri, cari file **`.env.local`**
4. Klik file tersebut → tampil di editor

Isi file saat ini:
```env
VITE_FIREBASE_API_KEY=AIza...isi-dari-console...
VITE_FIREBASE_AUTH_DOMAIN=nama-proyek.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=nama-proyek
VITE_FIREBASE_STORAGE_BUCKET=nama-proyek.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### Langkah 6️⃣ — Ganti dengan Value Firebase Kamu

**Hapus semua** isi `.env.local` dan ganti dengan nilai kamu. Contoh lengkap:

```env
VITE_FIREBASE_API_KEY=AIzaSyAi4wTWgU85V0wrex-4wn-k18CfZEi9pbU
VITE_FIREBASE_AUTH_DOMAIN=ahsp-tools.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ahsp-tools
VITE_FIREBASE_STORAGE_BUCKET=ahsp-tools.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=72783604275
VITE_FIREBASE_APP_ID=1:72783604275:web:4d9d728e38b9e6a9407a46
```

**Simpan** (Ctrl+S)

---

## Aktifkan Firestore Database

### Langkah 7️⃣ — Buka Firestore

Kembali ke browser Firebase Console:

1. Di menu kiri, cari **Build** → klik **Firestore Database**
2. Akan muncul tombol **"Create database"** (biru besar)
3. Klik tombol tersebut

### Langkah 8️⃣ — Pilih Region & Mode

**Jendela 1: Pilih lokasi (Region)**
- Dropdown menampilkan berbagai region
- **Pilih: `asia-southeast2 (Jakarta)`** (terdekat dengan Indonesia)
- Klik **Next**

**Jendela 2: Pilih mode keamanan**
- Ada 2 pilihan:
  - ❌ **Production mode** (kuat, tapi kompleks)
  - ✅ **Test mode** (mudah, cocok untuk development)
- **Pilih: Test mode** (untuk sekarang)
- Klik **Enable**

**Tunggu ~30 detik.** Firestore sedang dibuat. Layar akan menjadi:

```
Cloud Firestore

Mulai dengan membuat koleksi pertama...
```

✅ **Firestore sudah aktif!**

---

## Test Koneksi Lokal

### Langkah 9️⃣ — Buka Terminal / Command Prompt

Di folder proyek, buka **Command Prompt** atau **Terminal**:

**Cara 1 (mudah):** 
- Di VS Code, tekan **Ctrl + ~** (atau menu View → Terminal)

**Cara 2:**
- Buka Command Prompt biasa, navigate ke folder proyek:
  ```bash
  cd C:\Users\YourName\path\to\ahsp-rab-project
  ```

### Langkah 🔟 — Install Dependencies

Di terminal, ketik:
```bash
npm install
```

Tunggu 1-2 menit. Akan melihat banyak baris teks. Sampai ada tulisan:

```
added XXX packages
```

✅ Selesai install.

### Langkah 1️⃣1️⃣ — Jalankan Dev Server

```bash
npm run dev
```

Akan muncul:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

✅ **Server jalan!**

### Langkah 1️⃣2️⃣ — Buka di Browser

Buka browser, masukkan URL:
```
http://localhost:5173
```

Harusnya muncul aplikasi **AHSP RAB Studio** dengan logo Building2 di atas.

**Bagus!** Koneksi Firebase sudah berjalan. Sekarang data masih lokal (belum tersimpan di Firestore).

---

## Pahami Struktur Data

Firestore menyimpan data dalam bentuk **koleksi dan dokumen**, seperti folder dan file:

```
📁 Firestore Database (root)
  └─ 📁 projects/  (koleksi)
       └─ 📄 proyek-001/  (dokumen)
            ├─ name: "Rumah Tinggal 2 Lantai — Yogyakarta"
            ├─ zoneId: "diy"
            ├─ opGlobal: 10
            ├─ ppn: 11
            ├─ ownerId: "user123"
            ├─ createdAt: timestamp
            ├─ updatedAt: timestamp
            │
            ├─ 📁 materials/  (sub-koleksi)
            │    ├─ 📄 M01 { code, name, unit, type, basePrice }
            │    ├─ 📄 M02 { ... }
            │    └─ 📄 M03 { ... }
            │
            ├─ 📁 templates/  (sub-koleksi)
            │    ├─ 📄 A01 { code, name, unit, source, components: [...] }
            │    └─ 📄 A02 { ... }
            │
            └─ 📁 boq/  (sub-koleksi)
                 ├─ 📄 B01 { category, ahspId, volume, op }
                 └─ 📄 B02 { ... }
```

**Istilah:**
- **Koleksi** = folder (tempat dokumen)
- **Dokumen** = file (data individual, punya ID unik)
- **Field** = properti di dalam dokumen (nama, harga, dll)

---

## Sambungkan Kode ke Firebase

Sekarang saatnya kode React kita **baca & tulis** ke Firestore secara real-time.

### Konsep: Real-time Listener

Ketika data di Firestore berubah (misalnya user lain mengubah material), aplikasi Anda otomatis update tanpa perlu refresh browser.

```
Browser A          Firebase Firestore          Browser B
  |                      |                        |
  +------ update material ------>                 |
                         |                        |
                         +---- push update ------>
                         |                    (auto update)
```

### Langkah 1️⃣3️⃣ — Edit AhspRabStudio.jsx (Bagian State)

Buka file **`src/AhspRabStudio.jsx`** di VS Code.

**Cari baris:**
```jsx
const [materials, setMaterials] = useState(SEED_MATERIALS);
```

**Ganti dengan:**
```jsx
// ── Firebase: Real-time listener untuk materials ──
const [materials, setMaterials] = useState(SEED_MATERIALS);
const PROJECT_ID = 'proyek-001'; // ID proyek, bisa hard-code dulu

useEffect(() => {
  // Import di awal file harus ada:
  // import { subscribeMaterials } from './firebase.js';
  
  const unsub = subscribeMaterials(PROJECT_ID, (data) => {
    if (data.length > 0) {
      // Kalau Firestore punya data, pakai itu
      setMaterials(data);
    } else {
      // Kalau Firestore kosong, pakai seed data lokal
      setMaterials(SEED_MATERIALS);
    }
  });
  
  return () => unsub(); // cleanup saat unmount
}, []);
```

### Langkah 1️⃣4️⃣ — Tambah Import di Atas File

Di bagian paling atas `AhspRabStudio.jsx`, cari baris:
```jsx
import React, { useState, useMemo, useEffect, useRef, createContext, useContext } from 'react';
```

**Tambahkan import Firebase setelah baris itu:**
```jsx
import {
  subscribeMaterials, saveM material, deleteMaterial,
  subscribeTemplates, saveTemplate, deleteTemplate,
  subscribeBoq, saveBoqItem, deleteBoqItem,
} from './firebase.js';
```

### Langkah 1️⃣5️⃣ — Update Fungsi Mutator

Ganti fungsi `updateMaterial` untuk simpan ke Firestore:

**Sebelum (hanya lokal):**
```jsx
const updateMaterial = (id, patch) => 
  setMaterials((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
```

**Sesudah (lokal + Firestore):**
```jsx
const updateMaterial = async (id, patch) => {
  // Optimistic update (langsung tampil di UI)
  setMaterials((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  
  // Simpan ke Firestore
  const material = materials.find((m) => m.id === id);
  try {
    await saveMaterial(PROJECT_ID, { ...material, ...patch });
  } catch (err) {
    console.error('Gagal update material:', err);
    notify('❌ Gagal simpan ke Firebase');
  }
};
```

**Sama juga untuk `addMaterial`, `removeMaterial`, dan semua fungsi lain yang mengubah data.**

---

## Deploy ke Production

Setelah lokal berhasil dan semua fungsi bekerja baik, saatnya upload ke internet.

### Opsi 1: Firebase Hosting (Recommended)

**Langkah A — Build project**
```bash
npm run build
```

Hasilnya folder `/dist` berisi file siap upload.

**Langkah B — Install Firebase CLI**
```bash
npm install -g firebase-tools
```

**Langkah C — Login & init**
```bash
firebase login
firebase init hosting
```

Saat `firebase init`, pilih:
- Project: `ahsp-tools` (proyek Firebase kamu)
- Public directory: `dist`
- Single page app: `Yes`

**Langkah D — Deploy**
```bash
firebase deploy
```

Selesai! Aplikasi kamu live di URL seperti:
```
https://ahsp-tools.firebaseapp.com
```

### Opsi 2: Vercel (Lebih Simple)

1. Buka https://vercel.com
2. Login dengan GitHub / Google
3. Import proyek dari GitHub
4. Environment variables: isi `.env.local` kamu
5. Deploy 🚀

Aplikasi langsung live tanpa perlu CLI.

---

## Cek Apakah Berhasil

Setelah semua langkah di atas:

✅ **Firestore Console menampilkan data** (lihat di Firebase Console → Firestore Database)

✅ **Aplikasi tidak ada error** (F12 → Console tab)

✅ **Bisa ubah material & muncul di Firestore**

✅ **Buka tab browser kedua → data sync otomatis**

---

## Troubleshooting

### ❌ Error: "Cannot find module 'firebase/app'"

**Solusi:**
```bash
npm install firebase
```

### ❌ Error: "VITE_FIREBASE_API_KEY is undefined"

**Solusi:**
- Pastikan file `.env.local` sudah di-save
- Restart dev server (`npm run dev`)
- Refresh browser

### ❌ Error: "Missing or insufficient permissions"

**Solusi:**
- Di Firebase Console → Firestore → Rules
- Ganti rules menjadi:
```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId}/{document=**} {
      allow read, write: if true;  // test mode
    }
  }
}
```
- (Untuk production, ganti `true` dengan auth check)

### ❌ Data tidak tersimpan di Firestore

**Solusi:**
- Buka Console (F12)
- Lihat error message apa
- Pastikan fungsi `saveMaterial()` dipanggil di `updateMaterial()`

---

## Ringkasan Checklist

- [ ] Node.js v18+ sudah terinstall
- [ ] Buat proyek Firebase di console.firebase.google.com
- [ ] Daftarkan Web App di Firebase
- [ ] Copy config ke `.env.local`
- [ ] Aktifkan Firestore Database (region Jakarta, mode test)
- [ ] `npm install`
- [ ] `npm run dev`
- [ ] Aplikasi buka di `http://localhost:5173` tanpa error
- [ ] Lihat Firestore Console, ada koleksi `projects`
- [ ] Edit material → cek Firestore update
- [ ] Siap deploy dengan `npm run build` + Firebase Hosting / Vercel

---

## Bantuan

Kalau ada yang tidak jelas:
1. Screenshot error message (F12 → Console)
2. Cek kembali file `.env.local` — pastikan tidak ada typo
3. Restart dev server (`npm run dev`)
4. Clear browser cache (Ctrl+Shift+Delete)

**Semoga berhasil! 🚀**
