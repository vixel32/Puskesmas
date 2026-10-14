import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, Kunjungan } from '@/lib/supabase';
import { POLI_OPTIONS, STATUS_KUNJUNGAN_LABELS } from '@/lib/types';
import { LoadingSpinner } from '@/components/ui';
import { Tv, Clock, UserRound, ArrowRight, Bell, Stethoscope, CheckCircle, Activity, Wifi, WifiOff } from 'lucide-react';

export default function PapanAntrian() {
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Kunjungan[]>([]);
  const [now, setNow] = useState(new Date());
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [flash, setFlash] = useState<{ id: string; status: string } | null>(null);
  const prevVisitsRef = useRef<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('kunjungan')
      .select('*, pasien(*)')
      .eq('tanggal_kunjungan', today)
      .order('created_at', { ascending: true });
    setVisits((data || []) as Kunjungan[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const clockInterval = setInterval(() => setNow(new Date()), 1000);

    const channel = supabase
      .channel('papan-antrian-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kunjungan' },
        (payload) => {
          const newRecord = payload.new as Kunjungan;
          const oldStatus = prevVisitsRef.current.get(newRecord.id);
          const newStatus = newRecord.status;

          if (oldStatus && oldStatus !== newStatus && newStatus === 'dipanggil') {
            setFlash({ id: newRecord.id, status: newStatus });
            setTimeout(() => setFlash(null), 3000);
          }

          prevVisitsRef.current.set(newRecord.id, newStatus);
          load();
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      clearInterval(clockInterval);
      supabase.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    const map = new Map<string, string>();
    visits.forEach((v) => map.set(v.id, v.status));
    prevVisitsRef.current = map;
  }, [visits]);

  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const activePoli = POLI_OPTIONS.filter((poli) =>
    visits.some((v) => v.poli_tujuan === poli && v.status !== 'batal')
  );

  const poliStats = activePoli.map((poli) => {
    const poliVisits = visits.filter((v) => v.poli_tujuan === poli && v.status !== 'batal');
    const dipanggil = poliVisits.filter((v) => v.status === 'dipanggil');
    const menunggu = poliVisits.filter((v) => v.status === 'menunggu');
    const selesai = poliVisits.filter((v) => v.status === 'selesai');
    const current = dipanggil[0] || null;
    const next = menunggu.slice(0, 3);
    return { poli, total: poliVisits.length, current, next, selesaiCount: selesai.length, menungguCount: menunggu.length };
  });

  const totalMenunggu = visits.filter((v) => v.status === 'menunggu').length;
  const totalDipanggil = visits.filter((v) => v.status === 'dipanggil').length;
  const totalSelesai = visits.filter((v) => v.status === 'selesai').length;
  const totalPasien = visits.filter((v) => v.status !== 'batal').length;

  if (loading) return <LoadingSpinner text="Memuat data antrian..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 text-white overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-teal-400 flex items-center justify-center shadow-lg shadow-sky-500/30">
            <Activity className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PUSKESMAS SEHAT SENTOSA</h1>
            <p className="text-sm text-sky-300/80">Papan Antrian Pasien</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <Clock className="w-5 h-5 text-sky-400" />
            <span className="text-3xl font-bold tabular-nums tracking-tight">{timeStr}</span>
          </div>
          <p className="text-sm text-slate-400 capitalize mt-0.5">{dateStr}</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3 px-6 py-4">
        <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
            <UserRound className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Pasien</p>
            <p className="text-xl font-bold">{totalPasien}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Menunggu</p>
            <p className="text-xl font-bold text-amber-400">{totalMenunggu}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Sedang Dipanggil</p>
            <p className="text-xl font-bold text-teal-400">{totalDipanggil}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Selesai</p>
            <p className="text-xl font-bold text-emerald-400">{totalSelesai}</p>
          </div>
        </div>
      </div>

      {/* Poli cards */}
      {poliStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Tv className="w-10 h-10 text-slate-600" />
          </div>
          <p className="text-lg font-semibold text-slate-400">Belum ada antrian hari ini</p>
          <p className="text-sm text-slate-500 mt-1">Antrian akan muncul otomatis saat pasien terdaftar</p>
        </div>
      ) : (
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {poliStats.map((stat) => (
            <div
              key={stat.poli}
              className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden flex flex-col"
            >
              {/* Poli header */}
              <div className="px-5 py-3 bg-gradient-to-r from-sky-500/20 to-teal-500/20 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Stethoscope className="w-5 h-5 text-sky-400" />
                  <h3 className="text-lg font-bold">Poli {stat.poli}</h3>
                </div>
                <span className="text-xs text-slate-400 bg-white/5 px-2.5 py-1 rounded-full">
                  {stat.total} pasien
                </span>
              </div>

              {/* Now serving */}
              <div className="px-5 py-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Sedang Dilayani</p>
                {stat.current ? (
                  <div className={`flex items-center gap-4 rounded-xl transition-all duration-500 ${flash?.id === stat.current.id ? 'bg-teal-500/20 ring-2 ring-teal-400 scale-[1.02]' : ''}`}>
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30 animate-pulse">
                      <span className="text-3xl font-bold text-white">{stat.current.no_antrian}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-white truncate">
                        {stat.current.pasien?.nama || '-'}
                      </p>
                      <p className="text-sm text-slate-400">
                        No. RM: {stat.current.pasien?.no_rekam_medis || '-'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="inline-flex items-center gap-1 text-xs bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">
                          <Bell className="w-3 h-3" /> Dipanggil
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <span className="text-2xl font-bold text-slate-600">--</span>
                    </div>
                    <p className="text-sm text-slate-500">Belum ada yang dipanggil</p>
                  </div>
                )}
              </div>

              {/* Next in queue */}
              <div className="px-5 pb-4 flex-1">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
                  Berikutnya {stat.menungguCount > 0 && `(${stat.menungguCount} menunggu)`}
                </p>
                {stat.next.length > 0 ? (
                  <div className="space-y-2">
                    {stat.next.map((v, i) => (
                      <div
                        key={v.id}
                        className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5"
                      >
                        <span className="text-xs text-slate-500 font-mono w-5">{i + 1}.</span>
                        <div className="w-9 h-9 rounded-lg bg-sky-500/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-sky-300">{v.no_antrian}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">
                            {v.pasien?.nama || '-'}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-600" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-white/5 px-3 py-4 text-center">
                    <CheckCircle className="w-5 h-5 text-emerald-500/50 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Tidak ada antrian menunggu</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-2.5 border-t border-white/10 flex items-center justify-between text-xs text-slate-500">
                <span>{STATUS_KUNJUNGAN_LABELS.selesai}: {stat.selesaiCount}</span>
                <span>Menunggu: {stat.menungguCount}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4" />
            <span>Papan Antrian Real-Time</span>
          </div>
          <div className="flex items-center gap-1.5">
            {realtimeConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Terhubung</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400">Menghubungkan...</span>
              </>
            )}
          </div>
        </div>
        <span>SIM Puskesmas Sehat Sentosa</span>
      </div>
    </div>
  );
}
