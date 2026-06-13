/* ════════════════════════════════════════════════════════════════════════════
   CONTOH INTEGRASI FIREBASE KE AhspRabStudio.jsx
   ──────────────────────────────────────────────────────────────────────────
   File ini menunjukkan bagian-bagian yang perlu diubah dari file asli
   untuk sambung ke Firebase Firestore dengan real-time sync.
   
   Copy-paste bagian yang sesuai ke AhspRabStudio.jsx kamu.
   ════════════════════════════════════════════════════════════════════════════ */

// ── LANGKAH 1: TAMBAH IMPORT FIREBASE DI ATAS FILE ──
import React, { useState, useMemo, useEffect, useRef, createContext, useContext } from 'react';
import * as XLSX from 'xlsx';
import { /* ... icon imports ... */ } from 'lucide-react';

// ✅ TAMBAHKAN IMPOR INI:
import {
  subscribeMaterials, saveMaterial, deleteMaterial,
  subscribeTemplates, saveTemplate, deleteTemplate,
  subscribeBoq, saveBoqItem, deleteBoqItem,
  saveProject,
} from './firebase.js';

// ─────────────────────────────────────────────────────────────────────────────

// ── LANGKAH 2: SEBELUM EXPORT DEFAULT, TAMBAHKAN ──
// Ganti ID ini dengan ID user/proyek yang Anda gunakan
const PROJECT_ID = 'proyek-001';  // Bisa diganti dinamis nanti dari auth

// ─────────────────────────────────────────────────────────────────────────────

// ── LANGKAH 3: DI DALAM KOMPONEN AhspRabStudio(), GANTI STATE ──

// SEBELUM (lokal saja):
/*
export default function AhspRabStudio() {
  const [projectName, setProjectName] = useState('Rumah Tinggal 2 Lantai — Yogyakarta');
  const [materials, setMaterials] = useState(SEED_MATERIALS);
  const [templates, setTemplates] = useState(...);
  const [boq, setBoq] = useState(SEED_BOQ);
  // ... rest of state
*/

// SESUDAH (dengan Firebase):
export default function AhspRabStudio() {
  // Project metadata
  const [projectName, setProjectName] = useState('Rumah Tinggal 2 Lantai — Yogyakarta');
  const [zoneId, setZoneId] = useState('diy');
  const [role, setRole] = useState('ADMIN');
  const [opGlobal, setOpGlobal] = useState(10);
  const [ppn, setPpn] = useState(11);
  const [tab, setTab] = useState('master');
  const [selTplId, setSelTplId] = useState('A01');
  const [importOpen, setImportOpen] = useState(false);
  
  // ✅ STATE YANG TERHUBUNG FIREBASE:
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

  // ─────────────────────────────────────────────────────────────────────────────
  // ✅ LANGKAH 4: TAMBAH useEffect UNTUK REAL-TIME LISTENER
  
  // Sinkronisasi Materials (baca & dengarkan perubahan dari Firestore)
  useEffect(() => {
    const unsubscribeMaterials = subscribeMaterials(PROJECT_ID, (data) => {
      if (data.length > 0) {
        setMaterials(data);
        console.log('✅ Materials sinkron dari Firestore:', data.length, 'item');
      } else {
        // Firestore kosong, pakai seed data
        setMaterials(SEED_MATERIALS);
        console.log('📌 Firestore kosong, pakai seed data');
      }
    });
    return () => unsubscribeMaterials();
  }, []);

  // Sinkronisasi Templates
  useEffect(() => {
    const unsubscribeTemplates = subscribeTemplates(PROJECT_ID, (data) => {
      if (data.length > 0) {
        setTemplates(data.map((t) => ({
          ...t,
          components: (t.components || []).map((c) => ({ ...c, key: c.key || uid('c') })),
        })));
        console.log('✅ Templates sinkron dari Firestore:', data.length, 'template');
      } else {
        // Seed templates
        setTemplates(
          SEED_TEMPLATES.map((t) => ({ ...t, components: t.components.map((c) => ({ ...c, key: uid('c') })) }))
        );
      }
    });
    return () => unsubscribeTemplates();
  }, []);

  // Sinkronisasi BoQ
  useEffect(() => {
    const unsubscribeBoq = subscribeBoq(PROJECT_ID, (data) => {
      if (data.length > 0) {
        setBoq(data);
        console.log('✅ BoQ sinkron dari Firestore:', data.length, 'item');
      } else {
        setBoq(SEED_BOQ);
      }
    });
    return () => unsubscribeBoq();
  }, []);

  // Simpan metadata proyek saat berubah
  useEffect(() => {
    const saveMetadata = async () => {
      try {
        await saveProject(PROJECT_ID, {
          name: projectName,
          zoneId,
          opGlobal,
          ppn,
          ownerId: 'user-123', // Nanti ganti dengan auth.currentUser.uid
          updatedAt: new Date(),
        });
      } catch (err) {
        console.error('Gagal simpan metadata:', err);
      }
    };
    
    // Debounce: tunggu 1 detik setelah user berhenti mengetik
    const timer = setTimeout(saveMetadata, 1000);
    return () => clearTimeout(timer);
  }, [projectName, zoneId, opGlobal, ppn]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ✅ LANGKAH 5: UPDATE MUTATOR FUNCTIONS UNTUK SIMPAN KE FIREBASE

  // Materials
  const updateMaterial = async (id, patch) => {
    // Optimistic update (langsung tampil di UI)
    setMaterials((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    
    // Simpan ke Firestore
    const material = materials.find((m) => m.id === id);
    if (!material) return;
    try {
      await saveMaterial(PROJECT_ID, { ...material, ...patch });
      notify('✅ Material tersimpan');
    } catch (err) {
      notify('❌ Gagal simpan: ' + err.message);
      console.error(err);
    }
  };

  const addMaterial = async () => {
    const id = uid('m');
    const newMaterial = {
      id,
      code: `BHN.${String(materials.length + 1).padStart(3, '0')}`,
      name: 'Material baru',
      unit: 'unit',
      type: 'BAHAN',
      basePrice: 0,
    };
    
    // Optimistic
    setMaterials((ms) => [newMaterial, ...ms]);
    
    // Firebase
    try {
      await saveMaterial(PROJECT_ID, newMaterial);
      notify('✅ Material baru ditambahkan');
    } catch (err) {
      notify('❌ Gagal tambah material');
      console.error(err);
    }
  };

  const removeMaterial = async (id, used) => {
    if (used) {
      notify('⚠️ Tidak bisa dihapus: dipakai template');
      return;
    }
    
    // Optimistic
    setMaterials((ms) => ms.filter((m) => m.id !== id));
    
    // Firebase
    try {
      await deleteMaterial(PROJECT_ID, id);
      notify('✅ Material dihapus');
    } catch (err) {
      notify('❌ Gagal hapus material');
      console.error(err);
    }
  };

  const importMaterials = async (items) => {
    try {
      // Simpan satu per satu ke Firestore (atau bisa batch)
      for (const item of items) {
        await saveMaterial(PROJECT_ID, item);
      }
      setMaterials((ms) => [...items, ...ms]);
      notify(`✅ ${items.length} material berhasil diimpor`);
    } catch (err) {
      notify('❌ Gagal impor material');
      console.error(err);
    }
  };

  // Templates (pola sama)
  const updateTpl = async (id, patch) => {
    setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    try {
      await saveTemplate(PROJECT_ID, { ...tpl, ...patch });
      notify('✅ Template tersimpan');
    } catch (err) {
      console.error(err);
      notify('❌ Gagal simpan template');
    }
  };

  const addCustomTpl = async () => {
    const id = uid('t');
    const n = templates.filter((t) => t.source === 'CUSTOM').length + 1;
    const newTpl = {
      id,
      code: `CST.${String(n).padStart(3, '0')}`,
      ref: 'Analisis sendiri',
      source: 'CUSTOM',
      unit: 'm²',
      name: 'AHSP custom baru',
      components: [],
    };
    
    setTemplates((ts) => [...ts, newTpl]);
    setSelTplId(id);
    
    try {
      await saveTemplate(PROJECT_ID, newTpl);
      notify('✅ Template custom dibuat');
    } catch (err) {
      console.error(err);
      notify('❌ Gagal buat template');
    }
  };

  // BoQ items (pola sama)
  const addBoqItem = async ({ category, ahspId, volume }) => {
    const newItem = { id: uid('b'), category, ahspId, volume, op: null };
    
    setBoq((bs) => [...bs, newItem]);
    
    try {
      await saveBoqItem(PROJECT_ID, newItem);
      notify('✅ Item pekerjaan ditambahkan');
    } catch (err) {
      console.error(err);
      notify('❌ Gagal tambah item');
    }
  };

  const updateBoqItem = async (id, patch) => {
    setBoq((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    const item = boq.find((b) => b.id === id);
    if (!item) return;
    try {
      await saveBoqItem(PROJECT_ID, { ...item, ...patch });
    } catch (err) {
      console.error(err);
    }
  };

  const removeBoqItem = async (id) => {
    setBoq((bs) => bs.filter((b) => b.id !== id));
    try {
      await deleteBoqItem(PROJECT_ID, id);
      notify('✅ Item dihapus');
    } catch (err) {
      console.error(err);
      notify('❌ Gagal hapus item');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SISA KODE TETAP SAMA seperti file original
  // (zone, canEdit, matMap, calcTpl, grouped, dpp, ppnVal, grand, dll)
  // ─────────────────────────────────────────────────────────────────────────────

  const zone = ZONES.find((z) => z.id === zoneId) || ZONES[0];
  const canEdit = role !== 'CLIENT';
  const matMap = useMemo(() => Object.fromEntries(materials.map((m) => [m.id, m])), [materials]);

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

  // Template & mutator lainnya (tplAddComp, tplUpdateComp, dll) tetap sama
  const tplAddComp = (id, type) => {
    const first = materials.find((m) => m.type === type) || materials[0];
    if (!first) return;
    setTemplates((ts) => ts.map((t) => (t.id === id
      ? { ...t, components: [...t.components, { key: uid('c'), materialId: first.id, coef: 1 }] }
      : t)));
  };

  const tplUpdateComp = (id, key, patch) => {
    setTemplates((ts) => ts.map((t) => (t.id === id
      ? { ...t, components: t.components.map((c) => (c.key === key ? { ...c, ...patch } : c)) }
      : t)));
  };

  const tplRemoveComp = (id, key) => {
    setTemplates((ts) => ts.map((t) => (t.id === id
      ? { ...t, components: t.components.filter((c) => c.key !== key) }
      : t)));
  };

  const duplicateTpl = (id) => {
    const src = templates.find((t) => t.id === id);
    if (!src) return;
    const nid = uid('t');
    const n = templates.filter((t) => t.source === 'CUSTOM').length + 1;
    const newTpl = {
      ...src, id: nid, code: `CST.${String(n).padStart(3, '0')}`, source: 'CUSTOM',
      name: `${src.name} (custom)`, ref: `Duplikat dari ${src.code}`,
      components: src.components.map((c) => ({ ...c, key: uid('c') })),
    };
    setTemplates((ts) => [...ts, newTpl]);
    setSelTplId(nid);
    saveTemplate(PROJECT_ID, newTpl).catch(console.error);
  };

  const exportNow = () => {
    try {
      exportRabExcel({ projectName, zone, grouped, ppn, opGlobal, materials });
      notify('✅ File Excel berhasil dibuat & diunduh');
    } catch (err) {
      notify('❌ Gagal ekspor: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

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

/* ════════════════════════════════════════════════════════════════════════════
   RINGKASAN PERUBAHAN:
   
   1. ✅ Tambah import dari './firebase.js'
   2. ✅ Tambah PROJECT_ID = 'proyek-001' (atau ambil dari auth)
   3. ✅ Tambah 3x useEffect untuk subscribe materials, templates, boq
   4. ✅ Update fungsi mutator (updateMaterial, addMaterial, dll) untuk simpan Firebase
   5. ✅ Sisanya tetap sama (Shell, MasterTab, BuilderTab, RabTab, dll)
   
   CATATAN:
   - Untuk production, ganti PROJECT_ID menjadi auth.currentUser.uid
   - Tambahkan error handling yang lebih baik
   - Implementasikan authentication proper (login/register)
   - Update Firestore rules ke mode production (tidak "test mode")
   ════════════════════════════════════════════════════════════════════════════ */
