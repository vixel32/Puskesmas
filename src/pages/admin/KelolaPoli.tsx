import { useState, useEffect } from 'react';
import { supabase, Poli } from '@/lib/supabase';
import { Card, Input, Textarea, Button, PageTitle, Badge, TableWrapper, Th, Td, LoadingSpinner, EmptyState, Modal, Pagination, usePagination, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { Plus, Edit2, Trash2, Building2 } from 'lucide-react';
import { formatDate } from '@/lib/types';

export default function KelolaPoli() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [poliList, setPoliList] = useState<Poli[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Poli | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Poli | null>(null);
  const [form, setForm] = useState({ nama_poli: '', kode_poli: '', keterangan: '' });
  const [saving, setSaving] = useState(false);
  const { page, setPage, totalPages, paginated } = usePagination(filtered(), 10);

  function filtered() {
    if (!search) return poliList;
    const s = search.toLowerCase();
    return poliList.filter((p) => p.nama_poli.toLowerCase().includes(s) || p.kode_poli.toLowerCase().includes(s));
  }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('poli').select('*').order('nama_poli', { ascending: true });
    setPoliList((data || []) as Poli[]);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ nama_poli: '', kode_poli: '', keterangan: '' });
    setModal(true);
  }

  function openEdit(p: Poli) {
    setEditing(p);
    setForm({ nama_poli: p.nama_poli, kode_poli: p.kode_poli, keterangan: p.keterangan });
    setModal(true);
  }

  async function save() {
    if (!form.nama_poli) { toast('Nama poli wajib diisi', 'warning'); return; }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('poli').update({
        nama_poli: form.nama_poli, kode_poli: form.kode_poli, keterangan: form.keterangan,
      }).eq('id', editing.id);
      if (error) toast('Gagal: ' + error.message, 'error');
      else { toast('Poli diperbarui', 'success'); setModal(false); load(); }
    } else {
      const { error } = await supabase.from('poli').insert({
        nama_poli: form.nama_poli, kode_poli: form.kode_poli, keterangan: form.keterangan, aktif: true,
      });
      if (error) toast('Gagal: ' + error.message, 'error');
      else { toast('Poli ditambahkan', 'success'); setModal(false); load(); }
    }
    setSaving(false);
  }

  async function toggleAktif(p: Poli) {
    const { error } = await supabase.from('poli').update({ aktif: !p.aktif }).eq('id', p.id);
    if (error) toast('Gagal: ' + error.message, 'error');
    else { toast(`Poli ${p.nama_poli} ${!p.aktif ? 'diaktifkan' : 'dinonaktifkan'}`, 'success'); load(); }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('poli').delete().eq('id', deleteTarget.id);
    if (error) toast('Gagal: ' + error.message, 'error');
    else { toast('Poli dihapus', 'success'); setDeleteTarget(null); load(); }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageTitle title="Kelola Poli" subtitle="Tambah, edit, dan hapus poli tujuan" />
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari poli..."
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 max-w-xs flex-1"
        />
        <Button onClick={openAdd}><Plus className="w-4 h-4" /> Tambah Poli</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState icon={Building2} title="Tidak ada poli" />
        ) : (
          <TableWrapper>
            <thead><tr><Th>Nama Poli</Th><Th>Kode</Th><Th>Keterangan</Th><Th>Status</Th><Th>Dibuat</Th><Th>Aksi</Th></tr></thead>
            <tbody>
              {paginated.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-700">{p.nama_poli}</Td>
                  <Td className="font-mono text-slate-500">{p.kode_poli || '-'}</Td>
                  <Td className="text-slate-500 max-w-xs truncate">{p.keterangan || '-'}</Td>
                  <Td>
                    <button onClick={() => toggleAktif(p)}>
                      <Badge color={p.aktif ? 'emerald' : 'rose'}>{p.aktif ? 'Aktif' : 'Nonaktif'}</Badge>
                    </button>
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">{formatDate(p.created_at)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-sky-500 hover:bg-sky-50"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
        <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Poli' : 'Tambah Poli'}>
        <div className="space-y-4">
          <Input label="Nama Poli" value={form.nama_poli} onChange={(v) => setForm({ ...form, nama_poli: v })} placeholder="Umum" required />
          <Input label="Kode Poli" value={form.kode_poli} onChange={(v) => setForm({ ...form, kode_poli: v })} placeholder="UM" />
          <Textarea label="Keterangan" value={form.keterangan} onChange={(v) => setForm({ ...form, keterangan: v })} rows={2} placeholder="Keterangan poli (opsional)" />
          <div className="flex gap-3 pt-2">
            <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Menyimpan...' : 'Simpan'}</Button>
            <Button variant="secondary" onClick={() => setModal(false)}>Batal</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title="Hapus Poli"
        message={`Hapus poli "${deleteTarget?.nama_poli}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
      />
    </div>
  );
}
