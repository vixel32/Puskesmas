import { useState, useEffect } from 'react';
import { supabase, SuratRujukan, Pemeriksaan, ResepDetail, Profile } from '@/lib/supabase';
import { Card, Input, Textarea, Button, PageTitle, Badge, TableWrapper, Th, Td, LoadingSpinner, EmptyState, Modal, Pagination, usePagination, Select, SearchInput } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { Stethoscope, Printer, Plus, Edit2, ArrowLeft } from 'lucide-react';
import { formatDate, calcAge } from '@/lib/types';

type Mode = 'dokter' | 'pendaftaran' | 'apoteker';

export default function KelolaSuratRujukan({ mode, onNavigate }: { mode: Mode; onNavigate?: (p: string) => void }) {
  const toast = useToast();
  const { profile } = useAuth();
  const canEdit = mode === 'dokter';
  const [loading, setLoading] = useState(true);
  const [rujukanList, setRujukanList] = useState<SuratRujukan[]>([]);
  const [search, setSearch] = useState('');
  const { page, setPage, totalPages, paginated } = usePagination(filtered(), 10);

  // For dokter: list of past examinations to choose from
  const [exams, setExams] = useState<Pemeriksaan[]>([]);
  const [modal, setModal] = useState(false);
  const [editingRujukan, setEditingRujukan] = useState<SuratRujukan | null>(null);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedExam, setSelectedExam] = useState<Pemeriksaan | null>(null);
  const [resepItems, setResepItems] = useState<ResepDetail[]>([]);
  const [form, setForm] = useState({ rs_tujuan: '', poli_tujuan: '', alasan_rujukan: '', diagnosa_sementara: '', tindakan_yang_diberikan: '' });
  const [saving, setSaving] = useState(false);

  function filtered() {
    if (!search) return rujukanList;
    const s = search.toLowerCase();
    return rujukanList.filter((r) =>
      r.pasien?.nama?.toLowerCase().includes(s) ||
      r.rs_tujuan?.toLowerCase().includes(s) ||
      r.diagnosa_sementara?.toLowerCase().includes(s)
    );
  }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    let query = supabase.from('surat_rujukan').select('*, pasien(*), dokter:profiles(*)').order('created_at', { ascending: false });
    if (mode === 'dokter') query = query.eq('dokter_id', profile?.id);
    const { data } = await query;
    setRujukanList((data || []) as SuratRujukan[]);

    if (mode === 'dokter') {
      const { data: examData } = await supabase
        .from('pemeriksaan')
        .select('*, kunjungan(*, pasien(*))')
        .eq('dokter_id', profile?.id)
        .order('tanggal_pemeriksaan', { ascending: false })
        .limit(100);
      setExams((examData || []) as Pemeriksaan[]);
    }
    setLoading(false);
  }

  async function onExamSelect(examId: string) {
    setSelectedExamId(examId);
    const exam = exams.find((e) => e.id === examId) || null;
    setSelectedExam(exam);
    if (exam) {
      // Load resep details for this exam
      const { data: resep } = await supabase
        .from('resep')
        .select('*, resep_detail(*, obat:obat(*))')
        .eq('pemeriksaan_id', exam.id)
        .maybeSingle();
      const items = (resep?.resep_detail || []) as ResepDetail[];
      setResepItems(items);
      const tindakan = items.map((d) => `${d.obat?.nama_obat || ''} ${d.jumlah} ${d.obat?.satuan || ''} - ${d.aturan_pakai || ''}`).filter(Boolean).join('; ');
      setForm({
        rs_tujuan: '',
        poli_tujuan: '',
        alasan_rujukan: '',
        diagnosa_sementara: exam.diagnosa || '',
        tindakan_yang_diberikan: tindakan,
      });
    }
  }

  function openAdd() {
    setEditingRujukan(null);
    setSelectedExamId('');
    setSelectedExam(null);
    setResepItems([]);
    setForm({ rs_tujuan: '', poli_tujuan: '', alasan_rujukan: '', diagnosa_sementara: '', tindakan_yang_diberikan: '' });
    setModal(true);
  }

  function openEdit(r: SuratRujukan) {
    setEditingRujukan(r);
    setSelectedExamId('');
    setSelectedExam(null);
    setResepItems([]);
    setForm({
      rs_tujuan: r.rs_tujuan,
      poli_tujuan: r.poli_tujuan,
      alasan_rujukan: r.alasan_rujukan,
      diagnosa_sementara: r.diagnosa_sementara,
      tindakan_yang_diberikan: r.tindakan_yang_diberikan,
    });
    setModal(true);
  }

  async function save() {
    if (!form.rs_tujuan || !form.alasan_rujukan || !form.diagnosa_sementara) {
      toast('RS tujuan, diagnosa, dan alasan rujukan wajib diisi', 'warning');
      return;
    }

    setSaving(true);

    if (editingRujukan) {
      const { error } = await supabase.from('surat_rujukan').update({
        rs_tujuan: form.rs_tujuan,
        poli_tujuan: form.poli_tujuan,
        alasan_rujukan: form.alasan_rujukan,
        diagnosa_sementara: form.diagnosa_sementara,
        tindakan_yang_diberikan: form.tindakan_yang_diberikan,
      }).eq('id', editingRujukan.id);
      if (error) toast('Gagal: ' + error.message, 'error');
      else { toast('Surat rujukan diperbarui', 'success'); setModal(false); load(); }
    } else {
      if (!selectedExam?.kunjungan_id || !selectedExam?.kunjungan?.pasien_id) {
        toast('Pilih pemeriksaan terlebih dahulu', 'warning'); setSaving(false); return;
      }
      const { error } = await supabase.from('surat_rujukan').insert({
        kunjungan_id: selectedExam.kunjungan_id,
        pasien_id: selectedExam.kunjungan.pasien_id,
        dokter_id: profile?.id,
        rs_tujuan: form.rs_tujuan,
        poli_tujuan: form.poli_tujuan,
        alasan_rujukan: form.alasan_rujukan,
        diagnosa_sementara: form.diagnosa_sementara,
        tindakan_yang_diberikan: form.tindakan_yang_diberikan,
        tanda_tangan_digital: profile?.tanda_tangan_digital || profile?.nama_lengkap || '',
        status: 'aktif',
        sudah_dicetak: false,
      });
      if (error) toast('Gagal: ' + error.message, 'error');
      else { toast('Surat rujukan dibuat', 'success'); setModal(false); load(); }
    }
    setSaving(false);
  }

  async function printRujukan(r: SuratRujukan) {
    await supabase.from('surat_rujukan').update({ sudah_dicetak: true }).eq('id', r.id);
    setRujukanList((prev) => prev.map((x) => x.id === r.id ? { ...x, sudah_dicetak: true } : x));

    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) { toast('Popup diblokir browser', 'error'); return; }

    const html = `
<!DOCTYPE html><html><head><title>Surat Rujukan</title>
<style>
  @page { size: A4; margin: 25mm; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.8; color: #000; }
  .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 20px; }
  .header h1 { font-size: 16pt; margin: 0; }
  .header p { font-size: 10pt; margin: 2px 0; }
  .title { text-align: center; font-size: 14pt; font-weight: bold; text-decoration: underline; margin: 25px 0 20px; }
  .body p { margin: 8px 0; }
  .signature { margin-top: 40px; text-align: right; }
  .signature .box { display: inline-block; text-align: center; }
  .signature .name { font-weight: bold; text-decoration: underline; margin-top: 60px; }
  .stamp { margin-top: 10px; font-size: 10pt; font-style: italic; color: #555; }
  table.info { width: 100%; margin: 15px 0; }
  table.info td { padding: 2px 0; }
  table.info td:first-child { width: 140px; }
  .section { margin: 12px 0; }
  .section-title { font-weight: bold; text-decoration: underline; }
</style></head><body>
  <div class="header">
    <h1>PUSKESMAS SEHAT SENTOSA</h1>
    <p>Jl. Kesehatan No. 1, Kec. Sehat, Kab. Sentosa</p>
    <p>Telp. (021) 1234567 - Email: puskesmas@sehat.go.id</p>
  </div>
  <div class="title">SURAT RUJUKAN PASIEN</div>
  <div class="body">
    <p>Yang bertanda tangan di bawah ini, dokter Puskesmas Sehat Sentosa, merujuk pasien kepada:</p>
    <table class="info">
      <tr><td><b>Nama Pasien</b></td><td>: ${r.pasien?.nama || '-'}</td></tr>
      <tr><td><b>No. Rekam Medis</b></td><td>: ${r.pasien?.no_rekam_medis || '-'}</td></tr>
      <tr><td><b>Umur</b></td><td>: ${calcAge(r.pasien?.tanggal_lahir)} tahun</td></tr>
      <tr><td><b>Jenis Kelamin</b></td><td>: ${r.pasien?.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td></tr>
      <tr><td><b>Alamat</b></td><td>: ${r.pasien?.alamat || '-'}</td></tr>
    </table>
    <div class="section">
      <p class="section-title">Ke Rumah Sakit / Klinik Tujuan:</p>
      <p style="margin-left: 40px;"><b>${r.rs_tujuan}</b>${r.poli_tujuan ? ' - Poli ' + r.poli_tujuan : ''}</p>
    </div>
    <div class="section">
      <p class="section-title">Diagnosa Sementara:</p>
      <p style="margin-left: 40px;">${r.diagnosa_sementara || '-'}</p>
    </div>
    <div class="section">
      <p class="section-title">Tindakan yang Telah Diberikan:</p>
      <p style="margin-left: 40px;">${r.tindakan_yang_diberikan || '-'}</p>
    </div>
    <div class="section">
      <p class="section-title">Alasan Rujukan:</p>
      <p style="margin-left: 40px;">${r.alasan_rujukan}</p>
    </div>
    <p>Demikian surat rujukan ini dibuat untuk dipergunakan sebagaimana mestinya.</p>
  </div>
  <div class="signature">
    <div class="box">
      <p>Sentosa, ${formatDate(r.created_at)}</p>
      <p>Dokter Pemeriksa</p>
      <div class="name">${r.tanda_tangan_digital || r.dokter?.nama_lengkap || ''}</div>
      <p class="stamp">[Tanda Tangan Digital]</p>
    </div>
  </div>
</body></html>`;

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {onNavigate && (
        <button onClick={() => onNavigate(mode)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
      )}
      <PageTitle
        title={canEdit ? 'Kelola Surat Rujukan' : 'Surat Rujukan'}
        subtitle={canEdit ? 'Buat dan kelola surat rujukan pasien' : 'Lihat dan cetak surat rujukan'}
      />

      <Card className="p-4 mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Cari nama pasien, RS tujuan, diagnosa..." /></Card>

      <Card className="p-0 overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState icon={Stethoscope} title="Tidak ada surat rujukan" />
        ) : (
          <TableWrapper>
            <thead><tr><Th>Tanggal</Th><Th>Pasien</Th><Th>RS Tujuan</Th><Th>Diagnosa</Th><Th>Dokter</Th><Th>Status</Th><Th>Aksi</Th></tr></thead>
            <tbody>
              {paginated.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap">{formatDate(r.created_at)}</Td>
                  <Td className="font-medium text-slate-700">{r.pasien?.nama || '-'}</Td>
                  <Td className="text-slate-600">{r.rs_tujuan}{r.poli_tujuan ? ' (' + r.poli_tujuan + ')' : ''}</Td>
                  <Td className="max-w-xs truncate text-slate-500">{r.diagnosa_sementara || '-'}</Td>
                  <Td className="text-slate-500">{r.dokter?.nama_lengkap || '-'}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Badge color={r.status === 'aktif' ? 'emerald' : 'rose'}>{r.status === 'aktif' ? 'Aktif' : 'Dibatalkan'}</Badge>
                      {r.sudah_dicetak && <Badge color="slate">Dicetak</Badge>}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => printRujukan(r)}><Printer className="w-4 h-4" /> Cetak</Button>
                      {canEdit && <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-sky-500 hover:bg-sky-50"><Edit2 className="w-4 h-4" /></button>}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
        <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
      </Card>

      {canEdit && (
        <div className="mt-4">
          <Button onClick={openAdd}><Plus className="w-4 h-4" /> Buat Surat Rujukan</Button>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editingRujukan ? 'Edit Surat Rujukan' : 'Buat Surat Rujukan'} size="lg">
        <div className="space-y-4">
          {!editingRujukan && (
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1.5 block">Pilih dari Riwayat Pemeriksaan <span className="text-rose-500">*</span></label>
              <select
                value={selectedExamId}
                onChange={(e) => onExamSelect(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="">-- Pilih pemeriksaan --</option>
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.kunjungan?.pasien?.nama || 'Pasien'} - {formatDate(e.tanggal_pemeriksaan)} - {e.diagnosa || 'No diagnosa'}
                  </option>
                ))}
              </select>
              {selectedExam && (
                <div className="mt-2 p-3 rounded-xl bg-sky-50 border border-sky-200 space-y-1">
                  <p className="text-xs text-slate-600"><b>Pasien:</b> {selectedExam.kunjungan?.pasien?.nama || '-'}</p>
                  <p className="text-xs text-slate-600"><b>Diagnosa:</b> {selectedExam.diagnosa || '-'}</p>
                  <p className="text-xs text-slate-600"><b>ICD-10:</b> {selectedExam.icd10_kode || '-'}</p>
                  <p className="text-xs text-slate-600"><b>Obat diberikan:</b> {resepItems.map((d) => `${d.obat?.nama_obat || ''} (${d.jumlah})`).join(', ') || 'Tidak ada'}</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Rumah Sakit / Klinik Tujuan" value={form.rs_tujuan} onChange={(v) => setForm({ ...form, rs_tujuan: v })} placeholder="RS Sehat Sentosa" required />
            <Input label="Poli Tujuan" value={form.poli_tujuan} onChange={(v) => setForm({ ...form, poli_tujuan: v })} placeholder="Poli Penyakit Dalam" />
          </div>
          <Textarea label="Diagnosa Sementara" value={form.diagnosa_sementara} onChange={(v) => setForm({ ...form, diagnosa_sementara: v })} rows={2} required />
          <Textarea label="Tindakan yang Telah Diberikan" value={form.tindakan_yang_diberikan} onChange={(v) => setForm({ ...form, tindakan_yang_diberikan: v })} rows={2} placeholder="Obat yang diberikan, pertolongan pertama, dll" />
          <Textarea label="Alasan Rujukan" value={form.alasan_rujukan} onChange={(v) => setForm({ ...form, alasan_rujukan: v })} rows={3} placeholder="Memerlukan penanganan lebih lanjut" required />
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-100">
            <p className="text-xs text-rose-700">
              Surat akan ditandatangani secara digital: <b>{profile?.tanda_tangan_digital || profile?.nama_lengkap}</b>
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={save} disabled={saving} className="flex-1"><Stethoscope className="w-4 h-4" /> {saving ? 'Menyimpan...' : editingRujukan ? 'Perbarui' : 'Buat Surat Rujukan'}</Button>
            <Button variant="secondary" onClick={() => setModal(false)}>Batal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
