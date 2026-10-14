import { useState, useEffect } from 'react';
import { supabase, SuratKeteranganSakit, Pemeriksaan } from '@/lib/supabase';
import { Card, Input, Textarea, Button, PageTitle, Badge, TableWrapper, Th, Td, LoadingSpinner, EmptyState, Modal, Pagination, usePagination, SearchInput } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { FileSignature, Printer, Plus, Edit2, ArrowLeft } from 'lucide-react';
import { formatDate, calcAge } from '@/lib/types';

type Mode = 'dokter' | 'pendaftaran';

export default function KelolaSuratKeteranganSakit({ mode, onNavigate }: { mode: Mode; onNavigate?: (p: string) => void }) {
  const toast = useToast();
  const { profile } = useAuth();
  const canEdit = mode === 'dokter';
  const [loading, setLoading] = useState(true);
  const [sksList, setSksList] = useState<SuratKeteranganSakit[]>([]);
  const [search, setSearch] = useState('');
  const { page, setPage, totalPages, paginated } = usePagination(filtered(), 10);

  // For dokter: list of past examinations to choose from
  const [exams, setExams] = useState<Pemeriksaan[]>([]);
  const [modal, setModal] = useState(false);
  const [editingSks, setEditingSks] = useState<SuratKeteranganSakit | null>(null);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedExam, setSelectedExam] = useState<Pemeriksaan | null>(null);
  const [form, setForm] = useState({ hari_sakit: '1', tanggal_mulai: '', diagnosa: '' });
  const [saving, setSaving] = useState(false);

  function filtered() {
    if (!search) return sksList;
    const s = search.toLowerCase();
    return sksList.filter((r) =>
      r.pasien?.nama?.toLowerCase().includes(s) ||
      r.diagnosa?.toLowerCase().includes(s)
    );
  }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    let query = supabase.from('surat_keterangan_sakit').select('*, pasien(*), dokter:profiles(*)').order('created_at', { ascending: false });
    if (mode === 'dokter') query = query.eq('dokter_id', profile?.id);
    const { data } = await query;
    setSksList((data || []) as SuratKeteranganSakit[]);

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
      setForm((prev) => ({ ...prev, diagnosa: exam.diagnosa || '' }));
    }
  }

  function openAdd() {
    setEditingSks(null);
    setSelectedExamId('');
    setSelectedExam(null);
    setForm({ hari_sakit: '1', tanggal_mulai: '', diagnosa: '' });
    setModal(true);
  }

  function openEdit(sks: SuratKeteranganSakit) {
    setEditingSks(sks);
    setSelectedExamId('');
    setSelectedExam(null);
    setForm({
      hari_sakit: sks.hari_sakit?.toString() || '1',
      tanggal_mulai: sks.tanggal_mulai || '',
      diagnosa: sks.diagnosa || '',
    });
    setModal(true);
  }

  async function save() {
    if (!form.hari_sakit || !form.tanggal_mulai || !form.diagnosa) {
      toast('Hari sakit, tanggal mulai, dan diagnosa wajib diisi', 'warning');
      return;
    }

    setSaving(true);
    const hari = parseInt(form.hari_sakit);
    const mulai = new Date(form.tanggal_mulai);
    const selesai = new Date(mulai);
    selesai.setDate(selesai.getDate() + hari - 1);
    const tanggalSelesai = selesai.toISOString().split('T')[0];

    if (editingSks) {
      const { error } = await supabase.from('surat_keterangan_sakit').update({
        hari_sakit: hari,
        tanggal_mulai: form.tanggal_mulai,
        tanggal_selesai: tanggalSelesai,
        diagnosa: form.diagnosa,
      }).eq('id', editingSks.id);
      if (error) toast('Gagal: ' + error.message, 'error');
      else { toast('Surat keterangan sakit diperbarui', 'success'); setModal(false); load(); }
    } else {
      if (!selectedExam?.kunjungan_id || !selectedExam?.kunjungan?.pasien_id) {
        toast('Pilih pemeriksaan terlebih dahulu', 'warning'); setSaving(false); return;
      }
      const { error } = await supabase.from('surat_keterangan_sakit').insert({
        kunjungan_id: selectedExam.kunjungan_id,
        pasien_id: selectedExam.kunjungan.pasien_id,
        dokter_id: profile?.id,
        hari_sakit: hari,
        tanggal_mulai: form.tanggal_mulai,
        tanggal_selesai: tanggalSelesai,
        diagnosa: form.diagnosa,
        tanda_tangan_digital: profile?.tanda_tangan_digital || profile?.nama_lengkap || '',
        status: 'aktif',
        sudah_dicetak: false,
      });
      if (error) toast('Gagal: ' + error.message, 'error');
      else { toast('Surat keterangan sakit dibuat', 'success'); setModal(false); load(); }
    }
    setSaving(false);
  }

  async function printSks(sks: SuratKeteranganSakit) {
    await supabase.from('surat_keterangan_sakit').update({ sudah_dicetak: true }).eq('id', sks.id);
    setSksList((prev) => prev.map((x) => x.id === sks.id ? { ...x, sudah_dicetak: true } : x));

    const dokterNama = sks.dokter?.nama_lengkap || sks.tanda_tangan_digital || '-';
    const dokterNik = sks.dokter?.nik || '';

    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) { toast('Popup diblokir browser', 'error'); return; }

    const html = `
<!DOCTYPE html><html><head><title>Surat Keterangan Sakit</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.min.js"></script>
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
  table.info td:first-child { width: 120px; }
  .barcode-section { margin-top: 15px; text-align: center; }
  .barcode-section svg { max-width: 250px; }
  .dokter-info { font-size: 10pt; margin-top: 5px; }
</style></head><body>
  <div class="header">
    <h1>PUSKESMAS SEHAT SENTOSA</h1>
    <p>Jl. Kesehatan No. 1, Kec. Sehat, Kab. Sentosa</p>
    <p>Telp. (021) 1234567 - Email: puskesmas@sehat.go.id</p>
  </div>
  <div class="title">SURAT KETERANGAN SAKIT</div>
  <div class="body">
    <p>Yang bertanda tangan di bawah ini, dokter Puskesmas Sehat Sentosa, menerangkan bahwa:</p>
    <table class="info">
      <tr><td><b>Nama</b></td><td>: ${sks.pasien?.nama || '-'}</td></tr>
      <tr><td><b>No. Rekam Medis</b></td><td>: ${sks.pasien?.no_rekam_medis || '-'}</td></tr>
      <tr><td><b>Umur</b></td><td>: ${calcAge(sks.pasien?.tanggal_lahir)} tahun</td></tr>
      <tr><td><b>Jenis Kelamin</b></td><td>: ${sks.pasien?.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td></tr>
      <tr><td><b>Alamat</b></td><td>: ${sks.pasien?.alamat || '-'}</td></tr>
    </table>
    <p>Berdasarkan hasil pemeriksaan, yang bersangkutan didiagnosa menderita:</p>
    <p style="margin-left: 40px;"><b>${sks.diagnosa || '-'}</b></p>
    <p>Oleh karena itu, yang bersangkutan memerlukan istirahat selama <b>${sks.hari_sakit} hari</b>, terhitung sejak tanggal <b>${formatDate(sks.tanggal_mulai)}</b> sampai dengan tanggal <b>${formatDate(sks.tanggal_selesai)}</b>.</p>
    <p>Surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.</p>
  </div>
  <div class="signature">
    <div class="box">
      <p>Sentosa, ${formatDate(sks.created_at)}</p>
      <p>Dokter Pemeriksa</p>
      <div class="name">${dokterNama}</div>
      ${dokterNik ? `<div class="barcode-section"><svg id="barcode"></svg><div class="dokter-info">NIK: ${dokterNik}</div></div>` : '<p class="stamp">[Tanda Tangan Digital]</p>'}
    </div>
  </div>
  <script>
    window.onload = function() {
      var nik = "${dokterNik}";
      if (nik && document.getElementById("barcode")) {
        try {
          JsBarcode("#barcode", nik, {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: false,
            margin: 0
          });
        } catch(e) { console.log("Barcode error:", e); }
      }
    };
  </script>
</body></html>`;

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 800);
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
        title={canEdit ? 'Kelola Surat Keterangan Sakit' : 'Surat Keterangan Sakit'}
        subtitle={canEdit ? 'Buat dan kelola surat keterangan sakit pasien' : 'Lihat dan cetak surat keterangan sakit'}
      />

      <Card className="p-4 mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Cari nama pasien atau diagnosa..." /></Card>

      <Card className="p-0 overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState icon={FileSignature} title="Tidak ada surat keterangan sakit" />
        ) : (
          <TableWrapper>
            <thead><tr><Th>Tanggal</Th><Th>Pasien</Th><Th>Hari Sakit</Th><Th>Periode</Th><Th>Diagnosa</Th><Th>Dokter</Th><Th>Status</Th><Th>Aksi</Th></tr></thead>
            <tbody>
              {paginated.map((sks) => (
                <tr key={sks.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap">{formatDate(sks.created_at)}</Td>
                  <Td className="font-medium text-slate-700">{sks.pasien?.nama || '-'}</Td>
                  <Td><Badge color="amber">{sks.hari_sakit} hari</Badge></Td>
                  <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(sks.tanggal_mulai)} - {formatDate(sks.tanggal_selesai)}</Td>
                  <Td className="max-w-xs truncate text-slate-500">{sks.diagnosa || '-'}</Td>
                  <Td className="text-slate-500">{sks.dokter?.nama_lengkap || '-'}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Badge color={sks.status === 'aktif' ? 'emerald' : 'rose'}>{sks.status === 'aktif' ? 'Aktif' : 'Dibatalkan'}</Badge>
                      {sks.sudah_dicetak && <Badge color="slate">Dicetak</Badge>}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => printSks(sks)}><Printer className="w-4 h-4" /> Cetak</Button>
                      {canEdit && <button onClick={() => openEdit(sks)} className="p-1.5 rounded-lg text-sky-500 hover:bg-sky-50"><Edit2 className="w-4 h-4" /></button>}
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
          <Button onClick={openAdd}><Plus className="w-4 h-4" /> Buat Surat Keterangan Sakit</Button>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editingSks ? 'Edit Surat Keterangan Sakit' : 'Buat Surat Keterangan Sakit'} size="lg">
        <div className="space-y-4">
          {!editingSks && (
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
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Jumlah Hari Sakit" type="number" value={form.hari_sakit} onChange={(v) => setForm({ ...form, hari_sakit: v })} placeholder="1" required />
            <Input label="Tanggal Mulai" type="date" value={form.tanggal_mulai} onChange={(v) => setForm({ ...form, tanggal_mulai: v })} required />
          </div>
          <Textarea label="Diagnosa" value={form.diagnosa} onChange={(v) => setForm({ ...form, diagnosa: v })} rows={2} required />
          <div className="p-3 rounded-xl bg-violet-50 border border-violet-100">
            <p className="text-xs text-violet-700">
              Surat akan ditandatangani secara digital dengan tanda tangan: <b>{profile?.tanda_tangan_digital || profile?.nama_lengkap}</b>.
              Barcode akan dibuat dari NIK dokter pada saat dicetak.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={save} disabled={saving} className="flex-1"><FileSignature className="w-4 h-4" /> {saving ? 'Menyimpan...' : editingSks ? 'Perbarui' : 'Buat Surat'}</Button>
            <Button variant="secondary" onClick={() => setModal(false)}>Batal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
