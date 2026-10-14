import { useEffect, useState } from 'react';
import { supabase, Kunjungan, Obat, ResepDetail } from '@/lib/supabase';
import { Card, Badge, Button, Input, Textarea, LoadingSpinner, PageTitle, Modal } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { Save, Plus, Trash2, Search, Pill, FileText, ArrowLeft, AlertTriangle } from 'lucide-react';
import { formatDate, calcAge, formatCurrency } from '@/lib/types';

interface ExamForm {
  anamnesa: string; tekanan_darah: string; suhu: string; berat_badan: string;
  tinggi_badan: string; diagnosa: string; icd10_kode: string; catatan_dokter: string;
}

export default function PemeriksaanPasien({ kunjunganId, onNavigate }: { kunjunganId: string; onNavigate: (p: string) => void }) {
  const toast = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visit, setVisit] = useState<Kunjungan | null>(null);
  const [examExists, setExamExists] = useState<any>(null);
  const [resepExists, setResepExists] = useState<any>(null);
  const [form, setForm] = useState<ExamForm>({ anamnesa: '', tekanan_darah: '', suhu: '', berat_badan: '', tinggi_badan: '', diagnosa: '', icd10_kode: '', catatan_dokter: '' });
  const [resepItems, setResepItems] = useState<ResepDetail[]>([]);
  const [resepCatatan, setResepCatatan] = useState('');
  const [obatSearch, setObatSearch] = useState('');
  const [obatResults, setObatResults] = useState<Obat[]>([]);
  const [addObatModal, setAddObatModal] = useState(false);
  const [selectedObat, setSelectedObat] = useState<Obat | null>(null);
  const [jumlah, setJumlah] = useState('1');
  const [aturanPakai, setAturanPakai] = useState('');


  useEffect(() => { load(); }, [kunjunganId]);

  async function load() {
    setLoading(true);
    const { data: v } = await supabase.from('kunjungan').select('*, pasien(*)').eq('id', kunjunganId).maybeSingle();
    setVisit(v as Kunjungan | null);

    // Pre-fill vital signs from kunjungan (entered by pendaftaran)
    if (v) {
      setForm(prev => ({
        ...prev,
        tekanan_darah: v.tekanan_darah || '',
        suhu: v.suhu?.toString() || '',
        berat_badan: v.berat_badan?.toString() || '',
        tinggi_badan: v.tinggi_badan?.toString() || '',
      }));
    }

    const { data: exam } = await supabase.from('pemeriksaan').select('*').eq('kunjungan_id', kunjunganId).maybeSingle();
    if (exam) {
      setExamExists(exam);
      setForm({
        anamnesa: exam.anamnesa || '', tekanan_darah: exam.tekanan_darah || '',
        suhu: exam.suhu?.toString() || '', berat_badan: exam.berat_badan?.toString() || '',
        tinggi_badan: exam.tinggi_badan?.toString() || '', diagnosa: exam.diagnosa || '',
        icd10_kode: exam.icd10_kode || '', catatan_dokter: exam.catatan_dokter || '',
      });

      const { data: resep } = await supabase.from('resep').select('*, resep_detail(*, obat:obat(*))').eq('pemeriksaan_id', exam.id).maybeSingle();
      if (resep) {
        setResepExists(resep);
        setResepCatatan(resep.catatan_resep || '');
        setResepItems((resep.resep_detail || []) as ResepDetail[]);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    if (obatSearch.length >= 2) {
      supabase.from('obat').select('*').ilike('nama_obat', `%${obatSearch}%`).limit(10).then(({ data }) => setObatResults((data || []) as Obat[]));
    } else setObatResults([]);
  }, [obatSearch]);

  async function saveExam() {
    if (!visit) return;
    if (!form.anamnesa) { toast('Anamnesa wajib diisi', 'warning'); return; }
    if (!form.tekanan_darah) { toast('Tekanan darah wajib diisi', 'warning'); return; }
    if (!form.suhu) { toast('Suhu wajib diisi', 'warning'); return; }
    if (!form.berat_badan) { toast('Berat badan wajib diisi', 'warning'); return; }
    if (!form.tinggi_badan) { toast('Tinggi badan wajib diisi', 'warning'); return; }
    if (!form.diagnosa) { toast('Diagnosa wajib diisi', 'warning'); return; }
    if (!form.icd10_kode) { toast('Kode ICD-10 wajib diisi', 'warning'); return; }
    if (!form.catatan_dokter) { toast('Catatan dokter wajib diisi', 'warning'); return; }
    setSaving(true);
    const payload = {
      kunjungan_id: visit.id, dokter_id: profile?.id,
      anamnesa: form.anamnesa, tekanan_darah: form.tekanan_darah,
      suhu: form.suhu ? parseFloat(form.suhu) : null,
      berat_badan: form.berat_badan ? parseFloat(form.berat_badan) : null,
      tinggi_badan: form.tinggi_badan ? parseFloat(form.tinggi_badan) : null,
      diagnosa: form.diagnosa, icd10_kode: form.icd10_kode, catatan_dokter: form.catatan_dokter,
    };

    if (examExists) {
      const { error } = await supabase.from('pemeriksaan').update(payload).eq('id', examExists.id);
      if (error) toast('Gagal update: ' + error.message, 'error');
      else toast('Pemeriksaan diperbarui', 'success');
    } else {
      const { data, error } = await supabase.from('pemeriksaan').insert(payload).select().single();
      if (error) toast('Gagal simpan: ' + error.message, 'error');
      else { setExamExists(data); toast('Pemeriksaan disimpan', 'success'); }
    }

    await supabase.from('kunjungan').update({ status: 'diperiksa' }).eq('id', visit.id);
    setSaving(false);
  }

  async function saveResep() {
    if (!visit) return;
    if (!examExists) { toast('Simpan pemeriksaan terlebih dahulu', 'warning'); return; }
    if (resepItems.length === 0) { toast('Tambahkan minimal 1 obat ke resep', 'warning'); return; }
    setSaving(true);

    let resepId = resepExists?.id;
    if (!resepId) {
      const { data, error } = await supabase.from('resep').insert({
        pemeriksaan_id: examExists.id, dokter_id: profile?.id, status: 'menunggu', catatan_resep: resepCatatan,
      }).select().single();
      if (error) { toast('Gagal buat resep: ' + error.message, 'error'); setSaving(false); return; }
      resepId = data.id;
      setResepExists(data);
    } else {
      await supabase.from('resep').update({ catatan_resep: resepCatatan }).eq('id', resepId);
      await supabase.from('resep_detail').delete().eq('resep_id', resepId);
    }

    for (const item of resepItems) {
      await supabase.from('resep_detail').insert({
        resep_id: resepId, obat_id: item.obat_id, jumlah: item.jumlah,
        aturan_pakai: item.aturan_pakai, catatan: item.catatan,
      });
    }

    // Mark kunjungan as selesai so it leaves the 'sedang diperiksa' queue
    await supabase.from('kunjungan').update({ status: 'selesai' }).eq('id', visit.id);

    toast('Resep berhasil dikirim ke apoteker. Kunjungan diselesaikan.', 'success');
    setSaving(false);
    onNavigate('dokter');
  }

  async function completeVisit() {
    if (!visit) return;
    await supabase.from('kunjungan').update({ status: 'selesai' }).eq('id', visit.id);
    toast('Kunjungan diselesaikan', 'success');
    onNavigate('dokter');
  }

  function addObat() {
    if (!selectedObat) return;
    if (parseInt(jumlah) < 1) { toast('Jumlah harus minimal 1', 'warning'); return; }
    setResepItems([...resepItems, {
      id: Math.random().toString(), resep_id: '', obat_id: selectedObat.id, jumlah: parseInt(jumlah),
      aturan_pakai: aturanPakai, catatan: '', created_at: '', obat: selectedObat,
    }]);
    setSelectedObat(null); setJumlah('1'); setAturanPakai(''); setObatSearch(''); setAddObatModal(false);
  }

  if (loading) return <LoadingSpinner />;
  if (!visit) return <div className="text-center py-16 text-slate-500">Kunjungan tidak ditemukan</div>;

  return (
    <div>
      <button onClick={() => onNavigate('dokter')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Antrian
      </button>

      {/* Patient info */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-sky-100 to-teal-100 flex items-center justify-center text-xl font-bold text-sky-700">
              {visit.pasien?.nama?.charAt(0) || 'P'}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{visit.pasien?.nama}</h2>
              <p className="text-sm text-slate-500">
                {visit.pasien?.no_rekam_medis} • {visit.pasien?.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} • {calcAge(visit.pasien?.tanggal_lahir)} tahun
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Gol. Darah: {visit.pasien?.golongan_darah || '-'} • Alergi: <span className={visit.pasien?.alergi ? 'text-rose-600 font-semibold' : ''}>{visit.pasien?.alergi || 'Tidak ada'}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <Badge color="teal">{visit.poli_tujuan}</Badge>
              <Badge color={visit.pembiayaan === 'BPJS' ? 'sky' : 'slate'}>{visit.pembiayaan}</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">No. Antrian: <span className="font-mono font-bold text-sky-600">{visit.no_antrian}</span></p>
            <p className="text-xs text-slate-400">{formatDate(visit.tanggal_kunjungan)}</p>
          </div>
        </div>
        {visit.keluhan_awal && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
            <p className="text-xs font-semibold text-amber-700">Keluhan Awal</p>
            <p className="text-sm text-slate-600">{visit.keluhan_awal}</p>
          </div>
        )}
      </Card>

      {/* Examination form */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-sky-600" />
          <h3 className="text-base font-bold text-slate-800">Form Pemeriksaan</h3>
          {examExists && <Badge color="emerald">Tersimpan</Badge>}
        </div>
        <div className="space-y-4">
          <Textarea label="Anamnesa" value={form.anamnesa} onChange={(v) => setForm({ ...form, anamnesa: v })} rows={3} placeholder="Riwayat penyakit dan keluhan pasien..." required />
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 mb-2">Tanda Vital (dari pendaftaran — dapat disesuaikan)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Input label="Tekanan Darah" value={form.tekanan_darah} onChange={(v) => setForm({ ...form, tekanan_darah: v })} placeholder="120/80" />
              <Input label="Suhu (°C)" type="number" value={form.suhu} onChange={(v) => setForm({ ...form, suhu: v })} placeholder="36.5" />
              <Input label="Berat (kg)" type="number" value={form.berat_badan} onChange={(v) => setForm({ ...form, berat_badan: v })} placeholder="60" />
              <Input label="Tinggi (cm)" type="number" value={form.tinggi_badan} onChange={(v) => setForm({ ...form, tinggi_badan: v })} placeholder="170" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Diagnosa" value={form.diagnosa} onChange={(v) => setForm({ ...form, diagnosa: v })} placeholder="Diagnosa utama" required />
            <Input label="Kode ICD-10" value={form.icd10_kode} onChange={(v) => setForm({ ...form, icd10_kode: v })} placeholder="J00" required />
          </div>
          <Textarea label="Catatan Dokter" value={form.catatan_dokter} onChange={(v) => setForm({ ...form, catatan_dokter: v })} rows={2} placeholder="Catatan tambahan..." required />
          <Button onClick={saveExam} disabled={saving}><Save className="w-4 h-4" /> Simpan Pemeriksaan</Button>
        </div>
      </Card>

      {/* Prescription */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-800">Resep Obat</h3>
            {resepExists && <Badge color={resepExists.status === 'selesai' ? 'emerald' : resepExists.status === 'diproses' ? 'amber' : 'sky'}>{resepExists.status}</Badge>}
          </div>
          <Button size="sm" variant="secondary" onClick={() => setAddObatModal(true)}><Plus className="w-4 h-4" /> Tambah Obat</Button>
        </div>

        {resepItems.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada obat dalam resep</p>
        ) : (
          <div className="space-y-2">
            {resepItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div className="flex-1">
                  <p className="font-semibold text-slate-700">{item.obat?.nama_obat}</p>
                  <p className="text-xs text-slate-500">{item.jumlah} {item.obat?.satuan} • {item.aturan_pakai || 'Aturan pakai belum diisi'}</p>
                  {item.obat && item.jumlah > item.obat.stok_saat_ini && (
                    <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3" /> Stok tersisa {item.obat.stok_saat_ini}
                    </p>
                  )}
                </div>
                <button onClick={() => setResepItems(resepItems.filter((_, idx) => idx !== i))} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {resepItems.length > 0 && (
          <>
            <div className="mt-4">
              <Textarea label="Catatan Resep" value={resepCatatan} onChange={setResepCatatan} rows={2} placeholder="Catatan untuk apoteker..." />
            </div>
            <div className="mt-4 flex gap-3">
              <Button onClick={saveResep} disabled={saving}><Save className="w-4 h-4" /> Simpan & Kirim Resep</Button>
            </div>
            <p className="mt-3 text-xs text-slate-400">Menyimpan resep akan menyelesaikan kunjungan dan mengirim resep ke apoteker.</p>
          </>
        )}
      </Card>

      {/* Add obat modal */}
      <Modal open={addObatModal} onClose={() => setAddObatModal(false)} title="Cari & Tambah Obat" size="lg">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={obatSearch} onChange={(e) => setObatSearch(e.target.value)} placeholder="Cari nama obat..." autoFocus
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none text-sm" />
          </div>

          {obatResults.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {obatResults.map((o) => (
                <button key={o.id} onClick={() => setSelectedObat(o)} className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${selectedObat?.id === o.id ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div>
                    <p className="font-semibold text-slate-700">{o.nama_obat}</p>
                    <p className="text-xs text-slate-500">{o.kategori} • {o.satuan} • {formatCurrency(o.harga)}</p>
                  </div>
                  <Badge color={o.stok_saat_ini > o.stok_minimum ? 'emerald' : 'rose'}>Stok: {o.stok_saat_ini}</Badge>
                </button>
              ))}
            </div>
          )}

          {selectedObat && (
            <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 space-y-3">
              <p className="font-semibold text-slate-700">{selectedObat.nama_obat}</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Jumlah" type="number" value={jumlah} onChange={setJumlah} />
                <Input label="Aturan Pakai" value={aturanPakai} onChange={setAturanPakai} placeholder="3x1 sesudah makan" />
              </div>
              <Button onClick={addObat} className="w-full"><Plus className="w-4 h-4" /> Tambah ke Resep</Button>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}
