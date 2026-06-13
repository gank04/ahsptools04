/* ════════════════════════════════════════════════════════════════════════════
   AHSP·RAB STUDIO — Core Dashboard (Single-File Demo Component)
   Analisis Harga Satuan Pekerjaan (AHSP) + RAB / Bill of Quantities
   Stack demo : React + Tailwind (core classes) + lucide-react + SheetJS (xlsx)
   ──────────────────────────────────────────────────────────────────────────
   CATATAN ARTIFACT: file ini sengaja ber-ekstensi .jsx agar PASTI dirender
   interaktif di Claude Artifacts. Seluruh kontrak tipe TypeScript disertakan
   sebagai JSDoc @typedef di bawah — konversi ke .tsx untuk produksi hanya
   perlu mengangkat typedef ini menjadi `interface`.
   ════════════════════════════════════════════════════════════════════════════

   ╔══════════════════════════════════════════════════════════════════════════╗
   ║ LANGKAH 1 — SKEMA DATABASE (PRISMA) : MULTI-USER (RBAC) + ZONASI HARGA   ║
   ╚══════════════════════════════════════════════════════════════════════════╝

   enum Role           { ADMIN  ESTIMATOR  CLIENT }
   enum ItemType       { BAHAN  UPAH  ALAT }
   enum TemplateSource { SNI    CUSTOM }

   model User {
     id          String   @id @default(cuid())
     email       String   @unique
     name        String
     role        Role     @default(ESTIMATOR)        // role global aplikasi
     memberships ProjectMember[]
     createdAt   DateTime @default(now())
   }

   model Zone {                                       // "Zonasi Harga / Multi-Wilayah"
     id          String   @id @default(cuid())
     code        String   @unique                     // ex: JKT, JTG, PPA
     name        String                               // ex: Jawa Tengah — Magelang
     priceIndex  Decimal  @default(1.0)               // indeks pengali regional
     projects    Project[]
     prices      MaterialZonePrice[]
   }

   model Project {
     id          String   @id @default(cuid())
     name        String
     zoneId      String                               // lokasi proyek → memicu harga zona
     zone        Zone     @relation(fields: [zoneId], references: [id])
     opDefault   Decimal  @default(10)                // O&P global proyek (%)
     ppnRate     Decimal  @default(11)                // PPN global proyek (%)
     members     ProjectMember[]
     boqItems    BoqItem[]
   }

   model ProjectMember {                              // RBAC granular per-proyek
     projectId   String
     userId      String
     role        Role                                 // role user DI DALAM proyek ini
     project     Project  @relation(fields: [projectId], references: [id])
     user        User     @relation(fields: [userId],   references: [id])
     @@id([projectId, userId])
   }

   model Material {                                   // material & upah kerja
     id          String   @id @default(cuid())
     code        String   @unique
     name        String
     unit        String                               // bh, kg, m³, OH, ...
     type        ItemType
     basePrice   Decimal                              // harga dasar (zona referensi)
     zonePrices  MaterialZonePrice[]
     ahspItems   AhspItem[]
   }

   model MaterialZonePrice {                          // override harga presisi per zona
     materialId  String
     zoneId      String
     price       Decimal
     @@unique([materialId, zoneId])
     // RESOLUSI HARGA: price override ?? (material.basePrice × zone.index)
   }

   model AhspTemplate {
     id          String   @id @default(cuid())
     code        String                               // ex: A.4.4.1.9
     ref         String                               // ex: SNI 6897:2008
     name        String
     unit        String                               // satuan analisis (m², m³, kg)
     source      TemplateSource @default(SNI)
     isLocked    Boolean  @default(true)              // SNI = terkunci (compliance)
     items       AhspItem[]
     boqItems    BoqItem[]
   }

   model AhspItem {                                   // koefisien penyusun AHSP
     id          String   @id @default(cuid())
     templateId  String
     materialId  String
     coefficient Decimal  @db.Decimal(14, 6)
   }

   model BoqItem {                                    // baris RAB / BoQ
     id             String  @id @default(cuid())
     projectId      String
     category       String                            // ex: PEKERJAAN ARSITEKTUR
     ahspTemplateId String
     volume         Decimal
     opOverride     Decimal?                          // null → pakai project.opDefault
     sortOrder      Int     @default(0)
   }

   MATRIKS RBAC (ditegakkan di service layer + middleware):
   ┌────────────────────────────┬───────┬───────────┬────────┐
   │ Kemampuan                  │ ADMIN │ ESTIMATOR │ CLIENT │
   ├────────────────────────────┼───────┼───────────┼────────┤
   │ Kelola user, zona, indeks  │   ✔   │     —     │   —    │
   │ CRUD material & harga      │   ✔   │     ✔     │   —    │
   │ CRUD AHSP custom           │   ✔   │     ✔     │   —    │
   │ Edit koefisien SNI         │   —   │     —     │   —    │  ← terkunci utk semua
   │ CRUD BoQ, O&P, PPN         │   ✔   │     ✔     │   —    │
   │ Lihat & ekspor Excel       │   ✔   │     ✔     │   ✔    │
   └────────────────────────────┴───────┴───────────┴────────┘
   ════════════════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo, useEffect, useRef, createContext, useContext } from 'react';
import * as XLSX from 'xlsx';
import {
  Database, Hammer, FileSpreadsheet, MapPin, Upload, Plus, Trash2, Lock, Copy,
  Search, Wand2, X, Building2, Percent, Sigma, ShieldCheck, FileDown,
  CheckCircle2, Pencil, Layers, Sparkles, ChevronRight,
} from 'lucide-react';

/* ── Kontrak tipe (TypeScript-ready via JSDoc) ─────────────────────────── */
/** @typedef {'ADMIN'|'ESTIMATOR'|'CLIENT'} Role */
/** @typedef {{id:string, code:string, name:string, unit:string, type:'BAHAN'|'UPAH', basePrice:number}} Material */
/** @typedef {{key:string, materialId:string, coef:number|string}} AhspComponent */
/** @typedef {{id:string, code:string, ref:string, name:string, unit:string, source:'SNI'|'CUSTOM', components:AhspComponent[]}} AhspTemplate */
/** @typedef {{id:string, category:string, ahspId:string, volume:number, op:number|null}} BoqItem */

/* ── Utilitas format & id ─────────────────────────────────────────────────── */
const fmtIDR = (n) => 'Rp. ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const fmtNum = (n, d = 2) => (Number(n) || 0).toLocaleString('id-ID', { maximumFractionDigits: d });
const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
const hspOf = (jumlah, opPct) => Math.round(jumlah * (1 + (Number(opPct) || 0) / 100));

/* ── Data seed: zona, material/upah, template AHSP (referensi SNI), BoQ ─────
   Harga & indeks bersifat ILUSTRATIF. Koefisien mengikuti referensi umum
   AHSP SNI (SNI 6897/2837/7394:2008, Permen PUPR) — verifikasi dengan
   dokumen resmi sebelum dipakai untuk penawaran nyata.                       */

const ZONES = [
  { id: 'jkt', name: 'DKI Jakarta',            index: 1.0  },
  { id: 'jbr', name: 'Jawa Barat — Bandung',   index: 0.96 },
  { id: 'jtg', name: 'Jawa Tengah — Magelang', index: 0.89 },
  { id: 'diy', name: 'D.I. Yogyakarta',        index: 0.91 },
  { id: 'jtm', name: 'Jawa Timur — Surabaya',  index: 0.93 },
  { id: 'bli', name: 'Bali — Denpasar',        index: 1.06 },
  { id: 'ppa', name: 'Papua — Jayapura',       index: 1.48 },
];

const SEED_MATERIALS = [
  { id: 'M01', code: 'BHN.001', name: 'Bata merah kelas I (5×11×22 cm)', unit: 'bh', type: 'BAHAN', basePrice: 950 },
  { id: 'M02', code: 'BHN.002', name: 'Semen Portland (PC)',             unit: 'kg', type: 'BAHAN', basePrice: 1650 },
  { id: 'M03', code: 'BHN.003', name: 'Pasir pasang',                    unit: 'm³', type: 'BAHAN', basePrice: 285000 },
  { id: 'M04', code: 'BHN.004', name: 'Pasir beton',                     unit: 'm³', type: 'BAHAN', basePrice: 365000 },
  { id: 'M05', code: 'BHN.005', name: 'Kerikil / split 2–3 cm',          unit: 'm³', type: 'BAHAN', basePrice: 425000 },
  { id: 'M06', code: 'BHN.006', name: 'Air kerja',                       unit: 'L',  type: 'BAHAN', basePrice: 35 },
  { id: 'M07', code: 'BHN.007', name: 'Besi beton polos (BjTP-280)',     unit: 'kg', type: 'BAHAN', basePrice: 13800 },
  { id: 'M08', code: 'BHN.008', name: 'Kawat beton (bendrat)',           unit: 'kg', type: 'BAHAN', basePrice: 25500 },
  { id: 'L01', code: 'UPH.001', name: 'Pekerja',                         unit: 'OH', type: 'UPAH',  basePrice: 120000 },
  { id: 'L02', code: 'UPH.002', name: 'Tukang batu',                     unit: 'OH', type: 'UPAH',  basePrice: 155000 },
  { id: 'L03', code: 'UPH.003', name: 'Tukang besi',                     unit: 'OH', type: 'UPAH',  basePrice: 150000 },
  { id: 'L04', code: 'UPH.004', name: 'Kepala tukang',                   unit: 'OH', type: 'UPAH',  basePrice: 175000 },
  { id: 'L05', code: 'UPH.005', name: 'Mandor',                          unit: 'OH', type: 'UPAH',  basePrice: 185000 },
];

const SEED_TEMPLATES = [
  {
    id: 'A01', code: 'A.4.4.1.9', ref: 'SNI 6897:2008', source: 'SNI', unit: 'm²',
    name: 'Pemasangan 1 m² dinding bata merah ½ bata, campuran 1 PC : 4 PP',
    components: [
      { materialId: 'M01', coef: 70 }, { materialId: 'M02', coef: 11.5 },
      { materialId: 'M03', coef: 0.043 },
      { materialId: 'L01', coef: 0.3 }, { materialId: 'L02', coef: 0.1 },
      { materialId: 'L04', coef: 0.01 }, { materialId: 'L05', coef: 0.015 },
    ],
  },
  {
    id: 'A02', code: 'A.4.4.2.3', ref: 'SNI 2837:2008', source: 'SNI', unit: 'm²',
    name: 'Pemasangan 1 m² plesteran 1 PC : 4 PP, tebal 15 mm',
    components: [
      { materialId: 'M02', coef: 6.24 }, { materialId: 'M03', coef: 0.024 },
      { materialId: 'L01', coef: 0.3 }, { materialId: 'L02', coef: 0.15 },
      { materialId: 'L04', coef: 0.015 }, { materialId: 'L05', coef: 0.015 },
    ],
  },
  {
    id: 'A03', code: 'A.4.4.2.27', ref: 'SNI 2837:2008', source: 'SNI', unit: 'm²',
    name: 'Pemasangan 1 m² acian dinding',
    components: [
      { materialId: 'M02', coef: 3.25 },
      { materialId: 'L01', coef: 0.2 }, { materialId: 'L02', coef: 0.1 },
      { materialId: 'L04', coef: 0.01 }, { materialId: 'L05', coef: 0.01 },
    ],
  },
  {
    id: 'A04', code: 'A.4.1.1.13', ref: 'SNI 7394:2008', source: 'SNI', unit: 'm³',
    name: 'Membuat 1 m³ beton mutu f’c = 21,7 MPa (K-250), slump 12 ± 2 cm',
    components: [
      { materialId: 'M02', coef: 384 }, { materialId: 'M04', coef: 0.494 },
      { materialId: 'M05', coef: 0.77 }, { materialId: 'M06', coef: 215 },
      { materialId: 'L01', coef: 1.65 }, { materialId: 'L02', coef: 0.275 },
      { materialId: 'L04', coef: 0.028 }, { materialId: 'L05', coef: 0.083 },
    ],
  },
  {
    id: 'A05', code: 'A.4.1.1.17', ref: 'SNI 7394:2008', source: 'SNI', unit: 'kg',
    name: 'Pembesian 1 kg dengan besi polos / ulir',
    components: [
      { materialId: 'M07', coef: 1.05 }, { materialId: 'M08', coef: 0.015 },
      { materialId: 'L01', coef: 0.007 }, { materialId: 'L03', coef: 0.007 },
      { materialId: 'L04', coef: 0.0007 }, { materialId: 'L05', coef: 0.0004 },
    ],
  },
];

const SEED_BOQ = [
  { id: 'B01', category: 'PEKERJAAN STRUKTUR',   ahspId: 'A04', volume: 14.4, op: null },
  { id: 'B02', category: 'PEKERJAAN STRUKTUR',   ahspId: 'A05', volume: 1640, op: null },
  { id: 'B03', category: 'PEKERJAAN ARSITEKTUR', ahspId: 'A01', volume: 486,  op: null },
  { id: 'B04', category: 'PEKERJAAN ARSITEKTUR', ahspId: 'A02', volume: 972,  op: null },
  { id: 'B05', category: 'PEKERJAAN ARSITEKTUR', ahspId: 'A03', volume: 972,  op: null },
];

const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

/* ════════════════════════════════════════════════════════════════════════════
   LANGKAH 4 — EKSPOR EXCEL DENGAN FORMULA HIDUP (SheetJS / xlsx)
   ──────────────────────────────────────────────────────────────────────────
   Prinsip: sel JUMLAH tidak menyimpan angka mati, melainkan objek { f: 'E10*F10' }
   sehingga file .xlsx hasil unduhan tetap DINAMIS — ubah volume / harga / tarif
   PPN langsung di Excel, semua subtotal & grand total ikut menghitung ulang.

   Alternatif dengan 'exceljs' (API setara, untuk backend Node):
     const ws = wb.addWorksheet('RAB');
     ws.getCell('G10').value = { formula: 'E10*F10' };           // jumlah per item
     ws.getCell('G20').value = { formula: 'SUM(G10:G19)' };      // subtotal kategori
     await wb.xlsx.writeBuffer();
   Di artifact ini dipakai SheetJS karena tersedia di lingkungan browser.
   ════════════════════════════════════════════════════════════════════════════ */
function exportRabExcel({ projectName, zone, grouped, ppn, opGlobal, materials }) {
  const wb = XLSX.utils.book_new();

  /* ---------- Sheet 1: RAB ---------- */
  const ws = {};
  const put  = (r, c, v, extra)   => { ws[XLSX.utils.encode_cell({ r, c })] = { v, t: typeof v === 'number' ? 'n' : 's', ...extra }; };
  const putF = (r, c, f, z)       => { ws[XLSX.utils.encode_cell({ r, c })] = { t: 'n', f, ...(z ? { z } : {}) }; };
  const MONEY = '#,##0';

  let r = 0;
  put(r, 0, 'RENCANA ANGGARAN BIAYA (RAB)'); r += 1;
  put(r, 0, `Proyek: ${projectName}   •   Zona: ${zone.name} (indeks ${zone.index})   •   O&P global: ${opGlobal}%`); r += 2;

  const headRow = r;
  ['NO', 'KODE AHSP', 'URAIAN PEKERJAAN', 'SAT', 'VOLUME', 'HARGA SATUAN (Rp)', 'JUMLAH (Rp)']
    .forEach((h, c) => put(headRow, c, h));
  r += 1;

  const subtotalRefs = [];
  let no = 1;
  grouped.forEach((g, gi) => {
    if (!g.items.length) return;
    put(r, 0, String.fromCharCode(65 + gi)); put(r, 2, g.category); r += 1;
    const first = r;
    g.items.forEach((it) => {
      const xr = r + 1; // nomor baris Excel (1-based)
      put(r, 0, no); no += 1;
      put(r, 1, it.code);
      put(r, 2, it.name);
      put(r, 3, it.unit);
      put(r, 4, it.volume, { z: '#,##0.00' });
      put(r, 5, it.hsp, { z: MONEY });
      putF(r, 6, `E${xr}*F${xr}`, MONEY);          // ← formula hidup per item
      r += 1;
    });
    const last = r; // baris sesudah item terakhir (1-based utk Excel = r)
    put(r, 2, `SUBTOTAL ${g.category}`);
    if (last > first) putF(r, 6, `SUM(G${first + 1}:G${last})`, MONEY);
    else put(r, 6, 0, { z: MONEY });
    subtotalRefs.push(`G${r + 1}`);
    r += 2;
  });

  /* Rekapitulasi */
  put(r, 2, 'JUMLAH (DPP)');
  const dppRow = r + 1;
  if (subtotalRefs.length) putF(r, 6, subtotalRefs.join('+'), MONEY);
  else put(r, 6, 0, { z: MONEY });
  r += 1;

  put(r, 2, 'PPN'); put(r, 5, ppn / 100, { z: '0.0%' });   // ← tarif PPN editable di Excel
  const ppnRow = r + 1;
  putF(r, 6, `G${dppRow}*F${ppnRow}`, MONEY);
  r += 1;

  put(r, 2, 'GRAND TOTAL');
  const gtRow = r + 1;
  putF(r, 6, `G${dppRow}+G${ppnRow}`, MONEY);
  r += 1;

  put(r, 2, 'DIBULATKAN');
  putF(r, 6, `ROUND(G${gtRow},-3)`, MONEY);
  r += 1;

  ws['!ref']  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 6 } });
  ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 52 }, { wch: 6 }, { wch: 12 }, { wch: 18 }, { wch: 20 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'RAB');

  /* ---------- Sheet 2: HARGA SATUAN (harga zona = formula dari harga dasar × indeks) ---------- */
  const ws2 = {};
  const put2  = (r2, c2, v, extra) => { ws2[XLSX.utils.encode_cell({ r: r2, c: c2 })] = { v, t: typeof v === 'number' ? 'n' : 's', ...extra }; };
  const putF2 = (r2, c2, f, z)     => { ws2[XLSX.utils.encode_cell({ r: r2, c: c2 })] = { t: 'n', f, ...(z ? { z } : {}) }; };
  let r2 = 0;
  put2(r2, 0, `DAFTAR HARGA SATUAN DASAR — Zona: ${zone.name}`); r2 += 2;
  ['KODE', 'URAIAN', 'SAT', 'TIPE', 'HARGA DASAR (Rp)', 'INDEKS ZONA', 'HARGA ZONA (Rp)'].forEach((h, c) => put2(r2, c, h));
  r2 += 1;
  materials.forEach((m) => {
    const xr = r2 + 1;
    put2(r2, 0, m.code); put2(r2, 1, m.name); put2(r2, 2, m.unit); put2(r2, 3, m.type);
    put2(r2, 4, m.basePrice, { z: MONEY });
    put2(r2, 5, zone.index, { z: '0.00' });
    putF2(r2, 6, `ROUND(E${xr}*F${xr},0)`, MONEY);
    r2 += 1;
  });
  ws2['!ref']  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r2, c: 6 } });
  ws2['!cols'] = [{ wch: 10 }, { wch: 44 }, { wch: 6 }, { wch: 8 }, { wch: 18 }, { wch: 12 }, { wch: 18 }];
  ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  XLSX.utils.book_append_sheet(wb, ws2, 'HARGA SATUAN');

  const safe = projectName.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'Proyek';
  XLSX.writeFile(wb, `RAB_${safe}_${zone.id.toUpperCase()}.xlsx`);
}

/* ════════════════════════════════════════════════════════════════════════════
   ATOM UI — Badge, InlineEdit, PctSlider
   ════════════════════════════════════════════════════════════════════════════ */
const TH = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500';
const TD = 'px-3 py-2 align-middle';

function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate:   'bg-slate-100 text-slate-600 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    sky:     'bg-sky-50 text-sky-700 border-sky-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

/** Sel yang bisa diedit langsung di tempat (klik → input → Enter/blur untuk simpan). */
function InlineEdit({ value, onCommit, type = 'text', display, className = '', inputClass = '', disabled = false, title }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  useEffect(() => { setDraft(String(value ?? '')); }, [value]);

  const commit = () => {
    setEditing(false);
    if (type === 'number') {
      const n = parseFloat(String(draft).replace(',', '.'));
      if (!Number.isNaN(n)) onCommit(n);
    } else if (String(draft).trim() !== '') onCommit(String(draft).trim());
  };

  if (disabled) {
    return <span className={`tabular-nums ${className}`} title={title}>{display ?? String(value)}</span>;
  }
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(String(value ?? '')); setEditing(true); }}
        title={title || 'Klik untuk edit'}
        className={`group inline-flex max-w-full items-center gap-1.5 rounded px-1 py-0.5 text-left tabular-nums hover:bg-emerald-50 hover:text-emerald-800 ${className}`}
      >
        <span className="truncate">{display ?? String(value)}</span>
        <Pencil size={11} className="shrink-0 text-slate-300 group-hover:text-emerald-500" />
      </button>
    );
  }
  return (
    <input
      autoFocus
      type={type}
      step="any"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
      className={`w-28 rounded border border-emerald-400 bg-white px-1.5 py-0.5 text-sm tabular-nums outline-none ring-2 ring-emerald-100 ${inputClass}`}
    />
  );
}

/** Slider persentase (O&P / PPN) dengan label nilai. */
function PctSlider({ label, value, onChange, max = 25, disabled = false, icon: Icon = Percent }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Icon size={13} className="text-emerald-600" /> {label}
        </span>
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-700 tabular-nums">
          {value}%
        </span>
      </div>
      <input
        type="range" min="0" max={max} step="0.5" value={value} disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ accentColor: '#059669' }}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   IMPORT EXCEL — LAPISAN "AI MAP" (pemetaan kolom otomatis)
   ──────────────────────────────────────────────────────────────────────────
   Heuristik fuzzy di sisi klien: skor kemiripan header → tebakan kolom +
   tingkat keyakinan. Pada produksi, fungsi autoMap() dapat diganti satu
   panggilan LLM (kirim baris header + 3 baris contoh, minta JSON mapping) —
   antarmukanya identik, sehingga swap-in tanpa mengubah UI.
   ════════════════════════════════════════════════════════════════════════════ */
const FIELD_DEFS = [
  { field: 'name',  label: 'Uraian / Nama',  keywords: ['uraian', 'nama', 'deskripsi', 'barang', 'jasa', 'material', 'item', 'description', 'name', 'pekerjaan'] },
  { field: 'unit',  label: 'Satuan',          keywords: ['satuan', 'sat', 'unit', 'uom'] },
  { field: 'price', label: 'Harga',           keywords: ['harga', 'price', 'rate', 'tarif', 'biaya', 'hsd', 'rp'] },
  { field: 'code',  label: 'Kode',            keywords: ['kode', 'code', 'no', 'id', 'sku'] },
  { field: 'type',  label: 'Tipe (Bahan/Upah)', keywords: ['tipe', 'jenis', 'kategori', 'type', 'kelompok', 'keterangan'] },
];

function scoreHeader(header, keywords) {
  const h = String(header || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();
  if (!h) return 0;
  let best = 0;
  for (const k of keywords) {
    if (h === k) best = Math.max(best, 1);
    else if (h.includes(k)) best = Math.max(best, 0.85);
    else if (h.split(' ').some((t) => t.startsWith(k) || k.startsWith(t) && t.length > 2)) best = Math.max(best, 0.6);
  }
  return best;
}

/** @returns {Record<string,{col:number, conf:number}>} mapping field → kolom terbaik */
function autoMap(headers) {
  const map = {};
  FIELD_DEFS.forEach(({ field, keywords }) => {
    let bestCol = -1, bestScore = 0;
    headers.forEach((h, i) => {
      const s = scoreHeader(h, keywords);
      const taken = Object.values(map).some((m) => m.col === i);
      if (s > bestScore && !taken) { bestScore = s; bestCol = i; }
    });
    if (bestCol >= 0 && bestScore >= 0.5) map[field] = { col: bestCol, conf: bestScore };
  });
  return map;
}

/** Parser angka format Indonesia: "1.250.000,50" → 1250000.5 */
function parsePrice(v) {
  if (typeof v === 'number') return v;
  let s = String(v || '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

function guessType(row, map) {
  const unit = map.unit ? String(row[map.unit.col] || '').toLowerCase() : '';
  const hint = map.type ? String(row[map.type.col] || '').toLowerCase() : '';
  if (/(oh|hok|jam|hari|org)/.test(unit) || /(upah|jasa|tukang|pekerja|mandor|labor)/.test(hint + ' ' + unit)) return 'UPAH';
  return 'BAHAN';
}

/** Contoh file eksternal "berantakan" untuk demo tanpa upload. */
const SAMPLE_AOA = [
  ['DAFTAR HARGA TOKO SUMBER BANGUNAN', '', '', '', ''],
  ['NO', 'NAMA BARANG / JASA', 'SAT.', 'HARGA SATUAN (Rp)', 'KETERANGAN'],
  [1, 'Cat tembok interior 25 kg', 'kaleng', '785.000', 'bahan finishing'],
  [2, 'Keramik lantai 40x40', 'm2', '62.500', 'bahan'],
  [3, 'Tukang cat', 'OH', '135.000', 'upah harian'],
  [4, 'Lem keramik (mortar perekat)', 'sak', '78.000', 'bahan'],
  [5, 'Kepala tukang finishing', 'OH', '162.500', 'upah'],
];

function buildItems(rows, map) {
  return rows
    .map((row, i) => {
      const name = map.name ? String(row[map.name.col] || '').trim() : '';
      if (!name) return null;
      return {
        id: uid('m'),
        code: map.code && String(row[map.code.col] || '').trim() ? `IMP.${String(row[map.code.col]).trim()}` : `IMP.${i + 1}`,
        name,
        unit: map.unit ? String(row[map.unit.col] || 'unit').trim() || 'unit' : 'unit',
        type: guessType(row, map),
        basePrice: map.price ? Math.round(parsePrice(row[map.price.col])) : 0,
      };
    })
    .filter(Boolean);
}

function ImportModal({ onClose }) {
  const { importMaterials, notify } = useApp();
  const [stage, setStage] = useState('pick');          // 'pick' | 'map'
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [map, setMap] = useState({});
  const [fileName, setFileName] = useState('');

  const ingest = (aoa, label) => {
    const hi = aoa.findIndex((r) => (r || []).filter((c) => String(c ?? '').trim() !== '').length >= 2);
    if (hi < 0) { notify('File kosong / tidak terbaca.'); return; }
    const hdr = (aoa[hi] || []).map((c) => String(c ?? ''));
    const body = aoa.slice(hi + 1).filter((r) => (r || []).some((c) => String(c ?? '').trim() !== ''));
    setHeaders(hdr); setRows(body); setMap(autoMap(hdr)); setFileName(label); setStage('map');
  };

  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      ingest(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }), f.name);
    } catch {
      notify('Gagal membaca file. Pastikan format .xlsx / .csv valid.');
    }
  };

  const items = useMemo(() => buildItems(rows, map), [rows, map]);
  const confBadge = (f) => {
    const m = map[f];
    if (!m) return <Badge tone="slate">manual</Badge>;
    const pct = Math.round(m.conf * 100);
    return <Badge tone={pct >= 80 ? 'emerald' : 'amber'}><Sparkles size={11} /> AI {pct}%</Badge>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.55)' }}>
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Wand2 size={16} /></span>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Import Excel — AI Column Mapping</h3>
              <p className="text-xs text-slate-500">{stage === 'pick' ? 'Pilih sumber data material / upah' : `Sumber: ${fileName}`}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={18} /></button>
        </div>

        {stage === 'pick' && (
          <div className="space-y-4 p-6">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-emerald-400 hover:bg-emerald-50">
              <Upload size={26} className="text-emerald-600" />
              <span className="text-sm font-medium text-slate-700">Pilih file .xlsx / .csv dari komputer</span>
              <span className="text-xs text-slate-400">Header boleh berantakan — AI akan memetakan kolomnya</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
            </label>
            <button
              onClick={() => ingest(SAMPLE_AOA, 'contoh_daftar_harga_toko.xlsx (demo)')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <FileSpreadsheet size={16} className="text-emerald-600" /> Gunakan data contoh (format toko bangunan)
            </button>
          </div>
        )}

        {stage === 'map' && (
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {FIELD_DEFS.map(({ field, label }) => (
                <div key={field} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-700">{label}</div>
                    <select
                      value={map[field] ? map[field].col : -1}
                      onChange={(e) => {
                        const col = parseInt(e.target.value, 10);
                        setMap((m) => {
                          const next = { ...m };
                          if (col < 0) delete next[field];
                          else next[field] = { col, conf: 1 };
                          return next;
                        });
                      }}
                      className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none focus:border-emerald-400"
                    >
                      <option value={-1}>— abaikan —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h || `Kolom ${i + 1}`}</option>)}
                    </select>
                  </div>
                  {confBadge(field)}
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                Pratinjau hasil pemetaan ({items.length} item terdeteksi)
              </div>
              <table className="w-full text-sm">
                <thead className="bg-white">
                  <tr className="border-b border-slate-100">
                    <th className={TH}>Kode</th><th className={TH}>Uraian</th><th className={TH}>Sat</th><th className={TH}>Tipe</th><th className={`${TH} text-right`}>Harga</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 3).map((it) => (
                    <tr key={it.id} className="border-b border-slate-50">
                      <td className={`${TD} font-mono text-xs text-slate-500`}>{it.code}</td>
                      <td className={TD}>{it.name}</td>
                      <td className={`${TD} text-slate-500`}>{it.unit}</td>
                      <td className={TD}><Badge tone={it.type === 'UPAH' ? 'sky' : 'slate'}>{it.type}</Badge></td>
                      <td className={`${TD} text-right font-mono tabular-nums`}>{fmtIDR(it.basePrice)}</td>
                    </tr>
                  ))}
                  {items.length > 3 && (
                    <tr><td colSpan={5} className="px-3 py-2 text-center text-xs text-slate-400">… dan {items.length - 3} item lainnya</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stage === 'map' && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
            <button onClick={() => setStage('pick')} className="text-sm font-medium text-slate-500 hover:text-slate-700">← Ganti sumber</button>
            <button
              disabled={!items.length}
              onClick={() => { importMaterials(items); onClose(); }}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
            >
              <CheckCircle2 size={16} /> Impor {items.length} Item
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 1 — MASTER DATA & ZONASI
   ════════════════════════════════════════════════════════════════════════════ */
function MasterTab() {
  const { materials, zone, canEdit, updateMaterial, addMaterial, removeMaterial, setImportOpen, templates } = useApp();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('SEMUA');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return materials.filter((m) =>
      (filter === 'SEMUA' || m.type === filter) &&
      (!needle || (m.name + ' ' + m.code).toLowerCase().includes(needle)),
    );
  }, [materials, q, filter]);

  const usedIds = useMemo(() => {
    const s = new Set();
    templates.forEach((t) => t.components.forEach((c) => s.add(c.materialId)));
    return s;
  }, [templates]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari material / upah…"
            className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-medium">
          {['SEMUA', 'BAHAN', 'UPAH'].map((f) => (
            <button
              key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 ${filter === f ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)} disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
          >
            <Wand2 size={15} /> Import Excel (AI Map)
          </button>
          <button
            onClick={addMaterial} disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            <Plus size={15} /> Material Baru
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Daftar Harga Satuan Dasar — {rows.length} item
          </span>
          <Badge tone="emerald"><MapPin size={11} /> {zone.name} · indeks {zone.index.toFixed(2)}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 760 }}>
            <thead>
              <tr className="border-b border-slate-200">
                <th className={TH}>Kode</th>
                <th className={TH}>Uraian</th>
                <th className={TH}>Sat</th>
                <th className={TH}>Tipe</th>
                <th className={`${TH} text-right`}>Harga Dasar (Nasional)</th>
                <th className={`${TH} text-right`}>Harga Zona Aktif</th>
                <th className={`${TH} w-12`} />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const zonePrice = Math.round(m.basePrice * zone.index);
                return (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className={`${TD} font-mono text-xs text-slate-500`}>{m.code}</td>
                    <td className={TD}>
                      <InlineEdit value={m.name} disabled={!canEdit} onCommit={(v) => updateMaterial(m.id, { name: v })} className="font-medium text-slate-700" />
                    </td>
                    <td className={TD}>
                      <InlineEdit value={m.unit} disabled={!canEdit} onCommit={(v) => updateMaterial(m.id, { unit: v })} className="text-slate-500" inputClass="w-16" />
                    </td>
                    <td className={TD}><Badge tone={m.type === 'UPAH' ? 'sky' : 'slate'}>{m.type}</Badge></td>
                    <td className={`${TD} text-right`}>
                      <InlineEdit
                        type="number" value={m.basePrice} disabled={!canEdit}
                        display={fmtIDR(m.basePrice)}
                        onCommit={(v) => updateMaterial(m.id, { basePrice: Math.max(0, Math.round(v)) })}
                        className="justify-end font-mono" inputClass="text-right"
                      />
                    </td>
                    <td className={`${TD} text-right font-mono font-semibold text-emerald-700 tabular-nums`}>{fmtIDR(zonePrice)}</td>
                    <td className={`${TD} text-right`}>
                      <button
                        disabled={!canEdit}
                        onClick={() => removeMaterial(m.id, usedIds.has(m.id))}
                        title={usedIds.has(m.id) ? 'Dipakai oleh template AHSP' : 'Hapus'}
                        className="rounded p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Tidak ada item yang cocok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-slate-400">
        Harga Zona Aktif = Harga Dasar × indeks zona ({zone.index.toFixed(2)}). Mengganti zona di header akan
        menghitung ulang seluruh AHSP dan RAB secara real-time. Pada skema produksi, tabel
        <span className="font-mono"> MaterialZonePrice</span> dipakai untuk override harga presisi per zona.
      </p>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 2 — DYNAMIC AHSP BUILDER
   ════════════════════════════════════════════════════════════════════════════ */
function CompSection({ tpl, type, locked }) {
  const { materials, matMap, zone, tplAddComp, tplUpdateComp, tplRemoveComp, canEdit } = useApp();
  const comps = tpl.components.filter((c) => (matMap[c.materialId] || {}).type === type);
  const editable = canEdit && !locked;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {type === 'BAHAN' ? 'A — Bahan' : 'B — Tenaga / Upah'}
        </span>
        <button
          onClick={() => tplAddComp(tpl.id, type)} disabled={!editable}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-30"
        >
          <Plus size={13} /> Komponen
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className={TH}>Komponen</th>
            <th className={`${TH} w-28 text-right`}>Koefisien</th>
            <th className={`${TH} w-16`}>Sat</th>
            <th className={`${TH} w-32 text-right`}>Harga Zona</th>
            <th className={`${TH} w-32 text-right`}>Subtotal</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {comps.map((c) => {
            const m = matMap[c.materialId];
            if (!m) return null;
            const zonePrice = Math.round(m.basePrice * zone.index);
            const sub = (parseFloat(String(c.coef).replace(',', '.')) || 0) * zonePrice;
            return (
              <tr key={c.key} className="border-b border-slate-50 last:border-0">
                <td className={TD}>
                  <select
                    value={c.materialId} disabled={!editable}
                    onChange={(e) => tplUpdateComp(tpl.id, c.key, { materialId: e.target.value })}
                    style={{ maxWidth: 240 }} className="w-full truncate rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none focus:border-emerald-400 disabled:border-transparent disabled:bg-transparent disabled:appearance-none"
                  >
                    <optgroup label="Bahan">
                      {materials.filter((x) => x.type === 'BAHAN').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </optgroup>
                    <optgroup label="Upah">
                      {materials.filter((x) => x.type === 'UPAH').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </optgroup>
                  </select>
                </td>
                <td className={`${TD} text-right`}>
                  <input
                    type="number" step="any" value={c.coef} disabled={!editable}
                    onChange={(e) => tplUpdateComp(tpl.id, c.key, { coef: e.target.value })}
                    className="w-24 rounded border border-slate-200 px-1.5 py-1 text-right font-mono text-xs tabular-nums outline-none focus:border-emerald-400 disabled:border-transparent disabled:bg-transparent"
                  />
                </td>
                <td className={`${TD} text-xs text-slate-500`}>{m.unit}</td>
                <td className={`${TD} text-right font-mono text-xs tabular-nums text-slate-500`}>{fmtIDR(zonePrice)}</td>
                <td className={`${TD} text-right font-mono text-xs font-semibold tabular-nums text-slate-700`}>{fmtIDR(sub)}</td>
                <td className={`${TD} text-right`}>
                  <button
                    onClick={() => tplRemoveComp(tpl.id, c.key)} disabled={!editable}
                    className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
          {!comps.length && (
            <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-slate-400">Belum ada komponen {type.toLowerCase()}.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function BuilderTab() {
  const { templates, selTplId, setSelTplId, calcTpl, opGlobal, updateTpl, addCustomTpl, duplicateTpl, canEdit } = useApp();
  const tpl = templates.find((t) => t.id === selTplId) || templates[0];
  if (!tpl) return null;
  const locked = tpl.source === 'SNI';
  const { bahan, upah, jumlah } = calcTpl(tpl);
  const op = Math.round(jumlah * opGlobal / 100);
  const hsp = hspOf(jumlah, opGlobal);

  const RecapRow = ({ k, label, val, strong = false }) => (
    <div className={`flex items-baseline gap-2 ${strong ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
      <span className="w-5 shrink-0 font-mono text-xs">{k}</span>
      <span className="shrink-0 text-sm">{label}</span>
      <span className="mx-1 flex-1 border-b border-dotted border-slate-300" />
      <span className={`font-mono text-sm tabular-nums ${strong ? 'text-emerald-700' : ''}`}>{fmtIDR(val)}</span>
    </div>
  );

  return (
    <section className="grid gap-4 lg:grid-cols-12">
      {/* ── Daftar template ── */}
      <aside className="space-y-2 lg:col-span-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Template AHSP</h3>
          <button
            onClick={addCustomTpl} disabled={!canEdit}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            <Plus size={13} /> Buat AHSP Baru
          </button>
        </div>
        <div className="space-y-1.5">
          {templates.map((t) => {
            const c = calcTpl(t);
            const active = t.id === tpl.id;
            return (
              <button
                key={t.id} onClick={() => setSelTplId(t.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  active ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-500">{t.code}</span>
                  {t.source === 'SNI'
                    ? <Badge tone="amber"><Lock size={10} /> SNI</Badge>
                    : <Badge tone="emerald">CUSTOM</Badge>}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-700">{t.name}</div>
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-400">per {t.unit}</span>
                  <span className="font-mono font-semibold tabular-nums text-slate-600">{fmtIDR(hspOf(c.jumlah, opGlobal))}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Editor ── */}
      <div className="space-y-3 lg:col-span-8">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                {tpl.code} <ChevronRight size={12} /> {tpl.ref || 'tanpa referensi'}
              </div>
              <InlineEdit
                value={tpl.name} disabled={!canEdit || locked}
                onCommit={(v) => updateTpl(tpl.id, { name: v })}
                className="mt-1 text-base font-semibold text-slate-800" inputClass="w-full text-base"
              />
              <div className="mt-1 text-xs text-slate-400">
                Satuan analisis:{' '}
                <InlineEdit value={tpl.unit} disabled={!canEdit || locked} onCommit={(v) => updateTpl(tpl.id, { unit: v })} inputClass="w-14" />
              </div>
            </div>
            <button
              onClick={() => duplicateTpl(tpl.id)} disabled={!canEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <Copy size={13} /> Duplikat sebagai Custom
            </button>
          </div>

          {locked && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              <Lock size={14} className="mt-0.5 shrink-0" />
              <span>
                <b>Template SNI terkunci</b> demi kepatuhan (compliance) — koefisien & komponen tidak dapat diubah.
                Gunakan <b>Duplikat sebagai Custom</b> untuk membuat varian yang dapat diedit.
              </span>
            </div>
          )}
        </div>

        <CompSection tpl={tpl} type="BAHAN" locked={locked} />
        <CompSection tpl={tpl} type="UPAH" locked={locked} />

        {/* Rekap gaya dokumen AHSP resmi */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Rekapitulasi Harga Satuan Pekerjaan — per {tpl.unit}
          </h4>
          <div className="space-y-1.5">
            <RecapRow k="A" label="Jumlah harga bahan" val={bahan} />
            <RecapRow k="B" label="Jumlah harga tenaga" val={upah} />
            <RecapRow k="C" label="Jumlah (A + B)" val={jumlah} />
            <RecapRow k="D" label={`Overhead & profit (${opGlobal}% × C)`} val={op} />
            <RecapRow k="E" label="Harga Satuan Pekerjaan (C + D)" val={hsp} strong />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TAB 3 — RAB / BoQ (DYNAMIC EXCEL PREVIEW)
   ════════════════════════════════════════════════════════════════════════════ */
function RabTab() {
  const {
    templates, boq, grouped, dpp, ppnVal, grand, ppn, setPpn, opGlobal,
    addBoqItem, updateBoqItem, removeBoqItem, exportNow, canEdit,
  } = useApp();

  const cats = useMemo(() => Array.from(new Set(boq.map((b) => b.category))), [boq]);
  const [newCat, setNewCat] = useState(cats[0] || '__new__');
  const [newCatName, setNewCatName] = useState('');
  const [newTplId, setNewTplId] = useState(templates[0] ? templates[0].id : '');
  const [newVol, setNewVol] = useState('1');

  const submitNew = () => {
    const cat = newCat === '__new__' ? newCatName.trim().toUpperCase() : newCat;
    const vol = parseFloat(String(newVol).replace(',', '.'));
    if (!cat || !newTplId || !vol || vol <= 0) return;
    addBoqItem({ category: cat, ahspId: newTplId, volume: vol });
    setNewVol('1'); setNewCatName('');
    if (newCat === '__new__') setNewCat(cat);
  };

  return (
    <section className="space-y-4">
      {/* Form tambah item */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tambah Item Pekerjaan</h4>
        <div className="grid gap-2 md:grid-cols-12">
          <div className="md:col-span-3">
            <select
              value={newCat} onChange={(e) => setNewCat(e.target.value)} disabled={!canEdit}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-emerald-400"
            >
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">+ Kategori baru…</option>
            </select>
            {newCat === '__new__' && (
              <input
                value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="NAMA KATEGORI"
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm uppercase outline-none focus:border-emerald-400"
              />
            )}
          </div>
          <div className="md:col-span-5">
            <select
              value={newTplId} onChange={(e) => setNewTplId(e.target.value)} disabled={!canEdit}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-emerald-400"
            >
              {templates.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <input
              type="number" step="any" min="0" value={newVol} onChange={(e) => setNewVol(e.target.value)}
              disabled={!canEdit} placeholder="Volume"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-right font-mono text-sm tabular-nums outline-none focus:border-emerald-400"
            />
          </div>
          <div className="md:col-span-2">
            <button
              onClick={submitNew} disabled={!canEdit}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              <Plus size={15} /> Tambah
            </button>
          </div>
        </div>
      </div>

      {/* Tabel BoQ — pratinjau "Excel dinamis" */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 860 }}>
            <thead>
              <tr className="bg-slate-900 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                <th className="px-3 py-2.5 w-10">No</th>
                <th className="px-3 py-2.5 w-28">Kode AHSP</th>
                <th className="px-3 py-2.5">Uraian Pekerjaan</th>
                <th className="px-3 py-2.5 w-14">Sat</th>
                <th className="px-3 py-2.5 w-24 text-right">Volume</th>
                <th className="px-3 py-2.5 w-20 text-right">O&P %</th>
                <th className="px-3 py-2.5 w-36 text-right">Harga Satuan</th>
                <th className="px-3 py-2.5 w-40 text-right">Jumlah</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {grouped.map((g, gi) => (
                <React.Fragment key={g.category}>
                  <tr className="border-b border-slate-200 bg-slate-100">
                    <td className="px-3 py-2 font-mono text-xs font-bold text-slate-500">{String.fromCharCode(65 + gi)}</td>
                    <td colSpan={8} className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">{g.category}</td>
                  </tr>
                  {g.items.map((it, ii) => (
                    <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className={`${TD} font-mono text-xs text-slate-400`}>{it.no}</td>
                      <td className={`${TD} font-mono text-xs text-slate-500`}>{it.code}</td>
                      <td className={`${TD} text-slate-700`}>{it.name}</td>
                      <td className={`${TD} text-xs text-slate-500`}>{it.unit}</td>
                      <td className={`${TD} text-right`}>
                        <InlineEdit
                          type="number" value={it.volume} disabled={!canEdit}
                          display={fmtNum(it.volume)}
                          onCommit={(v) => updateBoqItem(it.id, { volume: Math.max(0, v) })}
                          className="justify-end font-mono" inputClass="w-20 text-right"
                        />
                      </td>
                      <td className={`${TD} text-right`}>
                        <input
                          type="number" step="0.5" min="0" max="30"
                          value={it.op === null || it.op === undefined ? '' : it.op}
                          placeholder={String(opGlobal)} disabled={!canEdit}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateBoqItem(it.id, { op: v === '' ? null : Math.max(0, parseFloat(v)) });
                          }}
                          title="Kosongkan untuk memakai O&P global"
                          className="w-14 rounded border border-slate-200 px-1 py-0.5 text-right font-mono text-xs tabular-nums outline-none placeholder:text-slate-300 focus:border-emerald-400 disabled:border-transparent disabled:bg-transparent"
                        />
                      </td>
                      <td className={`${TD} text-right font-mono text-xs tabular-nums text-slate-600`}>{fmtIDR(it.hsp)}</td>
                      <td className={`${TD} text-right font-mono tabular-nums font-medium text-slate-800`}>{fmtIDR(it.total)}</td>
                      <td className={`${TD} text-right`}>
                        <button
                          onClick={() => removeBoqItem(it.id)} disabled={!canEdit}
                          className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td colSpan={7} className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Subtotal {g.category}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-sm font-bold tabular-nums text-slate-800">{fmtIDR(g.subtotal)}</td>
                    <td />
                  </tr>
                </React.Fragment>
              ))}
              {!grouped.length && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">Belum ada item pekerjaan. Tambahkan dari form di atas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rekapitulasi + Ekspor */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-7">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Rekapitulasi</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-baseline gap-2 text-slate-600">
              <span>Jumlah (DPP)</span>
              <span className="mx-1 flex-1 border-b border-dotted border-slate-300" />
              <span className="font-mono tabular-nums">{fmtIDR(dpp)}</span>
            </div>
            <div className="flex items-baseline gap-2 text-slate-600">
              <span>PPN {ppn}%</span>
              <span className="mx-1 flex-1 border-b border-dotted border-slate-300" />
              <span className="font-mono tabular-nums">{fmtIDR(ppnVal)}</span>
            </div>
            <div className="flex items-baseline gap-2 border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <span>Grand Total</span>
              <span className="mx-1 flex-1 border-b border-dotted border-slate-300" />
              <span className="font-mono tabular-nums text-emerald-700">{fmtIDR(grand)}</span>
            </div>
            <div className="flex items-baseline gap-2 text-xs text-slate-400">
              <span>Dibulatkan (ribuan)</span>
              <span className="mx-1 flex-1 border-b border-dotted border-slate-200" />
              <span className="font-mono tabular-nums">{fmtIDR(Math.round(grand / 1000) * 1000)}</span>
            </div>
          </div>
          <div className="mt-4 max-w-xs">
            <PctSlider label="Tarif PPN" value={ppn} onChange={setPpn} max={15} disabled={!canEdit} icon={Sigma} />
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 lg:col-span-5">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <FileSpreadsheet size={16} /> Ekspor Excel dengan Formula
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed text-emerald-800">
              File .xlsx berisi <b>formula hidup</b>: <span className="font-mono">=E10*F10</span>,{' '}
              <span className="font-mono">=SUM(…)</span>, sel tarif PPN yang bisa diedit, plus sheet
              Harga Satuan dengan formula indeks zona. Ubah angka di Excel → total ikut terhitung ulang.
            </p>
          </div>
          <button
            onClick={exportNow}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <FileDown size={16} /> Ekspor Excel dengan Formula
          </button>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SHELL — Header, Summary Strip, Navigasi Tab, Toast
   ════════════════════════════════════════════════════════════════════════════ */
const TABS = [
  { id: 'master',  label: 'Master Data & Zonasi',  icon: Database },
  { id: 'builder', label: 'Dynamic AHSP Builder',  icon: Hammer },
  { id: 'rab',     label: 'RAB / BoQ',             icon: FileSpreadsheet },
];

function HeaderBar() {
  const { zoneId, setZoneId, role, setRole } = useApp();
  return (
    <header className="bg-slate-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg">
            <Building2 size={18} />
          </span>
          <div>
            <div className="text-sm font-bold leading-tight text-white">AHSP · RAB Studio</div>
            <div className="text-xs leading-tight text-slate-400">Estimator Konstruksi — SaaS Core Dashboard</div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300">
            <MapPin size={13} className="text-emerald-400" />
            <select
              value={zoneId} onChange={(e) => setZoneId(e.target.value)}
              className="bg-slate-800 text-xs font-medium text-white outline-none"
            >
              {ZONES.map((z) => <option key={z.id} value={z.id}>{z.name} ({z.index.toFixed(2)})</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300" title="Simulasi RBAC — CLIENT hanya bisa melihat & ekspor">
            <ShieldCheck size={13} className="text-emerald-400" />
            <select
              value={role} onChange={(e) => setRole(e.target.value)}
              className="bg-slate-800 text-xs font-medium text-white outline-none"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="ESTIMATOR">ESTIMATOR</option>
              <option value="CLIENT">CLIENT (read-only)</option>
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}

function SummaryStrip() {
  const { projectName, setProjectName, zone, dpp, grand, opGlobal, setOpGlobal, ppn, setPpn, canEdit, boq } = useApp();
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-3 px-4 py-4 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Proyek</div>
          <InlineEdit
            value={projectName} disabled={!canEdit} onCommit={setProjectName}
            className="mt-0.5 text-sm font-semibold text-slate-800" inputClass="w-full"
          />
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin size={12} className="text-emerald-600" /> {zone.name} · indeks {zone.index.toFixed(2)} · {boq.length} item pekerjaan
          </div>
        </div>
        <div className="rounded-xl bg-slate-900 px-4 py-3 md:col-span-3">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Grand Total (incl. PPN)</div>
          <div className="mt-1 truncate font-mono text-lg font-bold tabular-nums text-emerald-400">{fmtIDR(grand)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400">DPP</div>
          <div className="mt-1 truncate font-mono text-lg font-semibold tabular-nums text-slate-700">{fmtIDR(dpp)}</div>
        </div>
        <div className="flex flex-col justify-center gap-2.5 md:col-span-3">
          <PctSlider label="O&P Global" value={opGlobal} onChange={setOpGlobal} max={25} disabled={!canEdit} />
          <PctSlider label="PPN" value={ppn} onChange={setPpn} max={15} disabled={!canEdit} icon={Sigma} />
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { tab, setTab, toast, importOpen, setImportOpen, role } = useApp();
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <style>{`
        input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
      `}</style>

      <HeaderBar />
      <SummaryStrip />

      <main className="mx-auto max-w-6xl px-4 py-5">
        <nav className="mb-5 flex flex-wrap gap-1.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id} onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === id ? 'bg-slate-900 text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Icon size={15} className={tab === id ? 'text-emerald-400' : 'text-slate-400'} />
              {label}
            </button>
          ))}
          {role === 'CLIENT' && (
            <span className="ml-auto self-center"><Badge tone="sky"><ShieldCheck size={11} /> Mode lihat-saja (CLIENT)</Badge></span>
          )}
        </nav>

        {tab === 'master' && <MasterTab />}
        {tab === 'builder' && <BuilderTab />}
        {tab === 'rab' && <RabTab />}

        <footer className="mt-8 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-400">
          <p>
            <b>Disclaimer:</b> harga, indeks zona, dan koefisien pada demo ini bersifat ilustratif.
            Untuk penawaran nyata, verifikasi koefisien dengan dokumen AHSP resmi
            (Permen PUPR No. 1/2022 & SNI terkait) serta survei harga setempat.
          </p>
        </footer>
      </main>

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-2xl">
          <CheckCircle2 size={16} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   LANGKAH 2 — ROOT: STATE MANAGEMENT & MESIN HITUNG REAL-TIME
   ──────────────────────────────────────────────────────────────────────────
   Satu sumber kebenaran (single source of truth) via Context. Seluruh angka
   diturunkan dengan useMemo sehingga: ganti zona → harga material berubah →
   HSP semua AHSP berubah → total RAB & kartu ringkasan ikut berubah, instan.
   ════════════════════════════════════════════════════════════════════════════ */
export default function AhspRabStudio() {
  const [projectName, setProjectName] = useState('Rumah Tinggal 2 Lantai — Yogyakarta');
  const [zoneId, setZoneId] = useState('diy');
  const [role, setRole] = useState('ADMIN');                 // simulasi RBAC
  const [opGlobal, setOpGlobal] = useState(10);              // % overhead & profit
  const [ppn, setPpn] = useState(11);                        // % PPN
  const [tab, setTab] = useState('master');
  const [selTplId, setSelTplId] = useState('A01');
  const [importOpen, setImportOpen] = useState(false);

  const [materials, setMaterials] = useState(SEED_MATERIALS);
  const [templates, setTemplates] = useState(() =>
    SEED_TEMPLATES.map((t) => ({ ...t, components: t.components.map((c) => ({ ...c, key: uid('c') })) })),
  );
  const [boq, setBoq] = useState(SEED_BOQ);

  const [toast, setToast] = useState('');
  const toastT = useRef(null);
  const notify = (msg) => {
    setToast(msg);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 3400);
  };

  const zone = ZONES.find((z) => z.id === zoneId) || ZONES[0];
  const canEdit = role !== 'CLIENT';
  const matMap = useMemo(() => Object.fromEntries(materials.map((m) => [m.id, m])), [materials]);

  /** Hitung 1 template AHSP pada zona aktif → { bahan, upah, jumlah } */
  const calcTpl = useMemo(() => (tpl) => {
    let bahan = 0, upah = 0;
    tpl.components.forEach((c) => {
      const m = matMap[c.materialId];
      if (!m) return;
      const coef = parseFloat(String(c.coef).replace(',', '.')) || 0;
      const sub = coef * Math.round(m.basePrice * zone.index);
      if (m.type === 'UPAH') upah += sub; else bahan += sub;
    });
    return { bahan: Math.round(bahan), upah: Math.round(upah), jumlah: Math.round(bahan + upah) };
  }, [matMap, zone]);

  /* ── Turunan RAB: grouped per kategori + rekap ── */
  const grouped = useMemo(() => {
    const byCat = new Map();
    let no = 1;
    boq.forEach((b) => {
      const t = templates.find((x) => x.id === b.ahspId);
      if (!t) return;
      const { jumlah } = calcTpl(t);
      const opUsed = b.op === null || b.op === undefined ? opGlobal : b.op;
      const hsp = hspOf(jumlah, opUsed);
      const row = {
        id: b.id, no: no++, code: t.code, name: t.name, unit: t.unit,
        volume: b.volume, op: b.op, hsp, total: Math.round(hsp * b.volume),
      };
      if (!byCat.has(b.category)) byCat.set(b.category, []);
      byCat.get(b.category).push(row);
    });
    return Array.from(byCat.entries()).map(([category, items]) => ({
      category, items, subtotal: items.reduce((s, x) => s + x.total, 0),
    }));
  }, [boq, templates, calcTpl, opGlobal]);

  const dpp = useMemo(() => grouped.reduce((s, g) => s + g.subtotal, 0), [grouped]);
  const ppnVal = Math.round(dpp * ppn / 100);
  const grand = dpp + ppnVal;

  /* ── Mutator: Material ── */
  const updateMaterial = (id, patch) => setMaterials((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const addMaterial = () => {
    const id = uid('m');
    setMaterials((ms) => [{ id, code: `BHN.${String(ms.length + 1).padStart(3, '0')}`, name: 'Material baru', unit: 'unit', type: 'BAHAN', basePrice: 0 }, ...ms]);
    notify('Material baru ditambahkan — klik sel untuk mengedit.');
  };
  const removeMaterial = (id, used) => {
    if (used) { notify('Tidak bisa dihapus: material dipakai oleh template AHSP.'); return; }
    setMaterials((ms) => ms.filter((m) => m.id !== id));
    notify('Material dihapus.');
  };
  const importMaterials = (items) => {
    setMaterials((ms) => [...items, ...ms]);
    notify(`${items.length} item berhasil diimpor via AI mapping.`);
  };

  /* ── Mutator: Template AHSP ── */
  const updateTpl = (id, patch) => setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const tplAddComp = (id, type) => {
    const first = materials.find((m) => m.type === type) || materials[0];
    if (!first) return;
    setTemplates((ts) => ts.map((t) => (t.id === id
      ? { ...t, components: [...t.components, { key: uid('c'), materialId: first.id, coef: 1 }] }
      : t)));
  };
  const tplUpdateComp = (id, key, patch) => setTemplates((ts) => ts.map((t) => (t.id === id
    ? { ...t, components: t.components.map((c) => (c.key === key ? { ...c, ...patch } : c)) }
    : t)));
  const tplRemoveComp = (id, key) => setTemplates((ts) => ts.map((t) => (t.id === id
    ? { ...t, components: t.components.filter((c) => c.key !== key) }
    : t)));
  const addCustomTpl = () => {
    const id = uid('t');
    const n = templates.filter((t) => t.source === 'CUSTOM').length + 1;
    setTemplates((ts) => [...ts, {
      id, code: `CST.${String(n).padStart(3, '0')}`, ref: 'Analisis sendiri', source: 'CUSTOM',
      unit: 'm²', name: 'AHSP custom baru — klik untuk ganti nama', components: [],
    }]);
    setSelTplId(id); setTab('builder');
    notify('Template custom dibuat — tambahkan komponen bahan & upah.');
  };
  const duplicateTpl = (id) => {
    const src = templates.find((t) => t.id === id);
    if (!src) return;
    const nid = uid('t');
    const n = templates.filter((t) => t.source === 'CUSTOM').length + 1;
    setTemplates((ts) => [...ts, {
      ...src, id: nid, code: `CST.${String(n).padStart(3, '0')}`, source: 'CUSTOM',
      name: `${src.name} (custom)`, ref: `Duplikat dari ${src.code}`,
      components: src.components.map((c) => ({ ...c, key: uid('c') })),
    }]);
    setSelTplId(nid);
    notify('Duplikat custom dibuat — koefisien kini dapat diedit.');
  };

  /* ── Mutator: BoQ ── */
  const addBoqItem = ({ category, ahspId, volume }) => {
    setBoq((bs) => [...bs, { id: uid('b'), category, ahspId, volume, op: null }]);
    notify('Item pekerjaan ditambahkan ke RAB.');
  };
  const updateBoqItem = (id, patch) => setBoq((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const removeBoqItem = (id) => setBoq((bs) => bs.filter((b) => b.id !== id));

  /* ── Ekspor ── */
  const exportNow = () => {
    try {
      exportRabExcel({ projectName, zone, grouped, ppn, opGlobal, materials });
      notify('File Excel dengan formula berhasil dibuat & diunduh.');
    } catch (err) {
      notify('Gagal ekspor: ' + (err && err.message ? err.message : 'kesalahan tak dikenal'));
    }
  };

  const ctx = {
    projectName, setProjectName, zoneId, setZoneId, zone, role, setRole, canEdit,
    opGlobal, setOpGlobal, ppn, setPpn, tab, setTab, selTplId, setSelTplId,
    importOpen, setImportOpen, toast, notify,
    materials, matMap, updateMaterial, addMaterial, removeMaterial, importMaterials,
    templates, calcTpl, updateTpl, tplAddComp, tplUpdateComp, tplRemoveComp, addCustomTpl, duplicateTpl,
    boq, grouped, dpp, ppnVal, grand, addBoqItem, updateBoqItem, removeBoqItem, exportNow,
  };

  return (
    <AppCtx.Provider value={ctx}>
      <Shell />
    </AppCtx.Provider>
  );
}
