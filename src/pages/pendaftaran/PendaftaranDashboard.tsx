import { useEffect, useState } from 'react';
import { supabase, Kunjungan, Pasien } from '@/lib/supabase';
import { Card, StatCard, LoadingSpinner, Badge, TableWrapper, Th, Td } from '@/components/ui';
import { Users, ClipboardList, CalendarDays, TrendingUp, UserPlus, Ticket } from 'lucide-react';
import { formatDate } from '@/lib/types';

export default function PendaftaranDashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [todayVisits, setTodayVisits] = useState<Kunjungan[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ day: string; count: number }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const [visitsRes, patientsRes] = await Promise.all([
      supabase
        .from('kunjungan')
        .select('*, pasien(*)')
        .eq('tanggal_kunjungan', today)
        .neq('status', 'batal')
        .order('created_at', { ascending: true }),
      supabase.from('pasien').select('id', { count: 'exact', head: true }),
    ]);

    setTodayVisits((visitsRes.data || []) as Kunjungan[]);
    setTotalPatients(patientsRes.count || 0);

    // Weekly data
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekRes = await supabase
      .from('kunjungan')
      .select('tanggal_kunjungan')
      .gte('tanggal_kunjungan', weekAgo.toISOString().slice(0, 10))
      .neq('status', 'batal');

    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const dayMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, 0);
    }
    (weekRes.data || []).forEach((v: { tanggal_kunjungan: string }) => {
      const key = v.tanggal_kunjungan;
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    });

    const weekly = Array.from(dayMap.entries()).map(([key, count]) => {
      const d = new Date(key);
      return { day: dayNames[d.getDay()], count };
    });
    setWeeklyData(weekly);
    setLoading(false);
  }

  if (loading) return <LoadingSpinner />;

  const activeQueue = todayVisits.filter((v) => v.status === 'menunggu' || v.status === 'dipanggil');
  const inExam = todayVisits.filter((v) => v.status === 'diperiksa');
  const done = todayVisits.filter((v) => v.status === 'selesai');

  const poliCounts = todayVisits.reduce((acc, v) => {
    acc[v.poli_tujuan] = (acc[v.poli_tujuan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const maxWeekly = Math.max(...weeklyData.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Pasien Terdaftar" value={totalPatients} color="sky" />
        <StatCard icon={ClipboardList} label="Antrian Aktif Hari Ini" value={activeQueue.length} color="amber" subtitle="Menunggu dipanggil" />
        <StatCard icon={CalendarDays} label="Kunjungan Hari Ini" value={todayVisits.length} color="teal" />
        <StatCard icon={TrendingUp} label="Selesai Diperiksa" value={done.length} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly chart */}
        <Card className="lg:col-span-2 p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">Kunjungan Mingguan</h3>
          <div className="flex items-end justify-between gap-2 h-48">
            {weeklyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col justify-end h-full">
                  <div
                    className="w-full bg-gradient-to-t from-sky-500 to-teal-400 rounded-t-lg transition-all hover:from-sky-600 hover:to-teal-500"
                    style={{ height: `${(d.count / maxWeekly) * 100}%`, minHeight: d.count > 0 ? '8px' : '0' }}
                    title={`${d.count} kunjungan`}
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium">{d.day}</span>
                <span className="text-xs text-slate-700 font-bold">{d.count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Queue per poli */}
        <Card className="p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">Antrian per Poli</h3>
          <div className="space-y-3">
            {Object.entries(poliCounts).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Belum ada antrian</p>
            ) : (
              Object.entries(poliCounts).map(([poli, count]) => (
                <div key={poli} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="text-sm font-medium text-slate-600">{poli}</span>
                  <Badge color="sky">{count} pasien</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate('pendaftaran-pasien-baru')}
          className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-sky-500 to-teal-500 text-white shadow-lg shadow-sky-200 hover:shadow-sky-300 transition-all"
        >
          <UserPlus className="w-8 h-8" />
          <div className="text-left">
            <p className="font-bold">Daftar Pasien Baru</p>
            <p className="text-sm text-sky-100">Input data pasien lengkap</p>
          </div>
        </button>
        <button
          onClick={() => onNavigate('pendaftaran-kunjungan')}
          className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all text-slate-700"
        >
          <Ticket className="w-8 h-8 text-teal-500" />
          <div className="text-left">
            <p className="font-bold">Buat Kunjungan Baru</p>
            <p className="text-sm text-slate-500">Pilih pasien & poli, buat antrian</p>
          </div>
        </button>
      </div>

      {/* Today's queue */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800">Antrian Hari Ini</h3>
          <button onClick={() => onNavigate('pendaftaran-antrian')} className="text-sm font-medium text-sky-600 hover:text-sky-700">
            Kelola Antrian →
          </button>
        </div>
        {todayVisits.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada kunjungan hari ini</p>
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>No. Antrian</Th>
                <Th>Pasien</Th>
                <Th>Poli</Th>
                <Th>Keluhan</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {todayVisits.slice(0, 8).map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <Td><span className="font-mono font-bold text-sky-600">{v.no_antrian || '-'}</span></Td>
                  <Td className="font-medium text-slate-700">{v.pasien?.nama || '-'}</Td>
                  <Td><Badge color="teal">{v.poli_tujuan}</Badge></Td>
                  <Td className="max-w-xs truncate">{v.keluhan_awal || '-'}</Td>
                  <Td>
                    <Badge color={v.status === 'selesai' ? 'emerald' : v.status === 'diperiksa' ? 'amber' : v.status === 'batal' ? 'rose' : 'sky'}>
                      {v.status}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
      </Card>
    </div>
  );
}
