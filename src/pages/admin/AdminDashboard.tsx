import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, StatCard, Badge, TableWrapper, Th, Td, LoadingSpinner, EmptyState, PageTitle } from '@/components/ui';
import { Users, ClipboardList, Pill, Package, Activity, UserCheck, UserX, Stethoscope, Shield } from 'lucide-react';
import { ROLE_LABELS, formatDate } from '@/lib/types';

export default function AdminDashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [userCount, setUserCount] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [inactiveUsers, setInactiveUsers] = useState(0);
  const [pasienCount, setPasienCount] = useState(0);
  const [kunjunganToday, setKunjunganToday] = useState(0);
  const [resepPending, setResepPending] = useState(0);
  const [obatLowStock, setObatLowStock] = useState(0);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const [usersRes, pasienRes, kunjunganRes, resepRes, obatRes, recentRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact' }),
      supabase.from('pasien').select('id', { count: 'exact', head: true }),
      supabase.from('kunjungan').select('id', { count: 'exact', head: true }).eq('tanggal_kunjungan', today).neq('status', 'batal'),
      supabase.from('resep').select('id', { count: 'exact', head: true }).eq('status', 'menunggu'),
      supabase.from('obat').select('*'),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(5),
    ]);

    setUserCount(usersRes.count || 0);
    setActiveUsers((usersRes.data || []).filter((u: any) => u.status_aktif).length);
    setInactiveUsers((usersRes.data || []).filter((u: any) => !u.status_aktif).length);
    setPasienCount(pasienRes.count || 0);
    setKunjunganToday(kunjunganRes.count || 0);
    setResepPending(resepRes.count || 0);
    setObatLowStock((obatRes.data || []).filter((o: any) => o.stok_saat_ini <= o.stok_minimum).length);
    setRecentUsers((recentRes.data || []) as any[]);
    setLoading(false);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total User" value={userCount} color="violet" subtitle={`${activeUsers} aktif, ${inactiveUsers} nonaktif`} />
        <StatCard icon={Activity} label="Total Pasien" value={pasienCount} color="sky" />
        <StatCard icon={ClipboardList} label="Kunjungan Hari Ini" value={kunjunganToday} color="teal" />
        <StatCard icon={Pill} label="Resep Menunggu" value={resepPending} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick links */}
        <Card className="p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">Aksi Cepat</h3>
          <div className="space-y-3">
            <button onClick={() => onNavigate('admin-users')} className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-violet-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-700">Manajemen User</p>
                  <p className="text-xs text-slate-400">Tambah, edit, nonaktifkan akun</p>
                </div>
              </div>
              <span className="text-sm text-violet-600 font-medium">Kelola →</span>
            </button>
            <button onClick={() => onNavigate('admin-roles')} className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-violet-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-700">Manajemen Role</p>
                  <p className="text-xs text-slate-400">Tambah & hapus role sistem</p>
                </div>
              </div>
              <span className="text-sm text-violet-600 font-medium">Kelola →</span>
            </button>
            <button onClick={() => onNavigate('profile')} className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-sky-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-700">Profil Saya</p>
                  <p className="text-xs text-slate-400">Edit data pribadi & ganti password</p>
                </div>
              </div>
              <span className="text-sm text-sky-600 font-medium">Lihat →</span>
            </button>
          </div>
        </Card>

        {/* System overview */}
        <Card className="p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">Ringkasan Sistem</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-500" />
                <span className="text-sm text-slate-600">Kunjungan Hari Ini</span>
              </div>
              <Badge color="teal">{kunjunganToday}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-slate-600">Resep Menunggu</span>
              </div>
              <Badge color="amber">{resepPending}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-rose-500" />
                <span className="text-sm text-slate-600">Obat Stok Rendah</span>
              </div>
              <Badge color="rose">{obatLowStock}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-slate-600">User Aktif</span>
              </div>
              <Badge color="emerald">{activeUsers}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent users */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">User Terbaru</h3>
          <button onClick={() => onNavigate('admin-users')} className="text-sm font-medium text-violet-600 hover:text-violet-700">
            Lihat Semua →
          </button>
        </div>
        {recentUsers.length === 0 ? (
          <EmptyState icon={Users} title="Belum ada user" />
        ) : (
          <TableWrapper>
            <thead>
              <tr><Th>Nama</Th><Th>Role</Th><Th>Status</Th><Th>Dibuat</Th></tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-teal-400 flex items-center justify-center text-white text-xs font-semibold">
                        {u.nama_lengkap?.charAt(0) || 'U'}
                      </div>
                      <span className="font-medium text-slate-700">{u.nama_lengkap}</span>
                    </div>
                  </Td>
                  <Td><Badge color="violet">{ROLE_LABELS[u.role] || u.role}</Badge></Td>
                  <Td><Badge color={u.status_aktif ? 'emerald' : 'rose'}>{u.status_aktif ? 'Aktif' : 'Nonaktif'}</Badge></Td>
                  <Td className="text-slate-500">{formatDate(u.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
      </Card>
    </div>
  );
}
