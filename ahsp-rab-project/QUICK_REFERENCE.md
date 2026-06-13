# QUICK REFERENCE — Koneksi Firebase AHSP RAB Studio

**📌 Untuk Pemula: Baca file ini dulu!**

---

## Checklist Setup (Waktu: ~20 menit)

- [ ] **Langkah 1:** Buat akun Google (jika belum)
- [ ] **Langkah 2:** Buka console.firebase.google.com → Create Project
- [ ] **Langkah 3:** Register Web App (ikon `</>`) → Copy config
- [ ] **Langkah 4:** Buka `.env.local` → Isi 6 baris config Firebase
- [ ] **Langkah 5:** Firestore Database → Create → Region Jakarta, Mode Test
- [ ] **Langkah 6:** `npm install` di terminal
- [ ] **Langkah 7:** `npm run dev` → Buka http://localhost:5173
- [ ] **Langkah 8:** F12 (Console) → Cek tidak ada error merah
- [ ] **Langkah 9:** Edit material → Lihat di Firebase Console → Firestore
- [ ] ✅ **Done!** Real-time sync bekerja

---

## 3 File Penting

| File | Fungsi |
|------|--------|
| **PANDUAN_KONEKSI_FIREBASE_LENGKAP.md** | 📖 Tutorial step-by-step dengan screenshot (BACA INI DULU) |
| **CONTOH_FIREBASE_INTEGRATION.jsx** | 💻 Kode contoh integrasi Firebase (copy-paste ke AhspRabStudio.jsx) |
| **src/firebase.js** | ⚙️ Helper functions Firebase (sudah siap pakai) |

---

## Step by Step Singkat

### ① Buat Proyek Firebase
```
https://console.firebase.google.com
→ Add Project → Isi nama → Create
```

### ② Daftarkan Web App & Copy Config
```
Dashboard → </> (Web App)
→ Copy blok firebaseConfig
→ Paste ke `.env.local`:

VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=...firebaseapp.com
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=....appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=1:...web:...
```

### ③ Aktifkan Firestore
```
Dashboard → Build → Firestore Database
→ Create Database
→ Test Mode (untuk development)
→ Region: asia-southeast2 (Jakarta)
→ Enable
```

### ④ Install & Run
```bash
npm install
npm run dev
```

### ⑤ Cek Koneksi
- Buka http://localhost:5173
- F12 → Console (tidak boleh ada error merah)
- Edit material → lihat di Firebase Console (Firestore Database tab)

---

## Integrasi Code (Detail)

File **`CONTOH_FIREBASE_INTEGRATION.jsx`** sudah berisi semua yang perlu di-copy.

**Ringkas:**
1. Tambah import Firebase di atas `AhspRabStudio.jsx`
2. Tambah `PROJECT_ID = 'proyek-001'`
3. Tambah 3x `useEffect` untuk subscribe (materials, templates, boq)
4. Update mutator functions untuk `await saveMaterial()`, `await saveTemplate()`, dll

**Pola semua mutator sama:**
```jsx
const updateMaterial = async (id, patch) => {
  // 1. Update UI lokal (instant)
  setMaterials(ms => ms.map(m => m.id === id ? {...m, ...patch} : m));
  
  // 2. Simpan ke Firebase (async)
  try {
    await saveMaterial(PROJECT_ID, {...material, ...patch});
    notify('✅ Tersimpan');
  } catch (err) {
    notify('❌ Gagal: ' + err.message);
  }
};
```

---

## Folder Struktur

```
ahsp-rab-project/
├── src/
│   ├── AhspRabStudio.jsx       ← Komponen utama (ini yang di-edit)
│   ├── firebase.js             ← Helper Firebase (jangan diubah)
│   └── main.jsx                ← Entry point
├── .env.local                  ← ISI INI DENGAN CONFIG FIREBASE
├── index.html
├── package.json
├── vite.config.js
├── README.md                   ← Info proyek
├── PANDUAN_KONEKSI_FIREBASE_LENGKAP.md  ← Tutorial lengkap (BACA INI)
├── CONTOH_FIREBASE_INTEGRATION.jsx      ← Copy kode dari sini
└── .gitignore
```

---

## Perintah Penting

```bash
# Install dependency
npm install

# Run dev server (port 5173)
npm run dev

# Build untuk production
npm run build

# Preview build hasil
npm run preview

# Deploy ke Firebase Hosting
firebase deploy

# Deploy ke Vercel (sudah include .env.local)
# (sign up di vercel.com, import repo GitHub, deploy)
```

---

## Troubleshooting

| Error | Solusi |
|-------|--------|
| `VITE_FIREBASE_API_KEY is undefined` | Pastikan `.env.local` sudah di-save. Restart `npm run dev`. |
| `Cannot find module 'firebase'` | `npm install firebase` |
| `Firestore permission denied` | Ganti rules menjadi: `allow read, write: if true;` (test mode) |
| Data tidak muncul di Firestore | Cek Console (F12). Pastikan `saveMaterial()` di-call. |
| Koneksi timeout | Cek internet. Test ping ke Firebase: `ping firebase.google.com` |

---

## Firebase Security Rules (Test Mode)

Di **Firebase Console → Firestore → Rules**, ganti dengan:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId}/{document=**} {
      allow read, write: if true;  // TEST MODE
    }
  }
}
```

⚠️ **Untuk production**, ganti `true` dengan:
```js
allow read, write: if request.auth != null 
  && resource.data.ownerId == request.auth.uid;
```

---

## Production Deployment

### Option 1: Firebase Hosting (Gratis tier ada)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting    # pilih dist sebagai public folder
npm run build
firebase deploy
```

Deploy selesai → Aplikasi live di:
```
https://[nama-proyek].firebaseapp.com
```

### Option 2: Vercel (Sangat mudah)

1. Push kode ke GitHub
2. Buka https://vercel.com
3. Import repo dari GitHub
4. Add environment variables (dari `.env.local`)
5. Deploy 🚀

---

## Penting Ingat

✅ **Jangan commit `.env.local` ke Git** (sudah di `.gitignore`)  
✅ **Harga/koefisien demo bersifat ilustratif** — verifikasi AHSP resmi sebelum penawaran  
✅ **Firestore "test mode" hanya untuk development** — gunakan security rules untuk production  
✅ **Untuk team collaboration:** tambahkan authentication (login/register)  

---

## Bantuan

1. **Baca** `PANDUAN_KONEKSI_FIREBASE_LENGKAP.md` → sangat detail
2. **Lihat contoh** di `CONTOH_FIREBASE_INTEGRATION.jsx` → copy-paste
3. **Screenshot error** → cek di F12 Console
4. **Firebase Console** → cek Firestore data, logs, dst

---

**Happy coding! 🚀**
