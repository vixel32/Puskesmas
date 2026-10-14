import { useEffect, useState } from 'react';
import { supabase, Obat, DistribusiObat } from '@/lib/supabase';
import { Card, Badge, Button, Input, Select, Textarea, LoadingSpinner, EmptyState, PageTitle, TableWrapper, Th, Td, SearchInput, Pagination, usePagination, Modal } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { Package, Plus, Search, Send, Trash2 } from 'lucide-react';
import { formatDate, JENIS_TUJUAN_DISTRIBUSI } from '@/lib/types';

type ItemDipilih = {
  obat: Obat;
  jumlah: string;
};

export default function DistribusiObatPage() {
  const toast = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<DistribusiObat[]>([]);
  const [obatList, setObatList] = useState<Obat[]>([]);
  const [search, setSearch] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tujuan, setTujuan] = useState('');
  const [jenisTujuan, setJenisTujuan] = useState<string>('Posyandu');
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [keterangan, setKeterangan] = useState('');
  const [items, setItems] = useState<ItemDipilih[]>([]);
  const [obatSearch, setObatSearch] = useState('');
  const [obatResults, setObatResults] = useState<Obat[]>([]);
  const { page, setPage, totalPages, paginated } = usePagination(filtered(), 15);

  function filtered() {
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter((d) =>
      d.tujuan?.toLowerCase().includes(s) ||
      d.obat?.nama_obat?.toLowerCase().includes(s) ||
      d.jenis_tujuan?.toLowerCase().includes(s)
    );
  }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [distRes, obatRes] = await Promise.all([
      supabase.from('distribusi_obat').select('*, obat:obat(*), profiles(*)').order('tanggal', { ascending: false }).limit(200),
      supabase.from('obat').select('*').order('nama_obat', { ascending: true }),
    ]);
    setList((distRes.data || []) as DistribusiObat[]);
    setObatList((obatRes.data || []) as Obat[]);
    setLoading(false);
  }

  useEffect(() => {
    if (obatSearch.length >= 2) {
      const s = obatSearch.toLowerCase();
      const already = new Set(items.map((i) => i.obat.id));
      setObatResults(obatList.filter((o) => o.nama_obat.toLowerCase().includes(s) && !already.has(o.id)).slice(0, 10));
    } else {
      setObatResults([]);
    }
  }, [obatSearch, obatList, items]);

  function addItem(obat: Obat) {
    setItems([...items, { obat, jumlah: '1' }]);
    setObatSearch('');
    setObatResults([]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateJumlah(index: number, jumlah: string) {
    setItems(items.map((it, i) => i === index ? { ...it, jumlah } : it));
  }

  function resetForm() {
    setTujuan('');
    setJenisTujuan('Posyandu');
    setTanggal(new Date().toISOString().split('T')[0]);
    setKeterangan('');
    setItems([]);
    setObatSearch('');
    setObatResults([]);
  }

  async function save() {
    if (items.length === 0) { toast('Pilih minimal satu obat', 'warning'); return; }
    if (!tujuan.trim()) { toast('Isi tujuan distribusi', 'warning'); return; }

    for (let i = 0; i < items.length; i++) {
      const j = parseInt(items[i].jumlah);
      if (isNaN(j) || j < 1) { toast(`Jumlah untuk ${items[i].obat.nama_obat} minimal 1`, 'warning'); return; }
      if (j > items[i].obat.stok_saat_ini) {
        toast(`Stok ${items[i].obat.nama_obat} tidak cukup. Tersedia: ${items[i].obat.stok_saat_ini}`, 'warning'); return;
      }
    }

    setSaving(true);
    const inserts = items.map((it) => ({
      obat_id: it.obat.id,
      jumlah: parseInt(it.jumlah),
      tujuan: tujuan,
      jenis_tujuan: jenisTujuan,
      tanggal: tanggal,
      petugas_id: profile?.id,
      keterangan: keterangan,
    }));

    const { error } = await supabase.from('distribusi_obat').insert(inserts);
    if (error) {
      toast('Gagal menyimpan: ' + error.message, 'error');
      setSaving(false);
      return;
    }

    // Record mutasi keluar via RPC (FEFO + log_mutasi + obat update)
    const failedItems: string[] = [];
    await Promise.all(items.map(async (it) => {
      const j = parseInt(it.jumlah);
      const { data: result, error: mutasiErr } = await supabase.rpc('record_mutasi', {
        p_obat_id: it.obat.id,
        p_jenis_mutasi: 'keluar',
        p_jumlah: j,
        p_sumber_tujuan: `${jenisTujuan} - ${tujuan}`,
        p_keterangan: keterangan || `Distribusi ke ${tujuan}`,
        p_petugas_id: profile?.id,
        p_petugas_nama: profile?.nama_lengkap || '',
      });
      if (mutasiErr || (result && !(result as any).success)) {
        failedItems.push(it.obat.nama_obat);
      }
    }));

    if (failedItems.length > 0) {
      toast(`Distribusi tersimpan, tapi stok obat berikut gagal diperbarui: ${failedItems.join(', ')}`, 'warning');
    } else {
      toast(`${items.length} obat berhasil didistribusikan ke ${tujuan}`, 'success');
    }
    setAddModal(false);
    resetForm();
    setSaving(false);
    load();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageTitle title="Distribusi Obat" subtitle="Distribusi obat ke posyandu, puskesmas pembantu, dll" />

      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex-1 max-w-md">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari obat atau tujuan..." />
        </div>
        <Button onClick={() => { resetForm(); setAddModal(true); }}><Plus className="w-4 h-4" /> Distribusi Obat</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState icon={Package} title="Tidak ada distribusi" subtitle="Belum ada obat yang didistribusikan" />
        ) : (
          <TableWrapper>
            <thead><tr><Th>Tanggal</Th><Th>Obat</Th><Th>Jumlah</Th><Th>Tujuan</Th><Th>Jenis</Th><Th>Petugas</Th><Th>Keterangan</Th></tr></thead>
            <tbody>
              {paginated.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap">{formatDate(d.tanggal)}</Td>
                  <Td className="font-medium text-slate-700">{d.obat?.nama_obat || '-'}</Td>
                  <Td><span className="text-sky-600 font-bold">{d.jumlah}</span> {d.obat?.satuan || ''}</Td>
                  <Td className="text-slate-600">{d.tujuan}</Td>
                  <Td><Badge color="sky">{d.jenis_tujuan}</Badge></Td>
                  <Td className="text-slate-500">{d.profiles?.nama_lengkap || '-'}</Td>
                  <Td className="text-slate-500 text-xs">{d.keterangan || '-'}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
        <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
      </Card>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Distribusi Obat" size="lg">
        <div className="space-y-4">
          {/* Obat search */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Cari & Tambah Obat</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={obatSearch}
                onChange={(e) => setObatSearch(e.target.value)}
                placeholder="Cari nama obat untuk ditambahkan..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none text-sm"
              />
            </div>
            {obatResults.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto mt-2">
                {obatResults.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => addItem(o)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-sky-50 hover:border-sky-300 text-left transition-all"
                  >
                    <div>
                      <p className="font-semibold text-slate-700">{o.nama_obat}</p>
                      <p className="text-xs text-slate-500">{o.kategori} • {o.satuan}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={o.stok_saat_ini > o.stok_minimum ? 'emerald' : 'rose'}>Stok: {o.stok_saat_ini}</Badge>
                      <Plus className="w-4 h-4 text-sky-500" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected items list */}
          {items.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-600">Obat Dipilih ({items.length})</label>
              {items.map((it, idx) => (
                <div key={it.obat.id} className="flex items-center gap-3 p-3 rounded-xl bg-sky-50 border border-sky-200">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-700 text-sm">{it.obat.nama_obat}</p>
                    <p className="text-xs text-slate-500">Stok: {it.obat.stok_saat_ini} {it.obat.satuan}</p>
                  </div>
                  <input
                    type="number"
                    value={it.jumlah}
                    onChange={(e) => updateJumlah(idx, e.target.value)}
                    placeholder="Jumlah"
                    className="w-24 px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none text-sm text-slate-700"
                  />
                  <button onClick={() => removeItem(idx)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Jenis Tujuan"
              value={jenisTujuan}
              onChange={setJenisTujuan}
              options={JENIS_TUJUAN_DISTRIBUSI.map((j) => ({ value: j, label: j }))}
              required
            />
            <Input label="Tanggal" type="date" value={tanggal} onChange={setTanggal} required />
          </div>

          <Input
            label="Tujuan Distribusi"
            value={tujuan}
            onChange={setTujuan}
            placeholder="contoh: Posyandu Anggrek"
            required
          />

          <Textarea label="Keterangan" value={keterangan} onChange={setKeterangan} rows={2} placeholder="Catatan tambahan..." />

          <div className="flex gap-3 pt-2">
            <Button onClick={save} disabled={saving} className="flex-1">
              <Send className="w-4 h-4" /> {saving ? 'Menyimpan...' : `Distribusi ${items.length} Obat`}
            </Button>
            <Button variant="secondary" onClick={() => setAddModal(false)}>Batal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
