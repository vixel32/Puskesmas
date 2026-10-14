import { useEffect, useState } from 'react';
import { supabase, Kunjungan } from '@/lib/supabase';
import { Card, Badge, TableWrapper, Th, Td, LoadingSpinner, EmptyState, PageTitle, Button, StatCard } from '@/components/ui';
import { Stethoscope, Clock, UserCheck, ClipboardList } from 'lucide-react';

export default function DokterDashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Kunjungan[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from('kunjungan').select('*, pasien(*)').eq('tanggal_kunjungan', today).in('status', ['menunggu', 'dipanggil', 'diperiksa']).order('no_antrian', { ascending: true });
    setVisits((data || []) as Kunjungan[]);
    setLoading(false);
  }

  if (loading) return <LoadingSpinner />;

  const waiting = visits.filter((v) => v.status === 'menunggu' || v.status === 'dipanggil');
  const inExam = visits.filter((v) => v.status === 'diperiksa');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Clock} label="Menunggu Diperiksa" value={waiting.length} color="amber" />
        <StatCard icon={Stethoscope} label="Sedang Diperiksa" value={inExam.length} color="teal" />
        <StatCard icon={ClipboardList} label="Total Antrian Hari Ini" value={visits.length} color="sky" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Antrian Pasien Hari Ini</h3>
        </div>
        {visits.length === 0 ? (
          <EmptyState icon={Stethoscope} title="Tidak ada antrian" subtitle="Belum ada pasien menunggu hari ini" />
        ) : (
          <TableWrapper>
            <thead>
              <tr><Th>No. Antrian</Th><Th>Pasien</Th><Th>No. RM</Th><Th>Poli</Th><Th>Pembiayaan</Th><Th>Keluhan</Th><Th>Status</Th><Th>Aksi</Th></tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <Td><span className="font-mono font-bold text-sky-600">{v.no_antrian || '-'}</span></Td>
                  <Td className="font-medium text-slate-700">{v.pasien?.nama || '-'}</Td>
                  <Td className="text-slate-500">{v.pasien?.no_rekam_medis || '-'}</Td>
                  <Td><Badge color="teal">{v.poli_tujuan}</Badge></Td>
                  <Td><Badge color={v.pembiayaan === 'BPJS' ? 'sky' : 'slate'}>{v.pembiayaan || 'Umum'}</Badge></Td>
                  <Td className="max-w-xs truncate text-slate-500">{v.keluhan_awal || '-'}</Td>
                  <Td><Badge color={v.status === 'diperiksa' ? 'teal' : 'amber'}>{v.status}</Badge></Td>
                  <Td>
                    <Button size="sm" onClick={() => onNavigate(`dokter-periksa:${v.id}`)}>
                      <UserCheck className="w-3.5 h-3.5" /> Periksa
                    </Button>
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
