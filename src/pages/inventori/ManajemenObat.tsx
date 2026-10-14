import { useEffect, useState } from 'react';
import { supabase, Obat } from '@/lib/supabase';
import { Card, Badge, TableWrapper, Th, Td, SearchInput, LoadingSpinner, EmptyState, PageTitle, Pagination, usePagination, Modal, Input, Select, Button, Combobox, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { Package, Pencil, Trash2, PackagePlus } from 'lucide-react';
import { formatDate, daysUntil, formatCurrency } from '@/lib/types';

const SATUAN_OPTIONS = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'kapsul', label: 'Kapsul' },
  { value: 'botol', label: 'Botol' },
  { value: 'strip', label: 'Strip' },
  { value: 'tube', label: 'Tube' },
  { value: 'ampul', label: 'Ampul' },
];

export default function ManajemenObat() {
  const toast = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [obatList, setObatList] = useState<Obat[]>([]);
  const [search, setSearch] = useState('');

  // Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Obat | null>(null);
  const [deleteItem, setDeleteItem] = useState<Obat | null>(null);
  const [form, setForm] = useState({ nama_obat: '', kategori: '', satuan: 'tablet', stok_saat_ini: '0', stok_minimum: '0', harga: '0', harga_jual: '0', lokasi_rak: '', tanggal_kadaluarsa: '', supplier: '' });

  // Stok masuk modal
  const [stokMasukOpen, setStokMasukOpen] = useState(false);
  const [stokForm, setStokForm] = useState({
    obat_id: '',
    obat_baru: '',
    kode_obat: '',
    jumlah: '',
    tanggal: new Date().toISOString().slice(0, 10),
    no_batch: '',
    supplier: '',
    kategori: '',
    satuan: 'tablet',
    harga_beli: '0',
    harga_jual: '0',
    tanggal_kadaluarsa: '',
    lokasi_rak: '',
  });
  const [supplierList, setSupplierList] = useState<string[]>([]);
  const [kategoriList, setKategoriList] = useState<string[]>([]);
  const [rakList, setRakList] = useState<string[]>([]);
  const [savingStok, setSavingStok] = useState(false);

  const { page, setPage, totalPages, paginated } = usePagination(filtered(), 10);

  function filtered() {
    if (!search) return obatList;
    const s = search.toLowerCase();
    return obatList.filter((o) => o.nama_obat.toLowerCase().includes(s) || o.kategori.toLowerCase().includes(s));
  }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('obat').select('*').order('nama_obat', { ascending: true });
    const list = (data || []) as Obat[];
    setObatList(list);
    const suppliers = new Set<string>();
    const kategoris = new Set<string>();
    const raks = new Set<string>();
    list.forEach((o) => {
      if (o.supplier) suppliers.add(o.supplier);
      if (o.kategori) kategoris.add(o.kategori);
      if (o.lokasi_rak) raks.add(o.lokasi_rak);
    });
    setSupplierList(Array.from(suppliers).sort());
    setKategoriList(Array.from(kategoris).sort());
    setRakList(Array.from(raks).sort());
    setLoading(false);
  }

  function openEdit(o: Obat) {
    setEditItem(o);
    setForm({
      nama_obat: o.nama_obat, kategori: o.kategori, satuan: o.satuan,
      stok_saat_ini: o.stok_saat_ini.toString(), stok_minimum: o.stok_minimum.toString(),
      harga: o.harga.toString(), harga_jual: (o.harga_jual || 0).toString(),
      lokasi_rak: o.lokasi_rak,
      tanggal_kadaluarsa: o.tanggal_kadaluarsa || '', supplier: o.supplier,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.nama_obat.trim()) { toast('Nama obat wajib diisi', 'warning'); return; }
    if (parseInt(form.stok_saat_ini) < 0) { toast('Stok tidak boleh negatif', 'warning'); return; }
    if (parseInt(form.stok_minimum) < 0) { toast('Stok minimum tidak boleh negatif', 'warning'); return; }
    if (parseFloat(form.harga) < 0) { toast('Harga beli tidak boleh negatif', 'warning'); return; }
    if (parseFloat(form.harga_jual) < 0) { toast('Harga jual tidak boleh negatif', 'warning'); return; }

    const payload = {
      nama_obat: form.nama_obat, kategori: form.kategori, satuan: form.satuan,
      stok_saat_ini: parseInt(form.stok_saat_ini) || 0, stok_minimum: parseInt(form.stok_minimum) || 0,
      harga: parseFloat(form.harga) || 0, harga_jual: parseFloat(form.harga_jual) || 0,
      lokasi_rak: form.lokasi_rak,
      tanggal_kadaluarsa: form.tanggal_kadaluarsa || null, supplier: form.supplier,
    };
    if (editItem) {
      const { error } = await supabase.from('obat').update(payload).eq('id', editItem.id);
      if (error) toast('Gagal update: ' + error.message, 'error');
      else toast('Obat diperbarui', 'success');
    }
    setModalOpen(false);
    load();
  }

  async function confirmDelete() {
    if (!deleteItem) return;
    const { error } = await supabase.from('obat').delete().eq('id', deleteItem.id);
    if (error) toast('Gagal hapus: ' + error.message, 'error');
    else toast('Obat dihapus', 'success');
    setDeleteItem(null);
    load();
  }

  function openStokMasuk() {
    setStokForm({
      obat_id: '', obat_baru: '', kode_obat: '', jumlah: '', tanggal: new Date().toISOString().slice(0, 10),
      no_batch: '', supplier: '', kategori: '', satuan: 'tablet', harga_beli: '0', harga_jual: '0',
      tanggal_kadaluarsa: '', lokasi_rak: '',
    });
    setStokMasukOpen(true);
  }

  function onObatChange(obatId: string) {
    if (obatId === '__new__') {
      setStokForm({ ...stokForm, obat_id: '__new__', obat_baru: '', kode_obat: '', kategori: '', satuan: 'tablet', harga_beli: '0', harga_jual: '0', lokasi_rak: '', tanggal_kadaluarsa: '' });
      return;
    }
    const obat = obatList.find((o) => o.id === obatId);
    setStokForm({
      ...stokForm,
      obat_id: obatId,
      obat_baru: '',
      kode_obat: obat?.kode_obat || '',
      kategori: obat?.kategori || '',
      satuan: obat?.satuan || 'tablet',
      harga_beli: obat ? obat.harga.toString() : '0',
      harga_jual: obat ? (obat.harga_jual || 0).toString() : '0',
      lokasi_rak: obat?.lokasi_rak || '',
      tanggal_kadaluarsa: obat?.tanggal_kadaluarsa || '',
      supplier: obat?.supplier || stokForm.supplier,
    });
  }

  async function saveStokMasuk() {
    if (stokForm.obat_id === '__new__' && !stokForm.obat_baru.trim()) { toast('Nama obat baru wajib diisi', 'warning'); return; }
    if (!stokForm.obat_id) { toast('Pilih obat atau pilih "Input Obat Baru"', 'warning'); return; }
    const jumlah = parseInt(stokForm.jumlah);
    if (isNaN(jumlah) || jumlah < 1) { toast('Jumlah harus angka minimal 1', 'warning'); return; }
    if (!stokForm.tanggal) { toast('Tanggal masuk wajib diisi', 'warning'); return; }
    if (parseFloat(stokForm.harga_beli) < 0) { toast('Harga beli tidak boleh negatif', 'warning'); return; }
    if (parseFloat(stokForm.harga_jual) < 0) { toast('Harga jual tidak boleh negatif', 'warning'); return; }
    if (stokForm.tanggal_kadaluarsa && stokForm.tanggal_kadaluarsa < stokForm.tanggal) {
      toast('Tanggal kadaluarsa tidak boleh sebelum tanggal masuk', 'warning'); return;
    }

    setSavingStok(true);
    let obatId = stokForm.obat_id;
    const isNewObat = stokForm.obat_id === '__new__';

    if (isNewObat) {
      const { data: newObat, error: obatErr } = await supabase.from('obat').insert({
        nama_obat: stokForm.obat_baru.trim(),
        kode_obat: stokForm.kode_obat.trim(),
        kategori: stokForm.kategori,
        satuan: stokForm.satuan,
        stok_saat_ini: 0,
        stok_minimum: 0,
        harga: parseFloat(stokForm.harga_beli) || 0,
        harga_jual: parseFloat(stokForm.harga_jual) || 0,
        lokasi_rak: stokForm.lokasi_rak,
        tanggal_kadaluarsa: stokForm.tanggal_kadaluarsa || null,
        supplier: stokForm.supplier,
      }).select().single();
      if (obatErr) { toast('Gagal membuat obat baru: ' + obatErr.message, 'error'); setSavingStok(false); return; }
      obatId = newObat.id;
    }

    const { error } = await supabase.from('stok_masuk').insert({
      obat_id: obatId,
      jumlah: jumlah,
      tanggal: stokForm.tanggal,
      no_batch: stokForm.no_batch,
      supplier: stokForm.supplier,
      petugas_id: profile?.id,
      kategori: stokForm.kategori,
      satuan: stokForm.satuan,
      harga_beli: parseFloat(stokForm.harga_beli) || 0,
      harga_jual: parseFloat(stokForm.harga_jual) || 0,
      tanggal_kadaluarsa: stokForm.tanggal_kadaluarsa || null,
      lokasi_rak: stokForm.lokasi_rak,
    });
    if (error) { toast('Gagal: ' + error.message, 'error'); setSavingStok(false); return; }

    const obat = obatList.find((o) => o.id === obatId);
    await supabase.from('obat').update({
      kategori: stokForm.kategori || obat?.kategori || '',
      satuan: stokForm.satuan || obat?.satuan || 'tablet',
      harga: parseFloat(stokForm.harga_beli) || obat?.harga || 0,
      harga_jual: parseFloat(stokForm.harga_jual) || obat?.harga_jual || 0,
      lokasi_rak: stokForm.lokasi_rak || obat?.lokasi_rak || '',
      tanggal_kadaluarsa: stokForm.tanggal_kadaluarsa || obat?.tanggal_kadaluarsa || null,
      supplier: stokForm.supplier || obat?.supplier || '',
    }).eq('id', obatId);

    await supabase.rpc('record_mutasi', {
      p_obat_id: obatId,
      p_jenis_mutasi: 'masuk',
      p_jumlah: jumlah,
      p_sumber_tujuan: stokForm.supplier || 'Pengadaan',
      p_nomor_batch: stokForm.no_batch,
      p_tanggal_kadaluarsa: stokForm.tanggal_kadaluarsa || null,
      p_keterangan: `Stok masuk - No. Batch: ${stokForm.no_batch || '-'}`,
      p_petugas_id: profile?.id,
      p_petugas_nama: profile?.nama_lengkap || '',
    });

    toast('Stok masuk berhasil dicatat', 'success');
    setStokMasukOpen(false);
    setSavingStok(false);
    load();
  }

  if (loading) return <LoadingSpinner />;

  const obatOptions = [
    { value: '__new__', label: '+ Input Obat Baru' },
    ...obatList.map((o) => ({ value: o.id, label: `${o.nama_obat} (Stok: ${o.stok_saat_ini})` })),
  ];

  return (
    <div>
      <PageTitle title="Manajemen Data Obat" subtitle="Kelola data obat dan catat penerimaan stok dari supplier" />

      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex-1 max-w-md"><SearchInput value={search} onChange={setSearch} placeholder="Cari nama obat atau kategori..." /></div>
        <Button onClick={openStokMasuk}><PackagePlus className="w-4 h-4" /> Input Stok Obat</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState icon={Package} title="Tidak ada obat" />
        ) : (
          <TableWrapper>
            <thead><tr><Th>Nama Obat</Th><Th>Kategori</Th><Th>Satuan</Th><Th>Stok</Th><Th>Min</Th><Th>Harga Beli</Th><Th>Harga Jual</Th><Th>Rak</Th><Th>Kadaluarsa</Th><Th>Aksi</Th></tr></thead>
            <tbody>
              {paginated.map((o) => {
                const days = daysUntil(o.tanggal_kadaluarsa);
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-700">{o.nama_obat}</Td>
                    <Td><Badge color="slate">{o.kategori || '-'}</Badge></Td>
                    <Td>{o.satuan}</Td>
                    <Td><span className={o.stok_saat_ini <= o.stok_minimum ? 'text-rose-600 font-bold' : ''}>{o.stok_saat_ini}</span></Td>
                    <Td className="text-slate-500">{o.stok_minimum}</Td>
                    <Td className="whitespace-nowrap">{formatCurrency(o.harga)}</Td>
                    <Td className="whitespace-nowrap">{formatCurrency(o.harga_jual || 0)}</Td>
                    <Td>{o.lokasi_rak || '-'}</Td>
                    <Td className="whitespace-nowrap">
                      {o.tanggal_kadaluarsa ? (
                        <span className={days !== null && days <= 30 ? 'text-rose-600 font-medium' : ''}>{formatDate(o.tanggal_kadaluarsa)}</span>
                      ) : '-'}
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(o)} className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteItem(o)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        )}
        <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
      </Card>

      {/* Edit/Tambah Obat Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Obat' : 'Tambah Obat'} size="lg">
        <div className="space-y-4">
          <Input label="Nama Obat" value={form.nama_obat} onChange={(v) => setForm({ ...form, nama_obat: v })} required placeholder="Nama obat" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Kategori" value={form.kategori} onChange={(v) => setForm({ ...form, kategori: v })} placeholder="Antibiotik, Analgesik..." />
            <Select label="Satuan" value={form.satuan} onChange={(v) => setForm({ ...form, satuan: v })} options={SATUAN_OPTIONS} />
            <Input label="Stok Saat Ini" type="number" value={form.stok_saat_ini} onChange={(v) => setForm({ ...form, stok_saat_ini: v })} />
            <Input label="Stok Minimum" type="number" value={form.stok_minimum} onChange={(v) => setForm({ ...form, stok_minimum: v })} />
            <Input label="Harga Beli" type="number" value={form.harga} onChange={(v) => setForm({ ...form, harga: v })} />
            <Input label="Harga Jual" type="number" value={form.harga_jual} onChange={(v) => setForm({ ...form, harga_jual: v })} />
            <Input label="Lokasi Rak" value={form.lokasi_rak} onChange={(v) => setForm({ ...form, lokasi_rak: v })} placeholder="A1, B2..." />
            <Input label="Tanggal Kadaluarsa" type="date" value={form.tanggal_kadaluarsa} onChange={(v) => setForm({ ...form, tanggal_kadaluarsa: v })} />
            <Input label="Supplier" value={form.supplier} onChange={(v) => setForm({ ...form, supplier: v })} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={save} className="flex-1">Simpan</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
          </div>
        </div>
      </Modal>

      {/* Input Stok Obat Modal */}
      <Modal open={stokMasukOpen} onClose={() => setStokMasukOpen(false)} title="Input Stok Obat" size="lg">
        <div className="space-y-4">
          <Select label="Obat" value={stokForm.obat_id} onChange={onObatChange} placeholder="Pilih obat atau input baru" required options={obatOptions} />

          {stokForm.obat_id === '__new__' && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-sky-50 border border-sky-200">
              <Input label="Nama Obat Baru" value={stokForm.obat_baru} onChange={(v) => setStokForm({ ...stokForm, obat_baru: v })} required placeholder="Nama obat" />
              <Input label="Kode Obat" value={stokForm.kode_obat} onChange={(v) => setStokForm({ ...stokForm, kode_obat: v })} placeholder="Kode obat (opsional)" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input label="Jumlah" type="number" value={stokForm.jumlah} onChange={(v) => setStokForm({ ...stokForm, jumlah: v })} required />
            <Input label="Tanggal Masuk" type="date" value={stokForm.tanggal} onChange={(v) => setStokForm({ ...stokForm, tanggal: v })} required />
            <Input label="No. Batch" value={stokForm.no_batch} onChange={(v) => setStokForm({ ...stokForm, no_batch: v })} placeholder="Nomor batch" />
            <Combobox label="Kategori" value={stokForm.kategori} onChange={(v) => setStokForm({ ...stokForm, kategori: v })} options={kategoriList} placeholder="Pilih atau ketik kategori" />
            <Select label="Satuan" value={stokForm.satuan} onChange={(v) => setStokForm({ ...stokForm, satuan: v })} options={SATUAN_OPTIONS} />
            <Combobox label="Lokasi Rak" value={stokForm.lokasi_rak} onChange={(v) => setStokForm({ ...stokForm, lokasi_rak: v })} options={rakList} placeholder="Pilih atau ketik lokasi rak" />
            <Input label="Harga Beli" type="number" value={stokForm.harga_beli} onChange={(v) => setStokForm({ ...stokForm, harga_beli: v })} />
            <Input label="Harga Jual" type="number" value={stokForm.harga_jual} onChange={(v) => setStokForm({ ...stokForm, harga_jual: v })} />
            <Input label="Tanggal Kadaluarsa" type="date" value={stokForm.tanggal_kadaluarsa} onChange={(v) => setStokForm({ ...stokForm, tanggal_kadaluarsa: v })} />
          </div>

          <Combobox label="Supplier" value={stokForm.supplier} onChange={(v) => setStokForm({ ...stokForm, supplier: v })} options={supplierList} placeholder="Pilih atau ketik nama supplier" />

          <div className="flex gap-3 pt-2">
            <Button onClick={saveStokMasuk} disabled={savingStok} className="flex-1">{savingStok ? 'Menyimpan...' : 'Simpan'}</Button>
            <Button variant="secondary" onClick={() => setStokMasukOpen(false)}>Batal</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={confirmDelete} title="Hapus Obat" message={`Yakin ingin menghapus "${deleteItem?.nama_obat}"? Tindakan ini tidak dapat dibatalkan.`} confirmLabel="Hapus" />
    </div>
  );
}
