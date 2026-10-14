import { useEffect, useState } from 'react';
import { supabase, Kunjungan } from '@/lib/supabase';
import { Card, Badge, TableWrapper, Th, Td, SearchInput, Select, LoadingSpinner, EmptyState, Button, PageTitle, Pagination, usePagination } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { POLI_OPTIONS, STATUS_KUNJUNGAN_LABELS } from '@/lib/types';
import { ClipboardList, Bell, UserCheck, XCircle, Stethoscope, CheckCircle } from 'lucide-react';

export default function ManajemenAntrian() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Kunjungan[]>([]);
  const [search, setSearch] = useState('');
  const [poliFilter, setPoliFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { page, setPage, totalPages, paginated } = usePagination(filteredVisits(), 10);

  function filteredVisits() {
    return visits.filter((v) => {
      if (poliFilter && v.poli_tujuan !== poliFilter) return false;
      if (statusFilter && v.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          v.pasien?.nama?.toLowerCase().includes(s) ||
          v.no_antrian?.toLowerCase().includes(s) ||
          v.pasien?.no_rekam_medis?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }

  useEffect(() => {
    loadVisits();
  }, []);

  async function loadVisits() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('kunjungan')
      .select('*, pasien(*)')
      .eq('tanggal_kunjungan', today)
      .order('created_at', { ascending: true });

    if (!error) setVisits(data as Kunjungan[]);
    setLoading(false);
  }

  async function updateStatus(visit: Kunjungan, newStatus: string) {
    const { error } = await supabase
      .from('kunjungan')
      .update({ status: newStatus })
      .eq('id', visit.id);

    if (error) {
      toast('Gagal update status: ' + error.message, 'error');
    } else {
      toast(`Status antrian ${visit.no_antrian} diubah ke ${newStatus}`, 'success');
      setVisits((prev) => prev.map((v) => (v.id === visit.id ? { ...v, status: newStatus as Kunjungan['status'] } : v)));
    }
  }

  if (loading) return <LoadingSpinner />;

  const statusBadge = (status: string) => {
    const colors: Record<string, 'sky' | 'amber' | 'emerald' | 'rose' | 'teal'> = {
      menunggu: 'sky',
      dipanggil: 'amber',
      diperiksa: 'teal',
      selesai: 'emerald',
      batal: 'rose',
    };
    return <Badge color={colors[status] || 'slate'}>{STATUS_KUNJUNGAN_LABELS[status] || status}</Badge>;
  };

  return (
    <div>
      <PageTitle title="Manajemen Antrian" subtitle="Kelola antrian kunjungan hari ini" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
            <Bell className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Menunggu</p>
            <p className="text-xl font-bold text-slate-800">{visits.filter((v) => v.status === 'menunggu').length}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Dipanggil</p>
            <p className="text-xl font-bold text-slate-800">{visits.filter((v) => v.status === 'dipanggil').length}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Diperiksa</p>
            <p className="text-xl font-bold text-slate-800">{visits.filter((v) => v.status === 'diperiksa').length}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Selesai</p>
            <p className="text-xl font-bold text-slate-800">{visits.filter((v) => v.status === 'selesai').length}</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama, no. antrian, No. RM..." />
          <Select
            value={poliFilter}
            onChange={setPoliFilter}
            placeholder="Semua Poli"
            options={POLI_OPTIONS.map((p) => ({ value: p, label: p }))}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Semua Status"
            options={[
              { value: 'menunggu', label: 'Menunggu' },
              { value: 'dipanggil', label: 'Dipanggil' },
              { value: 'diperiksa', label: 'Diperiksa' },
              { value: 'selesai', label: 'Selesai' },
              { value: 'batal', label: 'Batal' },
            ]}
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Tidak ada antrian" subtitle="Belum ada kunjungan hari ini" />
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>No. Antrian</Th>
                <Th>Pasien</Th>
                <Th>No. RM</Th>
                <Th>Poli</Th>
                <Th>Pembiayaan</Th>
                <Th>Keluhan</Th>
                <Th>Status</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <Td><span className="font-mono font-bold text-sky-600">{v.no_antrian || '-'}</span></Td>
                  <Td className="font-medium text-slate-700">{v.pasien?.nama || '-'}</Td>
                  <Td className="text-slate-500">{v.pasien?.no_rekam_medis || '-'}</Td>
                  <Td><Badge color="teal">{v.poli_tujuan}</Badge></Td>
                  <Td><Badge color={v.pembiayaan === 'BPJS' ? 'sky' : 'slate'}>{v.pembiayaan || 'Umum'}</Badge></Td>
                  <Td className="max-w-xs truncate text-slate-500">{v.keluhan_awal || '-'}</Td>
                  <Td>{statusBadge(v.status)}</Td>
                  <Td>
                    <div className="flex gap-1">
                      {v.status === 'menunggu' && (
                        <Button size="sm" variant="secondary" onClick={() => updateStatus(v, 'dipanggil')}>
                          Panggil
                        </Button>
                      )}
                      {v.status === 'dipanggil' && (
                        <Button size="sm" variant="secondary" onClick={() => updateStatus(v, 'diperiksa')}>
                          Periksa
                        </Button>
                      )}
                      {(v.status === 'menunggu' || v.status === 'dipanggil') && (
                        <Button size="sm" variant="danger" onClick={() => updateStatus(v, 'batal')}>
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {v.status === 'diperiksa' && (
                        <Button size="sm" variant="success" onClick={() => updateStatus(v, 'selesai')}>
                          <CheckCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
        <div className="p-4">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </Card>
    </div>
  );
}
