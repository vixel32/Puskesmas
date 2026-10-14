import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { Card, Input, Button, PageTitle, Badge } from '@/components/ui';
import { User, Lock, Save, Loader2 } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/types';

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [nama, setNama] = useState(profile?.nama_lengkap || '');
  const [noHp, setNoHp] = useState(profile?.no_hp || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  async function saveProfile() {
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({ nama_lengkap: nama, no_hp: noHp }).eq('id', profile?.id);
    if (error) toast('Gagal: ' + error.message, 'error');
    else { toast('Profil diperbarui', 'success'); refreshProfile(); }
    setSavingProfile(false);
  }

  async function changePassword() {
    if (newPass.length < 6) { toast('Password baru minimal 6 karakter', 'warning'); return; }
    if (newPass !== confirmPass) { toast('Konfirmasi password tidak cocok', 'warning'); return; }
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) toast('Gagal: ' + error.message, 'error');
    else { toast('Password berhasil diubah', 'success'); setNewPass(''); setConfirmPass(''); }
    setSavingPass(false);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageTitle title="Profil Saya" subtitle="Kelola data pribadi dan keamanan akun" />

      {/* Profile info */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-sky-600" />
          <h3 className="text-base font-bold text-slate-800">Data Pribadi</h3>
        </div>
        <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-slate-50">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-teal-400 flex items-center justify-center text-white text-2xl font-bold">
            {profile?.nama_lengkap?.charAt(0) || 'U'}
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">{profile?.nama_lengkap}</p>
            <Badge color="sky">{ROLE_LABELS[profile?.role || '']}</Badge>
          </div>
        </div>
        <div className="space-y-4">
          <Input label="Nama Lengkap" value={nama} onChange={setNama} />
          <Input label="No. HP" value={noHp} onChange={setNoHp} />
          <Button onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>
      </Card>

      {/* Change password */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-teal-600" />
          <h3 className="text-base font-bold text-slate-800">Ganti Password</h3>
        </div>
        <div className="space-y-4">
          <Input label="Password Baru" type="password" value={newPass} onChange={setNewPass} placeholder="Minimal 6 karakter" />
          <Input label="Konfirmasi Password Baru" type="password" value={confirmPass} onChange={setConfirmPass} />
          <Button onClick={changePassword} disabled={savingPass} variant="success">
            {savingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {savingPass ? 'Mengubah...' : 'Ubah Password'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
