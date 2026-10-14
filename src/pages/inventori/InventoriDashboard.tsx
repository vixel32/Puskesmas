import { useEffect, useState } from 'react';
import { supabase, Obat } from '@/lib/supabase';
import { Card, Badge, TableWrapper, Th, Td, LoadingSpinner, EmptyState, PageTitle, StatCard } from '@/components/ui';
import { Package, AlertTriangle, CalendarX, TrendingDown, Boxes } from 'lucide-react';
import { formatDate, daysUntil } from '@/lib/types';

export default function InventoriDashboard({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [obatList, setObatList] = useState<Obat[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('obat').select('*').order('nama_obat', { ascending: true });
    setObatList((data || []) as Obat[]);
    setLoading(false);
  }

  if (loading) return <LoadingSpinner />;

  const lowStock = obatList.filter((o) => o.stok_saat_ini <= o.stok_minimum);
  const expiringSoon = obatList.filter((o) => {
    const days = daysUntil(o.tanggal_kadaluarsa);
    return days !== null && days <= 30 && days >= 0;
  });
  const expired = obatList.filter((o) => {
    const days = daysUntil(o.tanggal_kadaluarsa);
    return days !== null && days < 0;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard icon={Boxes} label="Total Jenis Obat" value={obatList.length} color="sky" />
        <StatCard icon={TrendingDown} label="Stok Menipis" value={lowStock.length} color="amber" subtitle="Di bawah stok minimum" />
        <StatCard icon={CalendarX} label="Mendekati Kadaluarsa" value={expiringSoon.length} color="rose" subtitle="Dalam 30 hari" />
        <StatCard icon={AlertTriangle} label="Sudah Kadaluarsa" value={expired.length} color="rose" />
      </div>

      {(lowStock.length > 0 || expiringSoon.length > 0 || expired.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {lowStock.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-800">Perlu Restock</h3>
                <Badge color="amber">{lowStock.length}</Badge>
              </div>
              <div className="space-y-2">
                {lowStock.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{o.nama_obat}</span>
                    <Badge color="rose">{o.stok_saat_ini} / {o.stok_minimum}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {expiringSoon.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <CalendarX className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-800">Mendekati Kadaluarsa</h3>
                <Badge color="rose">{expiringSoon.length}</Badge>
              </div>
              <div className="space-y-2">
                {expiringSoon.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{o.nama_obat}</span>
                    <span className="text-xs text-rose-600 font-medium">{formatDate(o.tanggal_kadaluarsa)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {expired.length > 0 && (
            <Card className="p-5 border-rose-200">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-800">Sudah Kadaluarsa</h3>
                <Badge color="rose">{expired.length}</Badge>
              </div>
              <div className="space-y-2">
                {expired.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{o.nama_obat}</span>
                    <span className="text-xs text-rose-600 font-medium">{formatDate(o.tanggal_kadaluarsa)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Daftar Obat</h3>
          <button onClick={() => onNavigate('inventori-obat')} className="text-sm font-medium text-sky-600 hover:text-sky-700">
            Kelola Obat →
          </button>
        </div>
        {obatList.length === 0 ? (
          <EmptyState icon={Package} title="Belum ada obat" />
        ) : (
          <TableWrapper>
            <thead><tr><Th>Nama Obat</Th><Th>Kategori</Th><Th>Stok</Th><Th>Min. Stok</Th><Th>Kadaluarsa</Th><Th>Status</Th></tr></thead>
            <tbody>
              {obatList.slice(0, 10).map((o) => {
                const days = daysUntil(o.tanggal_kadaluarsa);
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-700">{o.nama_obat}</Td>
                    <Td><Badge color="slate">{o.kategori || '-'}</Badge></Td>
                    <Td><span className={o.stok_saat_ini <= o.stok_minimum ? 'text-rose-600 font-bold' : 'text-slate-600'}>{o.stok_saat_ini}</span></Td>
                    <Td className="text-slate-500">{o.stok_minimum}</Td>
                    <Td className="whitespace-nowrap">{formatDate(o.tanggal_kadaluarsa)}</Td>
                    <Td>
                      {o.stok_saat_ini <= o.stok_minimum && <Badge color="rose">Stok Rendah</Badge>}
                      {days !== null && days < 0 && <Badge color="rose">Kadaluarsa</Badge>}
                      {days !== null && days >= 0 && days <= 30 && <Badge color="amber">H-{days}</Badge>}
                      {o.stok_saat_ini > o.stok_minimum && (days === null || days > 30) && <Badge color="emerald">Aman</Badge>}
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
