import { useEffect, useState, useMemo } from 'react';
import { supabase, Obat, LogMutasi } from '@/lib/supabase';
import { Card, Badge, Button, Select, LoadingSpinner, EmptyState, PageTitle, StatCard, TableWrapper, Th, Td } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { FileBarChart, Download, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/types';

export default function LaporanStok() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [obatList, setObatList] = useState<Obat[]>([]);
  const [mutasiList, setMutasiList] = useState<LogMutasi[]>([]);
  const [bulan, setBulan] = useState(new Date().getMonth());
  const [tahun, setTahun] = useState(new Date().getFullYear());

  useEffect(() => { load(); }, [bulan, tahun]);

  async function load() {
    setLoading(true);
    const start = new Date(tahun, bulan, 1).toISOString().split('T')[0];
    const end = new Date(tahun, bulan + 1, 0).toISOString().split('T')[0];
    const [o, m] = await Promise.all([
      supabase.from('obat').select('*').order('nama_obat', { ascending: true }),
      supabase.from('log_mutasi').select('*, obat:obat(*)').gte('timestamp', start + 'T00:00:00').lte('timestamp', end + 'T23:59:59').order('timestamp', { ascending: true }),
    ]);
    setObatList((o.data || []) as Obat[]);
    setMutasiList((m.data || []) as LogMutasi[]);
    setLoading(false);
  }

  // Build LPLPO-style per-obat summary
  const lplpoData = useMemo(() => {
    return obatList.map((obat) => {
      const mutasi = mutasiList.filter((m) => m.obat_id === obat.id);
      const totalMasuk = mutasi.filter((m) => m.jumlah > 0).reduce((s, m) => s + m.jumlah, 0);
      const totalKeluar = mutasi.filter((m) => m.jumlah < 0).reduce((s, m) => s + Math.abs(m.jumlah), 0);
      const totalPenyesuaian = mutasi.filter((m) => m.jenis_mutasi === 'penyesuaian').reduce((s, m) => s + m.jumlah, 0);

      // Stok awal = stok saat ini - masuk + keluar - penyesuaian
      const stokAwal = obat.stok_saat_ini - totalMasuk + totalKeluar - totalPenyesuaian;
      const stokAkhir = obat.stok_saat_ini;

      return {
        obat,
        stokAwal,
        totalMasuk,
        totalKeluar,
        totalPenyesuaian,
        stokAkhir,
        jumlahTransaksi: mutasi.length,
      };
    }).filter((d) => d.jumlahTransaksi > 0 || d.stokAwal !== d.stokAkhir);
  }, [obatList, mutasiList]);

  const grandMasuk = lplpoData.reduce((s, d) => s + d.totalMasuk, 0);
  const grandKeluar = lplpoData.reduce((s, d) => s + d.totalKeluar, 0);
  const totalTransaksi = mutasiList.length;

  function exportExcel() {
    const monthName = new Date(tahun, bulan).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const bodyRows = lplpoData.length === 0
      ? '<tr><td colspan="10" style="text-align:center;padding:20px;color:#94a3b8">Tidak ada data</td></tr>'
      : lplpoData.map((d, i) => `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${esc(d.obat.kode_obat || '-')}</td>
        <td>${esc(d.obat.nama_obat)}</td>
        <td style="text-align:center">${esc(d.obat.satuan)}</td>
        <td style="text-align:right">${d.stokAwal}</td>
        <td style="text-align:right;color:#059669">${d.totalMasuk > 0 ? '+' + d.totalMasuk : '-'}</td>
        <td style="text-align:right;color:#e11d48">${d.totalKeluar > 0 ? '-' + d.totalKeluar : '-'}</td>
        <td style="text-align:right">${d.totalPenyesuaian !== 0 ? d.totalPenyesuaian : '-'}</td>
        <td style="text-align:right;font-weight:bold">${d.stokAkhir}</td>
        <td style="text-align:center">${d.obat.stok_minimum}</td>
      </tr>`).join('');

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<meta name="ProgId" content="Excel.Sheet">
<meta name="Generator" content="Microsoft Excel">
<!--[if gte mso 9]><xml>
<x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>LPLPO</x:Name>
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
  <tr><td class="facility" colspan="10">PUSKESMAS SEHAT SENTOSA</td></tr>
  <tr><td class="report-title" colspan="10">LAPORAN PERMINTAAN DAN PENGELUARAN OBAT (LPLPO)</td></tr>
  <tr><td class="report-meta" colspan="10">Periode: ${esc(monthName)} &nbsp;|&nbsp; Tanggal export: ${esc(today)}</td></tr>
</table>
<table class="summary" cellspacing="0" cellpadding="0">
  <tr><td class="summary-label">Total Obat Masuk</td><td class="summary-value" style="color:#059669">+${grandMasuk}</td><td class="summary-label">Total Obat Keluar</td><td class="summary-value" style="color:#e11d48">-${grandKeluar}</td><td class="summary-label">Total Transaksi</td><td class="summary-value">${totalTransaksi}</td></tr>
</table>
<table class="data-table" border="1" cellspacing="0" cellpadding="0">
<thead>
<tr>
  <th style="width:40px">No</th>
  <th style="width:100px">Kode Obat</th>
  <th style="width:180px">Nama Obat</th>
  <th style="width:70px">Satuan</th>
  <th style="width:80px">Stok Awal</th>
  <th style="width:80px">Masuk</th>
  <th style="width:80px">Keluar</th>
  <th style="width:90px">Penyesuaian</th>
  <th style="width:80px">Stok Akhir</th>
  <th style="width:70px">Stok Min.</th>
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
    link.download = `LPLPO_${new Date(tahun, bulan).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).replace(/\s/g, '_')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (loading) return <LoadingSpinner />;

  const bulanOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i.toString(),
    label: new Date(2000, i).toLocaleDateString('id-ID', { month: 'long' }),
  }));
  const tahunOptions = Array.from({ length: 5 }, (_, i) => {
    const y = new Date().getFullYear() - 2 + i;
    return { value: y.toString(), label: y.toString() };
  });

  return (
    <div>
      <PageTitle title="Laporan Mutasi Obat Bulanan (LPLPO)" subtitle="Laporan Permintaan dan Pengeluaran Obat format LPLPO Puskesmas" />

      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">Periode:</span>
          <div className="w-40">
            <Select value={bulan.toString()} onChange={(v) => setBulan(parseInt(v))} options={bulanOptions} />
          </div>
          <div className="w-28">
            <Select value={tahun.toString()} onChange={(v) => setTahun(parseInt(v))} options={tahunOptions} />
          </div>
        </div>
        <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium hover:bg-emerald-100 transition-all">
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={TrendingUp} label="Total Obat Masuk" value={`+${grandMasuk}`} color="emerald" subtitle={`${mutasiList.filter((m) => m.jumlah > 0).length} transaksi`} />
        <StatCard icon={TrendingDown} label="Total Obat Keluar" value={`-${grandKeluar}`} color="rose" subtitle={`${mutasiList.filter((m) => m.jumlah < 0).length} transaksi`} />
        <StatCard icon={Package} label="Total Transaksi" value={totalTransaksi} color="sky" subtitle={`${lplpoData.length} jenis obat bergerak`} />
      </div>

      <Card className="p-0 overflow-hidden">
        {lplpoData.length === 0 ? (
          <EmptyState icon={FileBarChart} title="Tidak ada mutasi" subtitle="Tidak ada pergerakan stok pada periode ini" />
        ) : (
          <TableWrapper>
            <thead><tr><Th>No</Th><Th>Kode</Th><Th>Nama Obat</Th><Th>Satuan</Th><Th>Stok Awal</Th><Th>Masuk</Th><Th>Keluar</Th><Th>Penyesuaian</Th><Th>Stok Akhir</Th><Th>Min</Th></tr></thead>
            <tbody>
              {lplpoData.map((d, i) => (
                <tr key={d.obat.id} className="hover:bg-slate-50">
                  <Td className="text-center text-slate-400">{i + 1}</Td>
                  <Td className="font-mono text-xs text-slate-500">{d.obat.kode_obat || '-'}</Td>
                  <Td className="font-medium text-slate-700">{d.obat.nama_obat}</Td>
                  <Td className="text-center text-slate-500">{d.obat.satuan}</Td>
                  <Td className="text-right text-slate-600">{d.stokAwal}</Td>
                  <Td className="text-right text-emerald-600 font-medium">{d.totalMasuk > 0 ? `+${d.totalMasuk}` : '-'}</Td>
                  <Td className="text-right text-rose-600 font-medium">{d.totalKeluar > 0 ? `-${d.totalKeluar}` : '-'}</Td>
                  <Td className="text-right text-amber-600 font-medium">{d.totalPenyesuaian !== 0 ? d.totalPenyesuaian : '-'}</Td>
                  <Td className="text-right font-bold text-slate-700">{d.stokAkhir}</Td>
                  <Td className="text-center text-slate-500">{d.obat.stok_minimum}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
      </Card>
    </div>
  );
}
