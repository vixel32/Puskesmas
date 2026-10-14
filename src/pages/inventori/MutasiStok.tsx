import { useEffect, useState } from 'react';
import { supabase, Obat, LogMutasi, BatchStok } from '@/lib/supabase';
import { Card, Badge, TableWrapper, Th, Td, SearchInput, Select, Combobox, LoadingSpinner, EmptyState, PageTitle, Pagination, usePagination, Modal, Input, Button } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { ArrowDownUp, Download, AlertTriangle, RotateCcw, Clock, CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/types';

type JenisMutasi = 'masuk' | 'keluar' | 'penyesuaian' | 'kembali_supplier';

const SUMBER_TUJUAN_OPTIONS = [
  'Gudang Utama', 'Dinas Kesehatan', 'Poli Gigi', 'Poli Umum',
  'Pustu', 'Poskesdes', 'Posyandu', 'Apotek', 'Supplier',
  'Pelayanan Resep', 'Stock Opname',
];

interface ExpiredBatch extends BatchStok {
  obat?: Obat;
}

export default function MutasiStok() {
  const toast = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingRetur, setProcessingRetur] = useState(false);
  const [mutasiList, setMutasiList] = useState<LogMutasi[]>([]);
  const [obatList, setObatList] = useState<Obat[]>([]);
  const [expiredBatches, setExpiredBatches] = useState<ExpiredBatch[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [returModal, setReturModal] = useState(false);
  const [form, setForm] = useState({
    obat_id: '',
    jenis_mutasi: 'keluar' as JenisMutasi,
    jumlah: '',
    sumber_tujuan: '',
    keterangan: '',
  });
  const [batches, setBatches] = useState<BatchStok[]>([]);
  const { page, setPage, totalPages, paginated } = usePagination(filtered(), 15);

  function filtered() {
    let result = mutasiList;
    if (typeFilter) result = result.filter((m) => m.jenis_mutasi === typeFilter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((m) =>
        m.obat?.nama_obat?.toLowerCase().includes(s) ||
        m.sumber_tujuan?.toLowerCase().includes(s) ||
        m.nomor_batch?.toLowerCase().includes(s) ||
        m.nama_petugas?.toLowerCase().includes(s)
      );
    }
    return result;
  }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [m, o, eb] = await Promise.all([
      supabase.from('log_mutasi').select('*, obat:obat(*)').order('timestamp', { ascending: false }).limit(300),
      supabase.from('obat').select('*').order('nama_obat', { ascending: true }),
      supabase.from('batch_stok')
        .select('*, obat:obat(*)')
        .gt('jumlah_stok', 0)
        .lt('tanggal_kadaluarsa', new Date().toISOString().split('T')[0])
        .eq('status_retur', 'normal')
        .order('tanggal_kadaluarsa', { ascending: true }),
    ]);
    setMutasiList((m.data || []) as LogMutasi[]);
    setObatList((o.data || []) as Obat[]);
    setExpiredBatches((eb.data || []) as ExpiredBatch[]);
    setLoading(false);
  }

  async function onObatChange(obatId: string) {
    setForm({ ...form, obat_id: obatId });
    if (obatId) {
      const { data } = await supabase
        .from('batch_stok')
        .select('*')
        .eq('obat_id', obatId)
        .gt('jumlah_stok', 0)
        .order('tanggal_kadaluarsa', { ascending: true, nullsFirst: true });
      setBatches((data || []) as BatchStok[]);
    } else {
      setBatches([]);
    }
  }

  async function save() {
    if (!form.obat_id) { toast('Pilih obat', 'warning'); return; }
    const jumlah = parseInt(form.jumlah);
    if (isNaN(jumlah) || jumlah < 1) { toast('Jumlah minimal 1', 'warning'); return; }
    if (!form.sumber_tujuan.trim()) { toast('Isi sumber/tujuan', 'warning'); return; }

    const obat = obatList.find((o) => o.id === form.obat_id);
    if (!obat) { toast('Obat tidak ditemukan', 'error'); return; }

    setSaving(true);

    const isPenyesuaian = form.jenis_mutasi === 'penyesuaian';
    const adjJumlah = isPenyesuaian && form.jumlah.startsWith('-') ? -jumlah : jumlah;

    const { data: result, error } = await supabase.rpc('record_mutasi', {
      p_obat_id: form.obat_id,
      p_jenis_mutasi: form.jenis_mutasi,
      p_jumlah: adjJumlah,
      p_sumber_tujuan: form.sumber_tujuan,
      p_keterangan: form.keterangan,
      p_petugas_id: profile?.id,
      p_petugas_nama: profile?.nama_lengkap || '',
    });

    if (error) {
      toast('Gagal mencatat mutasi: ' + error.message, 'error');
    } else {
      const r = result as any;
      if (r && r.success === false) {
        toast(r.error || 'Gagal mencatat mutasi', 'error');
      } else {
        if (form.jenis_mutasi === 'keluar') {
          toast(`Stok keluar berhasil: ${jumlah} ${obat.satuan} ke ${form.sumber_tujuan}`, 'success');
        } else if (form.jenis_mutasi === 'masuk') {
          toast(`Stok masuk berhasil: +${jumlah} ${obat.satuan} dari ${form.sumber_tujuan}`, 'success');
        } else if (form.jenis_mutasi === 'kembali_supplier') {
          toast(`Retur ke supplier berhasil: ${jumlah} ${obat.satuan} ke ${form.sumber_tujuan}`, 'success');
        } else {
          toast(`Penyesuaian stok: ${adjJumlah > 0 ? '+' : ''}${adjJumlah} ${obat.satuan}`, 'success');
        }
        setAddModal(false);
        setForm({ obat_id: '', jenis_mutasi: 'keluar', jumlah: '', sumber_tujuan: '', keterangan: '' });
        setBatches([]);
        load();
      }
    }
    setSaving(false);
  }

  async function processExpiredAutoRetur() {
    setProcessingRetur(true);
    const { data, error } = await supabase.rpc('process_expired_batches');

    if (error) {
      toast('Gagal memproses retur otomatis: ' + error.message, 'error');
    } else {
      const r = data as any;
      if (r && r.success) {
        const count = r.count || 0;
        if (count === 0) {
          toast('Tidak ada obat kadaluarsa yang perlu diretur', 'info');
        } else {
          toast(`${count} batch obat kadaluarsa berhasil diproses retur ke supplier`, 'success');
        }
        setReturModal(false);
        load();
      } else {
        toast((r as any)?.error || 'Gagal memproses retur', 'error');
      }
    }
    setProcessingRetur(false);
  }

  function exportExcel() {
    const data = filtered();
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const jenisLabel = (j: string): string => {
      if (j === 'masuk') return 'Stok Masuk';
      if (j === 'keluar') return 'Stok Keluar';
      if (j === 'kembali_supplier') return 'Retur Supplier';
      return 'Penyesuaian';
    };
    const tMasuk = data.filter((m) => m.jumlah > 0).reduce((s, m) => s + m.jumlah, 0);
    const tKeluar = data.filter((m) => m.jumlah < 0).reduce((s, m) => s + Math.abs(m.jumlah), 0);

    const bodyRows = data.length === 0
      ? '<tr><td colspan="11" style="text-align:center;padding:20px;color:#94a3b8">Tidak ada data mutasi</td></tr>'
      : data.map((m, i) => {
          const jColor = m.jumlah > 0 ? '#059669' : '#e11d48';
          const jSign = m.jumlah > 0 ? '+' : '';
          return `<tr>
            <td style="text-align:center">${i + 1}</td>
            <td style="white-space:nowrap">${esc(formatDate(m.timestamp))}</td>
            <td>${esc(m.obat?.nama_obat || '-')}</td>
            <td style="text-align:center">${esc(m.nomor_batch || '-')}</td>
            <td style="text-align:center">${jenisLabel(m.jenis_mutasi)}</td>
            <td style="text-align:right;font-weight:bold;color:${jColor}">${jSign}${m.jumlah}</td>
            <td>${esc(m.sumber_tujuan || '-')}</td>
            <td style="text-align:right">${m.stok_awal}</td>
            <td style="text-align:right;font-weight:bold">${m.stok_akhir}</td>
            <td>${esc(m.nama_petugas || '-')}</td>
            <td>${esc(m.keterangan || '-')}</td>
          </tr>`;
        }).join('');

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<meta name="ProgId" content="Excel.Sheet">
<meta name="Generator" content="Microsoft Excel">
<!--[if gte mso 9]><xml>
<x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Mutasi Stok</x:Name>
<x:WorksheetOptions><x:Selected/><x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>6</x:SplitHorizontal><x:TopRowBottomPane>6</x:TopRowBottomPane></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
</xml><![endif]-->
<style>
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  .report-header { width: 100%; margin-bottom: 12px; }
  .report-header td { border: 0; padding: 2px 0; text-align: center; font-family: Calibri, Arial, sans-serif; }
  .facility { color: #0f6b9d; font-size: 16pt; font-weight: bold; }
  .report-title { color: #1e293b; font-size: 13pt; font-weight: bold; }
  .report-meta { color: #64748b; font-size: 10pt; }
  .summary { width: 100%; margin-bottom: 12px; }
  .summary td { border: 1px solid #dbe4ee; background-color: #f8fafc; padding: 6px 10px; font-family: Calibri, Arial, sans-serif; font-size: 10pt; }
  .summary-label { color: #475569; font-weight: bold; }
  .summary-value { font-weight: bold; text-align: right; }
  .data-table { width: 100%; table-layout: fixed; }
  td, th { border: 1px solid #cbd5e1; padding: 6px 8px; font-family: Calibri, Arial, sans-serif; font-size: 10pt; vertical-align: middle; }
  th { background-color: #0ea5e9; color: #ffffff; font-weight: bold; text-align: center; border-color: #0284c7; height: 34px; }
  tr:nth-child(even) td { background-color: #f8fafc; }
</style>
</head>
<body>
<table class="report-header" cellspacing="0" cellpadding="0">
  <tr><td class="facility" colspan="11">PUSKESMAS SEHAT SENTOSA</td></tr>
  <tr><td class="report-title" colspan="11">LAPORAN MUTASI STOK OBAT</td></tr>
  <tr><td class="report-meta" colspan="11">Periode data sesuai filter yang dipilih &nbsp;|&nbsp; Tanggal export: ${esc(today)}</td></tr>
</table>
<table class="summary" cellspacing="0" cellpadding="0">
  <tr><td class="summary-label">Total Transaksi</td><td class="summary-value">${data.length}</td><td class="summary-label">Total Stok Masuk</td><td class="summary-value" style="color:#059669">+${tMasuk} unit</td><td class="summary-label">Total Stok Keluar</td><td class="summary-value" style="color:#e11d48">-${tKeluar} unit</td></tr>
</table>
<table class="data-table" border="1" cellspacing="0" cellpadding="0">
<thead>
<tr>
  <th style="width:40px">No</th>
  <th style="width:130px">Waktu</th>
  <th style="width:160px">Nama Obat</th>
  <th style="width:90px">No. Batch</th>
  <th style="width:110px">Jenis Mutasi</th>
  <th style="width:70px">Jumlah</th>
  <th style="width:170px">Sumber/Tujuan</th>
  <th style="width:75px">Stok Awal</th>
  <th style="width:75px">Stok Akhir</th>
  <th style="width:120px">Petugas</th>
  <th style="width:240px">Keterangan</th>
</tr>
</thead>
<tbody>
${bodyRows}
</tbody>
</table>
</body>
</html>`;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Mutasi_Stok_${new Date().toISOString().replace(/[:.]/g, '-')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (loading) return <LoadingSpinner />;

  const jenisBadge = (jenis: string) => {
    if (jenis === 'masuk') return <Badge color="emerald">Masuk</Badge>;
    if (jenis === 'keluar') return <Badge color="rose">Keluar</Badge>;
    if (jenis === 'kembali_supplier') return <Badge color="violet">Retur Supplier</Badge>;
    return <Badge color="amber">Penyesuaian</Badge>;
  };

  const totalMasuk = mutasiList.filter((m) => m.jumlah > 0).reduce((s, m) => s + m.jumlah, 0);
  const totalKeluar = mutasiList.filter((m) => m.jumlah < 0).reduce((s, m) => s + Math.abs(m.jumlah), 0);

  return (
    <div>
      <PageTitle title="Mutasi Stok Obat" subtitle="Mencatat dan melacak setiap pergerakan keluar-masuk stok" />

      {/* Expired drug alert banner */}
      {expiredBatches.length > 0 && (
        <Card className="p-5 mb-6 border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-rose-800">Obat Kadaluarsa Terdeteksi — {expiredBatches.length} Batch Perlu Diretur</h3>
              <p className="text-sm text-rose-600 mt-1 mb-3">
                Sistem mendeteksi batch obat yang sudah lewat tanggal kadaluarsa dan masih memiliki stok.
                Klik "Proses Retur Otomatis" untuk mengembalikan semua obat kadaluarsa ke supplier asalnya.
              </p>
              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                {expiredBatches.slice(0, 5).map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-sm bg-white/60 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-slate-700">{b.obat?.nama_obat || 'Obat tidak ditemukan'}</span>
                      <Badge color="slate">Batch: {b.nomor_batch || '-'}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-rose-600 font-medium">Exp: {b.tanggal_kadaluarsa ? formatDate(b.tanggal_kadaluarsa) : '-'}</span>
                      <span className="text-slate-600">Stok: <strong>{b.jumlah_stok}</strong></span>
                      <Badge color="sky">Supplier: {b.supplier || '-'}</Badge>
                    </div>
                  </div>
                ))}
                {expiredBatches.length > 5 && (
                  <p className="text-xs text-slate-500 pl-3">...dan {expiredBatches.length - 5} batch lainnya</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="danger" onClick={() => setReturModal(true)}>
                  <RotateCcw className="w-4 h-4" /> Proses Retur Otomatis
                </Button>
                <Button variant="secondary" onClick={() => setReturModal(true)}>
                  Lihat Detail
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
              <ArrowDownUp className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Transaksi</p>
              <p className="text-lg font-bold text-slate-800">{mutasiList.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <span className="text-rose-600 font-bold text-sm">OUT</span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Stok Keluar</p>
              <p className="text-lg font-bold text-rose-600">{totalKeluar}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <span className="text-emerald-600 font-bold text-sm">IN</span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Stok Masuk</p>
              <p className="text-lg font-bold text-emerald-600">{totalMasuk}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 max-w-xl">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari obat, batch, tujuan..." />
          <Select value={typeFilter} onChange={setTypeFilter} placeholder="Semua Jenis" options={[
            {value:'masuk',label:'Stok Masuk'},
            {value:'keluar',label:'Stok Keluar'},
            {value:'penyesuaian',label:'Penyesuaian'},
            {value:'kembali_supplier',label:'Retur Supplier'},
          ]} />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAddModal(true)}><ArrowDownUp className="w-4 h-4" /> Catat Mutasi</Button>
          <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium hover:bg-emerald-100 transition-all">
            <Download className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState icon={ArrowDownUp} title="Tidak ada mutasi" subtitle="Belum ada pergerakan stok tercatat" />
        ) : (
          <TableWrapper>
            <thead><tr><Th>Waktu</Th><Th>Obat</Th><Th>No. Batch</Th><Th>Jenis</Th><Th>Jumlah</Th><Th>Sumber/Tujuan</Th><Th>Stok Awal</Th><Th>Stok Akhir</Th><Th>Petugas</Th><Th>Keterangan</Th></tr></thead>
            <tbody>
              {paginated.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap text-xs">{formatDate(m.timestamp)}</Td>
                  <Td className="font-medium text-slate-700">{m.obat?.nama_obat || '-'}</Td>
                  <Td className="text-slate-500 font-mono text-xs">{m.nomor_batch || '-'}</Td>
                  <Td>{jenisBadge(m.jenis_mutasi)}</Td>
                  <Td>
                    <span className={`font-bold ${m.jumlah > 0 ? 'text-emerald-600' : m.jumlah < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {m.jumlah > 0 ? '+' : ''}{m.jumlah}
                    </span>
                  </Td>
                  <Td className="text-slate-600">{m.sumber_tujuan}</Td>
                  <Td className="text-slate-500">{m.stok_awal}</Td>
                  <Td className="text-slate-700 font-medium">{m.stok_akhir}</Td>
                  <Td className="text-slate-500 text-xs">{m.nama_petugas}</Td>
                  <Td className="text-slate-500 text-xs">{m.keterangan || '-'}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
        <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
      </Card>

      {/* Manual mutation modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Catat Mutasi Stok" size="lg">
        <div className="space-y-4">
          <Select label="Obat" value={form.obat_id} onChange={onObatChange} placeholder="Pilih obat" required options={obatList.map((o) => ({ value: o.id, label: `${o.nama_obat} (Stok: ${o.stok_saat_ini} ${o.satuan})` }))} />

          {form.jenis_mutasi === 'keluar' && batches.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-medium text-amber-700 mb-2">Batch tersedia (urutan FEFO - paling dekat kadaluarsa):</p>
              <div className="space-y-1">
                {batches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-xs text-slate-600">
                    <span>Batch: {b.nomor_batch || '-'}</span>
                    <span className={b.tanggal_kadaluarsa ? 'text-amber-600' : ''}>
                      Exp: {b.tanggal_kadaluarsa ? formatDate(b.tanggal_kadaluarsa) : '-'}
                    </span>
                    <span className="font-medium">Stok: {b.jumlah_stok}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Jenis Mutasi"
              value={form.jenis_mutasi}
              onChange={(v) => setForm({ ...form, jenis_mutasi: v as JenisMutasi })}
              options={[
                { value: 'keluar', label: 'Keluar (-)' },
                { value: 'masuk', label: 'Masuk (+)' },
                { value: 'penyesuaian', label: 'Penyesuaian (+/-)' },
                { value: 'kembali_supplier', label: 'Retur ke Supplier (-)' },
              ]}
              required
            />
            <Input
              label={form.jenis_mutasi === 'penyesuaian' ? 'Jumlah (gunakan - untuk kurang)' : 'Jumlah'}
              type="number"
              value={form.jumlah}
              onChange={(v) => setForm({ ...form, jumlah: v })}
              required
            />
          </div>

          <Combobox
            label="Sumber / Tujuan"
            value={form.sumber_tujuan}
            onChange={(v) => setForm({ ...form, sumber_tujuan: v })}
            options={SUMBER_TUJUAN_OPTIONS}
            placeholder="Pilih atau ketik sumber/tujuan"
          />

          <Input
            label="Keterangan"
            value={form.keterangan}
            onChange={(v) => setForm({ ...form, keterangan: v })}
            placeholder="Catatan tambahan..."
          />

          <div className="flex gap-3 pt-2">
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving ? 'Menyimpan...' : 'Simpan Mutasi'}
            </Button>
            <Button variant="secondary" onClick={() => setAddModal(false)}>Batal</Button>
          </div>
        </div>
      </Modal>

      {/* Auto-retur confirmation modal */}
      <Modal open={returModal} onClose={() => setReturModal(false)} title="Retur Otomatis Obat Kadaluarsa" size="lg">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Konfirmasi Retur Otomatis</p>
              <p className="text-xs text-amber-700 mt-1">
                Sistem akan otomatis mengurangi stok dari semua batch kadaluarsa dan mencatat mutasi
                retur ke supplier asalnya. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
          </div>

          {expiredBatches.length === 0 ? (
            <EmptyState icon={CheckCircle} title="Tidak ada obat kadaluarsa" subtitle="Semua stok obat masih dalam masa berlaku" />
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <p className="text-sm font-medium text-slate-600">{expiredBatches.length} batch akan diproses:</p>
              {expiredBatches.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex-1">
                    <p className="font-medium text-slate-700 text-sm">{b.obat?.nama_obat || '-'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge color="slate">Batch: {b.nomor_batch || '-'}</Badge>
                      <Badge color="rose">Exp: {b.tanggal_kadaluarsa ? formatDate(b.tanggal_kadaluarsa) : '-'}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-700">{b.jumlah_stok} unit</p>
                    <p className="text-xs text-sky-600">→ {b.supplier || 'Supplier'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {expiredBatches.length > 0 && (
            <div className="flex gap-3 pt-2">
              <Button variant="danger" onClick={processExpiredAutoRetur} disabled={processingRetur} className="flex-1">
                {processingRetur ? 'Memproses...' : <><RotateCcw className="w-4 h-4" /> Proses Semua Retur ({expiredBatches.length})</>}
              </Button>
              <Button variant="secondary" onClick={() => setReturModal(false)}>Batal</Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
