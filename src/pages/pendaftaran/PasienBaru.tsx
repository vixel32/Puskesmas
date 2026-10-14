import { useState } from 'react';
import { supabase, Pasien } from '@/lib/supabase';
import { Card, Input, Select, Textarea, Button, PageTitle, LoadingSpinner } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { Save, UserPlus, Printer } from 'lucide-react';

export default function PasienBaru({ onNavigate }: { onNavigate: (page: string) => void }) {
  const toast = useToast();
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [createdPasien, setCreatedPasien] = useState<Pasien | null>(null);
  const [form, setForm] = useState({
    nik: '',
    nama: '',
    tanggal_lahir: '',
    jenis_kelamin: '',
    alamat: '',
    no_hp: '',
    golongan_darah: '',
    alergi: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      toast('Nama pasien wajib diisi', 'error');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('pasien')
      .insert({
        nik: form.nik,
        nama: form.nama,
        tanggal_lahir: form.tanggal_lahir || null,
        jenis_kelamin: form.jenis_kelamin,
        alamat: form.alamat,
        no_hp: form.no_hp,
        golongan_darah: form.golongan_darah,
        alergi: form.alergi,
        created_by: profile?.id,
      })
      .select()
      .single();

    if (error) {
      toast('Gagal mendaftarkan pasien: ' + error.message, 'error');
      setSaving(false);
      return;
    }

    setCreatedPasien(data as Pasien);
    toast('Pasien berhasil didaftarkan dengan No. RM: ' + (data as Pasien).no_rekam_medis, 'success');
    setSaving(false);
  };

  const resetForm = () => {
    setForm({
      nik: '', nama: '', tanggal_lahir: '', jenis_kelamin: '',
      alamat: '', no_hp: '', golongan_darah: '', alergi: '',
    });
    setCreatedPasien(null);
  };

  if (createdPasien) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageTitle title="Kartu Berobat Pasien" />
        <Card className="p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-3">
              <Save className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Pasien Berhasil Terdaftar</h3>
            <p className="text-sm text-slate-500">Simpan nomor rekam medis pasien</p>
          </div>

          {/* Printable card */}
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 bg-gradient-to-br from-sky-50 to-teal-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-slate-500">Puskesmas Sehat Sentosa</p>
                <p className="text-sm font-bold text-slate-700">KARTU BEROBAT</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">No. Rekam Medis</p>
                <p className="font-bold text-sky-700 text-lg font-mono">{createdPasien.no_rekam_medis}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Nama Pasien</p>
                <p className="font-semibold text-slate-700">{createdPasien.nama}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">NIK</p>
                <p className="text-slate-600">{createdPasien.nik || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Golongan Darah</p>
                <p className="text-slate-600">{createdPasien.golongan_darah || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tanggal Lahir</p>
                <p className="text-slate-600">{createdPasien.tanggal_lahir || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Alergi</p>
                <p className="text-slate-600">{createdPasien.alergi || 'Tidak ada'}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => window.print()} className="flex-1">
              <Printer className="w-4 h-4" /> Cetak Kartu
            </Button>
            <Button variant="primary" onClick={resetForm} className="flex-1">
              <UserPlus className="w-4 h-4" /> Daftar Pasien Lain
            </Button>
            <Button variant="ghost" onClick={() => onNavigate('pendaftaran-kunjungan')}>
              Buat Kunjungan
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageTitle title="Pendaftaran Pasien Baru" subtitle="Lengkapi data pasien untuk membuat rekam medis baru" />
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="NIK" value={form.nik} onChange={(v) => setForm({ ...form, nik: v })} placeholder="16 digit NIK" />
            <Input label="Nama Lengkap" value={form.nama} onChange={(v) => setForm({ ...form, nama: v })} required placeholder="Nama pasien" />
            <Input label="Tanggal Lahir" type="date" value={form.tanggal_lahir} onChange={(v) => setForm({ ...form, tanggal_lahir: v })} />
            <Select
              label="Jenis Kelamin"
              value={form.jenis_kelamin}
              onChange={(v) => setForm({ ...form, jenis_kelamin: v })}
              placeholder="Pilih jenis kelamin"
              options={[
                { value: 'L', label: 'Laki-laki' },
                { value: 'P', label: 'Perempuan' },
              ]}
            />
            <Select
              label="Golongan Darah"
              value={form.golongan_darah}
              onChange={(v) => setForm({ ...form, golongan_darah: v })}
              placeholder="Pilih golongan darah"
              options={[
                { value: 'A', label: 'A' },
                { value: 'B', label: 'B' },
                { value: 'AB', label: 'AB' },
                { value: 'O', label: 'O' },
              ]}
            />
            <Input label="No. HP" value={form.no_hp} onChange={(v) => setForm({ ...form, no_hp: v })} placeholder="08xxxxxxxxxx" />
          </div>
          <Textarea label="Alamat" value={form.alamat} onChange={(v) => setForm({ ...form, alamat: v })} rows={2} placeholder="Alamat lengkap" />
          <Textarea label="Alergi" value={form.alergi} onChange={(v) => setForm({ ...form, alergi: v })} rows={2} placeholder="Kosongkan jika tidak ada alergi" />
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <LoadingSpinner text="" /> : <Save className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : 'Daftarkan Pasien'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => onNavigate('pendaftaran')}>
              Batal
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
