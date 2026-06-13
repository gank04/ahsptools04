# AHSP RAB Studio

Aplikasi web untuk membuat **Rencana Anggaran Biaya (RAB)** dan **Analisis Harga Satuan Pekerjaan (AHSP)** 
dengan real-time calculation dan database Firebase.

## 🚀 Quick Start

### 1. Setup Environment
```bash
npm install
cp .env.local.example .env.local  # isi dengan Firebase config
```

### 2. Isi Firebase Config di `.env.local`
Lihat file `PANDUAN_KONEKSI_FIREBASE_LENGKAP.md` untuk petunjuk lengkap.

### 3. Dev Server
```bash
npm run dev
```
Buka `http://localhost:5173`

### 4. Build & Deploy
```bash
npm run build
firebase deploy  # atau Vercel
```

---

## 📚 File Penting

- **`src/AhspRabStudio.jsx`** — Komponen utama
- **`src/firebase.js`** — Setup & helper functions Firebase
- **`PANDUAN_KONEKSI_FIREBASE_LENGKAP.md`** — Tutorial step-by-step untuk pemula
- **`CONTOH_FIREBASE_INTEGRATION.jsx`** — Contoh kode integrasi Firebase ke komponen

---

## 🔥 Firebase Setup

1. Buka https://console.firebase.google.com
2. Buat proyek baru
3. Daftarkan Web App (ikon `</>`)
4. Copy config → paste ke `.env.local`
5. Aktifkan **Firestore Database** (region: Jakarta, mode: Test)

Lihat `PANDUAN_KONEKSI_FIREBASE_LENGKAP.md` untuk detailnya.

---

## 📖 Fitur Utama

✅ **Master Data** — Kelola material, harga, dan zona  
✅ **AHSP Builder** — Buat template pekerjaan dengan koefisien SNI  
✅ **RAB Dinamis** — Hitung real-time dengan slider O&P & PPN  
✅ **Export Excel** — Dengan formula hidup yang bisa diedit di Excel  
✅ **AI Import** — Impor material dari file Excel dengan pemetaan kolom otomatis  
✅ **RBAC** — Admin, Estimator, Client (read-only)  
✅ **Multi-zona** — Hitung indeks harga per lokasi (Jakarta, Yogyakarta, dll)  
✅ **Real-time Sync** — Perubahan data langsung sinkron ke Firestore  

---

## ⚠️ Disclaimer

Harga, indeks zona, dan koefisien pada demo ini **bersifat ilustratif**.  
Untuk penawaran nyata, verifikasi dengan dokumen AHSP resmi (Permen PUPR No. 1/2022 & SNI).

---

## 📧 Support

Pertanyaan atau bug report? Lihat `FIREBASE_TUTORIAL.md` atau `PANDUAN_KONEKSI_FIREBASE_LENGKAP.md`.
