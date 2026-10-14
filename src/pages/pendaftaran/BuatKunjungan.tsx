import { useState, useEffect } from 'react';
import { supabase, Pasien, Poli } from '@/lib/supabase';
import { Card, Input, Select, Textarea, Button, PageTitle, SearchInput, Badge, EmptyState, LoadingSpinner } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { PEMBIAYAAN_OPTIONS } from '@/lib/types';
import { Save, Search, UserCheck, Ticket, HeartPulse } from 'lucide-react';

export default function BuatKunjungan({ onNavigate }: { onNavigate: (page: string) => void }) {
  const toast = useToast();
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Pasien[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Pasien | null>(null);
  const [saving, setSaving] = useState(false);
  const [poliList, setPoliList] = useState<Poli[]>([]);
  const [form, setForm] = useState({
    poli_tujuan: '',
    keluhan_awal: '',
    pembiayaan: 'Umum' as 'Umum' | 'BPJS',
    tekanan_darah: '',
    suhu: '',
    berat_badan: '',
    tinggi_badan: '',
  });
  const [createdAntrian, setCreatedAntrian] = useState<{ no_antrian: string; nama: string } | null>(null);

  useEffect(() => {
    loadPoli();
  }, []);

  useEffect(() => {
    if (search.length >= 2) {
      searchPatients();
    } else {
      setPatients([]);
    }
  }, [search]);

  async function loadPoli() {
    const { data } = await supabase.from('poli').select('*').eq('aktif', true).order('nama_poli', { ascending: true });
    const poliData = (data || []) as Poli[];
    setPoliList(poliData);
    if (poliData.length > 0 && !form.poli_tujuan) {
      setForm((prev) => ({ ...prev, poli_tujuan: poliData[0].nama_poli }));
    }
  }

  async function searchPatients() {
    setLoading(true);
    const { data, error } = await supabase
      .from('pasien')
      .select('*')
      .or(`nama.ilike.%${search}%,nik.ilike.%${search}%,no_rekam_medis.ilike.%${search}%`)
      .limit(10);
    if (!error) setPatients(data as Pasien[]);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast('Pilih pasien terlebih dahulu', 'warning');
      return;
    }

    if (!form.tekanan_darah || !form.suhu || !form.berat_badan || !form.tinggi_badan) {
      toast('Semua tanda vital wajib diisi (tekanan darah, suhu, berat, tinggi)', 'warning');
      return;
    }
    if (!form.keluhan_awal) {
      toast('Keluhan awal wajib diisi', 'warning');
      return;
    }

    setSaving(true);

    // Generate no antrian
    const { data: antrianNo } = await supabase.rpc('generate_no_antrian', { p_poli: form.poli_tujuan });

    const { data, error } = await supabase
      .from('kunjungan')
      .insert({
        pasien_id: selected.id,
        poli_tujuan: form.poli_tujuan,
        keluhan_awal: form.keluhan_awal,
        pembiayaan: form.pembiayaan,
        tekanan_darah: form.tekanan_darah || null,
        suhu: form.suhu ? parseFloat(form.suhu) : null,
        berat_badan: form.berat_badan ? parseFloat(form.berat_badan) : null,
        tinggi_badan: form.tinggi_badan ? parseFloat(form.tinggi_badan) : null,
        no_antrian: antrianNo,
        status: 'menunggu',
        dibuat_oleh: profile?.id,
      })
      .select()
      .single();

    if (error) {
      toast('Gagal membuat kunjungan: ' + error.message, 'error');
      setSaving(false);
      return;
    }

    setCreatedAntrian({ no_antrian: antrianNo || 'U-001', nama: selected.nama });
    toast(`Kunjungan dibuat. No. Antrian: ${antrianNo}`, 'success');
    setSaving(false);
  }

  if (createdAntrian) {
    return (
      <div className="max-w-md mx-auto">
        <Card className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
            <Ticket className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Kunjungan Berhasil Dibuat</h3>
          <div className="my-6 p-6 rounded-2xl bg-gradient-to-br from-sky-50 to-teal-50 border-2 border-dashed border-sky-200">
            <p className="text-sm text-slate-500 mb-1">Nomor Antrian</p>
            <p className="text-4xl font-bold text-sky-700 font-mono mb-2">{createdAntrian.no_antrian}</p>
            <p className="text-sm text-slate-600">{createdAntrian.nama}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => window.print()} className="flex-1">
              Cetak
            </Button>
            <Button variant="primary" onClick={() => {
              setCreatedAntrian(null);
              setSelected(null);
              setSearch('');
              setForm({ poli_tujuan: poliList[0]?.nama_poli || '', keluhan_awal: '', pembiayaan: 'Umum', tekanan_darah: '', suhu: '', berat_badan: '', tinggi_badan: '' });
            }} className="flex-1">
              Buat Kunjungan Lain
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageTitle title="Buat Kunjungan Baru" subtitle="Cari pasien lama atau buat kunjungan ulang" />

      {!selected ? (
        <Card className="p-6">
          <div className="mb-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari pasien (nama, NIK, atau No. RM)..." />
          </div>

          {loading && <LoadingSpinner />}
          {!loading && patients.length === 0 && search.length >= 2 && (
            <EmptyState icon={Search} title="Pasien tidak ditemukan" subtitle="Coba kata kunci lain atau daftarkan pasien baru" />
          )}
          {!loading && search.length < 2 && (
            <EmptyState icon={Search} title="Cari Pasien" subtitle="Ketik minimal 2 huruf untuk mencari" />
          )}

          {patients.length > 0 && (
            <div className="space-y-2">
              {patients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50 transition-all text-left"
                >
                  <div>
                    <p className="font-semibold text-slate-700">{p.nama}</p>
                    <p className="text-xs text-slate-400">
                      {p.no_rekam_medis} • {p.nik || 'NIK -'} • {p.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                    </p>
                  </div>
                  <UserCheck className="w-5 h-5 text-slate-300" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigate('pendaftaran-pasien-baru')}
              className="text-sm font-medium text-sky-600 hover:text-sky-700"
            >
              + Daftarkan Pasien Baru
            </button>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          {/* Selected patient */}
          <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Pasien Terpilih</p>
                <p className="font-bold text-slate-800">{selected.nama}</p>
                <p className="text-xs text-slate-500">
                  {selected.no_rekam_medis} • {selected.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-sm text-sky-600 hover:text-sky-700 font-medium">
                Ganti
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Poli Tujuan"
                value={form.poli_tujuan}
                onChange={(v) => setForm({ ...form, poli_tujuan: v })}
                required
                options={poliList.map((p) => ({ value: p.nama_poli, label: p.nama_poli }))}
              />
              <Select
                label="Pembiayaan"
                value={form.pembiayaan}
                onChange={(v) => setForm({ ...form, pembiayaan: v as 'Umum' | 'BPJS' })}
                required
                options={PEMBIAYAAN_OPTIONS.map((p) => ({ value: p, label: p }))}
              />
            </div>

            <Textarea
              label="Keluhan Awal"
              value={form.keluhan_awal}
              onChange={(v) => setForm({ ...form, keluhan_awal: v })}
              rows={3}
              placeholder="Deskripsikan keluhan pasien..."
              required
            />

            {/* Vital Signs */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse className="w-4 h-4 text-rose-500" />
                <p className="text-sm font-semibold text-slate-700">Tanda Vital (diisi oleh petugas pendaftaran)</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input label="Tekanan Darah" value={form.tekanan_darah} onChange={(v) => setForm({ ...form, tekanan_darah: v })} placeholder="120/80" required />
                <Input label="Suhu (°C)" type="number" value={form.suhu} onChange={(v) => setForm({ ...form, suhu: v })} placeholder="36.5" required />
                <Input label="Berat (kg)" type="number" value={form.berat_badan} onChange={(v) => setForm({ ...form, berat_badan: v })} placeholder="60" required />
                <Input label="Tinggi (cm)" type="number" value={form.tinggi_badan} onChange={(v) => setForm({ ...form, tinggi_badan: v })} placeholder="170" required />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                <Save className="w-4 h-4" />
                {saving ? 'Membuat...' : 'Buat Kunjungan'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => onNavigate('pendaftaran')}>
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
