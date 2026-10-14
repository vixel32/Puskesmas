import { useEffect, useState } from 'react';
import { supabase, Resep } from '@/lib/supabase';
import { Card, Badge, TableWrapper, Th, Td, LoadingSpinner, EmptyState, Button, StatCard } from '@/components/ui';
import { Pill, Clock, CheckCircle, AlertTriangle, Package } from 'lucide-react';
import { formatDate } from '@/lib/types';

export default function ApotekerDashboard({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [resepList, setResepList] = useState<Resep[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('resep')
      .select('*, pemeriksaan(*, kunjungan(*, pasien(*))), dokter:profiles(*), resep_detail(*, obat:obat(*))')
      .order('created_at', { ascending: false })
      .limit(50);
    setResepList((data || []) as Resep[]);
    setLoading(false);
  }

  if (loading) return <LoadingSpinner />;

  const menunggu = resepList.filter((r) => r.status === 'menunggu');
  const diproses = resepList.filter((r) => r.status === 'diproses');
  const selesai = resepList.filter((r) => r.status === 'selesai');
  const stockIssues = menunggu.filter((r) =>
    (r.resep_detail || []).some((d) => d.obat && d.jumlah > d.obat.stok_saat_ini)
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Resep Menunggu" value={menunggu.length} color="amber" />
        <StatCard icon={Pill} label="Sedang Diproses" value={diproses.length} color="sky" />
        <StatCard icon={CheckCircle} label="Selesai" value={selesai.length} color="emerald" />
        <StatCard icon={AlertTriangle} label="Stok Kurang" value={stockIssues.length} color="rose" subtitle="Resep dengan stok tidak cukup" />
      </div>

      {stockIssues.length > 0 && (
        <Card className="p-4 border-rose-200 bg-rose-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <p className="text-sm text-rose-700 font-medium">
              Ada {stockIssues.length} resep dengan obat yang stoknya tidak cukup. Hubungi petugas inventori.
            </p>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100"><h3 className="text-base font-bold text-slate-800">Resep Masuk</h3></div>
        {resepList.length === 0 ? (
          <EmptyState icon={Pill} title="Tidak ada resep" subtitle="Belum ada resep yang masuk" />
        ) : (
          <TableWrapper>
            <thead>
              <tr><Th>Tanggal</Th><Th>Pasien</Th><Th>Dokter</Th><Th>Jumlah Obat</Th><Th>Status</Th><Th>Aksi</Th></tr>
            </thead>
            <tbody>
              {resepList.map((r) => {
                const hasStockIssue = (r.resep_detail || []).some((d) => d.obat && d.jumlah > d.obat.stok_saat_ini);
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap">{formatDate(r.tanggal_resep)}</Td>
                    <Td className="font-medium text-slate-700">{r.pemeriksaan?.kunjungan?.pasien?.nama || '-'}</Td>
                    <Td className="text-slate-500">{r.dokter?.nama_lengkap || '-'}</Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        {r.resep_detail?.length || 0} item
                        {hasStockIssue && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                      </div>
                    </Td>
                    <Td><Badge color={r.status === 'selesai' ? 'emerald' : r.status === 'diproses' ? 'amber' : 'sky'}>{r.status}</Badge></Td>
                    <Td>
                      <Button size="sm" onClick={() => onNavigate(`apoteker-detail:${r.id}`)}>Detail</Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        )}
      </Card>
    </div>
  );
}
