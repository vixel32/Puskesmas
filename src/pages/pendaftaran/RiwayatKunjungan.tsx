import { useEffect, useState } from 'react';
import { supabase, Kunjungan } from '@/lib/supabase';
import { Card, Badge, TableWrapper, Th, Td, SearchInput, Select, LoadingSpinner, EmptyState, PageTitle, Pagination, usePagination, Modal, Button } from '@/components/ui';
import { History, FileText } from 'lucide-react';
import { formatDate, STATUS_KUNJUNGAN_LABELS, calcAge, POLI_OPTIONS } from '@/lib/types';

export default function RiwayatKunjungan() {
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Kunjungan[]>([]);
  const [search, setSearch] = useState('');
  const [poliFilter, setPoliFilter] = useState('');
  const [detailVisit, setDetailVisit] = useState<Kunjungan | null>(null);
  const [examDetail, setExamDetail] = useState<any>(null);
  const { page, setPage, totalPages, paginated } = usePagination(filtered(), 10);

  function filtered() {
    return visits.filter((v) => {
      if (poliFilter && v.poli_tujuan !== poliFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return v.pasien?.nama?.toLowerCase().includes(s) || v.pasien?.no_rekam_medis?.toLowerCase().includes(s) || v.no_antrian?.toLowerCase().includes(s);
      }
      return true;
    });
  }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('kunjungan').select('*, pasien(*)').order('tanggal_kunjungan', { ascending: false }).limit(200);
    setVisits((data || []) as Kunjungan[]);
    setLoading(false);
  }

  async function showDetail(visit: Kunjungan) {
    setDetailVisit(visit);
    const { data } = await supabase.from('pemeriksaan').select('*, dokter:profiles(*)').eq('kunjungan_id', visit.id).maybeSingle();
    setExamDetail(data);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageTitle title="Riwayat Kunjungan" subtitle="Daftar semua kunjungan pasien" />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama, No. RM, no. antrian..." />
          <Select value={poliFilter} onChange={setPoliFilter} placeholder="Semua Poli" options={POLI_OPTIONS.map((p) => ({ value: p, label: p }))} />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState icon={History} title="Tidak ada riwayat" />
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>Tanggal</Th><Th>No. Antrian</Th><Th>Pasien</Th><Th>No. RM</Th><Th>Poli</Th><Th>Pembiayaan</Th><Th>Keluhan</Th><Th>Status</Th><Th>Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap">{formatDate(v.tanggal_kunjungan)}</Td>
                  <Td><span className="font-mono font-bold text-sky-600">{v.no_antrian || '-'}</span></Td>
                  <Td className="font-medium text-slate-700">{v.pasien?.nama || '-'}</Td>
                  <Td className="text-slate-500">{v.pasien?.no_rekam_medis || '-'}</Td>
                  <Td><Badge color="teal">{v.poli_tujuan}</Badge></Td>
                  <Td><Badge color={v.pembiayaan === 'BPJS' ? 'sky' : 'slate'}>{v.pembiayaan || 'Umum'}</Badge></Td>
                  <Td className="max-w-xs truncate text-slate-500">{v.keluhan_awal || '-'}</Td>
                  <Td><Badge color={v.status === 'selesai' ? 'emerald' : v.status === 'batal' ? 'rose' : v.status === 'diperiksa' ? 'teal' : 'sky'}>{STATUS_KUNJUNGAN_LABELS[v.status] || v.status}</Badge></Td>
                  <Td>
                    <Button size="sm" variant="ghost" onClick={() => showDetail(v)}>
                      <FileText className="w-4 h-4" /> Detail
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
        <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
      </Card>

      <Modal open={!!detailVisit} onClose={() => { setDetailVisit(null); setExamDetail(null); }} title="Detail Kunjungan" size="lg">
        {detailVisit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50">
              <div><p className="text-xs text-slate-500">Pasien</p><p className="font-semibold text-slate-700">{detailVisit.pasien?.nama}</p></div>
              <div><p className="text-xs text-slate-500">No. Rekam Medis</p><p className="font-semibold text-slate-700">{detailVisit.pasien?.no_rekam_medis}</p></div>
              <div><p className="text-xs text-slate-500">Tanggal Kunjungan</p><p className="text-slate-600">{formatDate(detailVisit.tanggal_kunjungan)}</p></div>
              <div><p className="text-xs text-slate-500">No. Antrian</p><p className="font-mono font-bold text-sky-600">{detailVisit.no_antrian}</p></div>
              <div><p className="text-xs text-slate-500">Poli</p><Badge color="teal">{detailVisit.poli_tujuan}</Badge></div>
              <div><p className="text-xs text-slate-500">Pembiayaan</p><Badge color={detailVisit.pembiayaan === 'BPJS' ? 'sky' : 'slate'}>{detailVisit.pembiayaan || 'Umum'}</Badge></div>
              <div><p className="text-xs text-slate-500">Usia</p><p className="text-slate-600">{calcAge(detailVisit.pasien?.tanggal_lahir)} tahun</p></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Keluhan Awal</p>
              <p className="text-sm text-slate-600 p-3 rounded-lg bg-slate-50">{detailVisit.keluhan_awal || '-'}</p>
            </div>
            {examDetail ? (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-bold text-slate-700 mb-3">Hasil Pemeriksaan</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-slate-500">Dokter</p><p className="text-slate-600">{examDetail.dokter?.nama_lengkap || '-'}</p></div>
                  <div><p className="text-xs text-slate-500">Tekanan Darah</p><p className="text-slate-600">{examDetail.tekanan_darah || '-'}</p></div>
                  <div><p className="text-xs text-slate-500">Suhu</p><p className="text-slate-600">{examDetail.suhu ? examDetail.suhu + '°C' : '-'}</p></div>
                  <div><p className="text-xs text-slate-500">Berat Badan</p><p className="text-slate-600">{examDetail.berat_badan ? examDetail.berat_badan + ' kg' : '-'}</p></div>
                  <div><p className="text-xs text-slate-500">Tinggi Badan</p><p className="text-slate-600">{examDetail.tinggi_badan ? examDetail.tinggi_badan + ' cm' : '-'}</p></div>
                  <div><p className="text-xs text-slate-500">ICD-10</p><p className="text-slate-600">{examDetail.icd10_kode || '-'}</p></div>
                </div>
                <div className="mt-3"><p className="text-xs text-slate-500">Diagnosa</p><p className="text-sm text-slate-600">{examDetail.diagnosa || '-'}</p></div>
                <div className="mt-2"><p className="text-xs text-slate-500">Catatan Dokter</p><p className="text-sm text-slate-600">{examDetail.catatan_dokter || '-'}</p></div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4 border-t border-slate-100">Belum ada hasil pemeriksaan</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
