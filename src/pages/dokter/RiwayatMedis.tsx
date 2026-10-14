import { useEffect, useState } from 'react';
import { supabase, Pemeriksaan } from '@/lib/supabase';
import { Card, Badge, TableWrapper, Th, Td, LoadingSpinner, EmptyState, PageTitle, SearchInput, Pagination, usePagination, Button, Input, Textarea, Modal } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { History, Edit2, Save } from 'lucide-react';
import { formatDate, calcAge } from '@/lib/types';

export default function RiwayatMedis() {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Pemeriksaan[]>([]);
  const [search, setSearch] = useState('');
  const { page, setPage, totalPages, paginated } = usePagination(filtered(), 10);

  // Edit modal state
  const [editModal, setEditModal] = useState(false);
  const [editExam, setEditExam] = useState<Pemeriksaan | null>(null);
  const [editForm, setEditForm] = useState({ anamnesa: '', tekanan_darah: '', suhu: '', berat_badan: '', tinggi_badan: '', diagnosa: '', icd10_kode: '', catatan_dokter: '' });
  const [saving, setSaving] = useState(false);

  function filtered() {
    if (!search) return exams;
    const s = search.toLowerCase();
    return exams.filter((e) => e.kunjungan?.pasien?.nama?.toLowerCase().includes(s) || e.diagnosa?.toLowerCase().includes(s));
  }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('pemeriksaan')
      .select('*, kunjungan(*, pasien(*))')
      .eq('dokter_id', profile?.id)
      .order('tanggal_pemeriksaan', { ascending: false })
      .limit(200);
    setExams((data || []) as Pemeriksaan[]);
    setLoading(false);
  }

  function openEdit(e: Pemeriksaan) {
    setEditExam(e);
    setEditForm({
      anamnesa: e.anamnesa || '',
      tekanan_darah: e.tekanan_darah || '',
      suhu: e.suhu?.toString() || '',
      berat_badan: e.berat_badan?.toString() || '',
      tinggi_badan: e.tinggi_badan?.toString() || '',
      diagnosa: e.diagnosa || '',
      icd10_kode: e.icd10_kode || '',
      catatan_dokter: e.catatan_dokter || '',
    });
    setEditModal(true);
  }

  async function saveEdit() {
    if (!editExam) return;
    if (!editForm.anamnesa || !editForm.diagnosa || !editForm.icd10_kode || !editForm.catatan_dokter) {
      toast('Semua field wajib diisi', 'warning');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('pemeriksaan').update({
      anamnesa: editForm.anamnesa,
      tekanan_darah: editForm.tekanan_darah,
      suhu: editForm.suhu ? parseFloat(editForm.suhu) : null,
      berat_badan: editForm.berat_badan ? parseFloat(editForm.berat_badan) : null,
      tinggi_badan: editForm.tinggi_badan ? parseFloat(editForm.tinggi_badan) : null,
      diagnosa: editForm.diagnosa,
      icd10_kode: editForm.icd10_kode,
      catatan_dokter: editForm.catatan_dokter,
    }).eq('id', editExam.id);

    if (error) {
      toast('Gagal update: ' + error.message, 'error');
    } else {
      toast('Pemeriksaan diperbarui', 'success');
      setEditModal(false);
      load();
    }
    setSaving(false);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageTitle title="Riwayat Rekam Medis" subtitle="Pasien yang pernah Anda periksa" />
      <Card className="p-4 mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Cari nama pasien atau diagnosa..." /></Card>
      <Card className="p-0 overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState icon={History} title="Belum ada riwayat" />
        ) : (
          <TableWrapper>
            <thead><tr><Th>Tanggal</Th><Th>Pasien</Th><Th>Usia</Th><Th>Poli</Th><Th>Diagnosa</Th><Th>ICD-10</Th><Th>Aksi</Th></tr></thead>
            <tbody>
              {paginated.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap">{formatDate(e.tanggal_pemeriksaan)}</Td>
                  <Td className="font-medium text-slate-700">{e.kunjungan?.pasien?.nama || '-'}</Td>
                  <Td>{calcAge(e.kunjungan?.pasien?.tanggal_lahir)} thn</Td>
                  <Td><Badge color="teal">{e.kunjungan?.poli_tujuan || '-'}</Badge></Td>
                  <Td className="max-w-xs truncate">{e.diagnosa || '-'}</Td>
                  <Td className="text-slate-500">{e.icd10_kode || '-'}</Td>
                  <Td>
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg text-sky-500 hover:bg-sky-50">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
        <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
      </Card>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Pemeriksaan" size="lg">
        {editExam && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
              <p className="text-sm font-semibold text-slate-700">{editExam.kunjungan?.pasien?.nama || '-'}</p>
              <p className="text-xs text-slate-500">{editExam.kunjungan?.pasien?.no_rekam_medis || '-'} - {formatDate(editExam.tanggal_pemeriksaan)}</p>
            </div>
            <Textarea label="Anamnesa" value={editForm.anamnesa} onChange={(v) => setEditForm({ ...editForm, anamnesa: v })} rows={3} required />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="Tekanan Darah" value={editForm.tekanan_darah} onChange={(v) => setEditForm({ ...editForm, tekanan_darah: v })} placeholder="120/80" />
              <Input label="Suhu (C)" type="number" value={editForm.suhu} onChange={(v) => setEditForm({ ...editForm, suhu: v })} placeholder="36.5" />
              <Input label="Berat (kg)" type="number" value={editForm.berat_badan} onChange={(v) => setEditForm({ ...editForm, berat_badan: v })} placeholder="60" />
              <Input label="Tinggi (cm)" type="number" value={editForm.tinggi_badan} onChange={(v) => setEditForm({ ...editForm, tinggi_badan: v })} placeholder="170" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Diagnosa" value={editForm.diagnosa} onChange={(v) => setEditForm({ ...editForm, diagnosa: v })} required />
              <Input label="Kode ICD-10" value={editForm.icd10_kode} onChange={(v) => setEditForm({ ...editForm, icd10_kode: v })} required />
            </div>
            <Textarea label="Catatan Dokter" value={editForm.catatan_dokter} onChange={(v) => setEditForm({ ...editForm, catatan_dokter: v })} rows={2} required />
            <div className="flex gap-3 pt-2">
              <Button onClick={saveEdit} disabled={saving} className="flex-1"><Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}</Button>
              <Button variant="secondary" onClick={() => setEditModal(false)}>Batal</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
