import { useEffect, useState, useMemo } from 'react';
import { supabase, Obat, LogMutasi } from '@/lib/supabase';
import { Card, Badge, TableWrapper, Th, Td, Select, LoadingSpinner, EmptyState, PageTitle, Button } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { BookOpen, Download } from 'lucide-react';
import { formatDate } from '@/lib/types';

export default function KartuStok() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [obatList, setObatList] = useState<Obat[]>([]);
  const [selectedObat, setSelectedObat] = useState('');
  const [mutasiList, setMutasiList] = useState<LogMutasi[]>([]);

  useEffect(() => { loadObat(); }, []);

  async function loadObat() {
    setLoading(true);
    const { data } = await supabase.from('obat').select('*').order('nama_obat', { ascending: true });
    setObatList((data || []) as Obat[]);
    setLoading(false);
  }

  useEffect(() => {
    if (selectedObat) loadMutasi(selectedObat);
    else setMutasiList([]);
  }, [selectedObat]);

  async function loadMutasi(obatId: string) {
    const { data } = await supabase
      .from('log_mutasi')
      .select('*, obat:obat(*)')
      .eq('obat_id', obatId)
      .order('timestamp', { ascending: true })
      .limit(500);
    setMutasiList((data || []) as LogMutasi[]);
  }

  // Compute running balance
  const rowsWithBalance = useMemo(() => {
    let running = 0;
    return mutasiList.map((m) => {
      running = m.stok_akhir;
      return { ...m, runningBalance: running };
    });
  }, [mutasiList]);

  function exportExcel() {
    if (!selectedObat) { toast('Pilih obat terlebih dahulu', 'warning'); return; }
    const obat = obatList.find((o) => o.id === selectedObat);
    if (!obat) return;

    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const bodyRows = rowsWithBalance.length === 0
      ? '<tr><td colspan="10" style="text-align:center;padding:20px;color:#94a3b8">Belum ada mutasi</td></tr>'
      : rowsWithBalance.map((m, i) => {
          const masuk = m.jumlah > 0 ? m.jumlah : '-';
          const keluar = m.jumlah < 0 ? Math.abs(m.jumlah) : '-';
          return `<tr>
            <td style="text-align:center">${i + 1}</td>
            <td style="white-space:nowrap">${esc(formatDate(m.timestamp))}</td>
            <td style="text-align:center">${esc(m.nomor_batch || '-')}</td>
            <td style="text-align:center">${esc(m.jenis_mutasi)}</td>
            <td>${esc(m.sumber_tujuan || '-')}</td>
            <td style="text-align:right;color:#059669">${masuk}</td>
            <td style="text-align:right;color:#e11d48">${keluar}</td>
            <td style="text-align:right;font-weight:bold">${m.runningBalance}</td>
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
<x:Name>Kartu Stok</x:Name>
<x:WorksheetOptions><x:Selected/><x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>8</x:SplitHorizontal><x:TopRowBottomPane>8</x:TopRowBottomPane></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
</xml><![endif]-->
<style>
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  .report-header { width: 100%; margin-bottom: 12px; }
  .report-header td { border: 0; padding: 2px 0; text-align: center; font-family: Calibri, Arial, sans-serif; }
  .facility { color: #0f6b9d; font-size: 16pt; font-weight: bold; }
  .report-title { color: #1e293b; font-size: 13pt; font-weight: bold; }
  .report-meta { color: #64748b; font-size: 10pt; }
  .info { width: 100%; margin-bottom: 12px; }
  .info td { border: 0; padding: 3px 8px; font-family: Calibri, Arial, sans-serif; font-size: 10pt; }
  .info .label { font-weight: bold; color: #475569; width: 110px; }
  .data-table { width: 100%; table-layout: fixed; }
  td, th { border: 1px solid #cbd5e1; padding: 6px 8px; font-family: Calibri, Arial, sans-serif; font-size: 10pt; vertical-align: middle; }
  th { background-color: #0ea5e9; color: #ffffff; font-weight: bold; text-align: center; border-color: #0284c7; height: 34px; }
  tr:nth-child(even) td { background-color: #f8fafc; }
</style>
</head>
<body>
<table class="report-header" cellspacing="0" cellpadding="0">
  <tr><td class="facility" colspan="10">PUSKESMAS SEHAT SENTOSA</td></tr>
  <tr><td class="report-title" colspan="10">KARTU STOK OBAT (DIGITAL)</td></tr>
  <tr><td class="report-meta" colspan="10">Tanggal export: ${esc(today)}</td></tr>
</table>
<table class="info" cellspacing="0" cellpadding="0">
  <tr><td class="label">Nama Obat</td><td>: ${esc(obat.nama_obat)}</td><td class="label">Kode Obat</td><td>: ${esc(obat.kode_obat || '-')}</td></tr>
  <tr><td class="label">Satuan</td><td>: ${esc(obat.satuan)}</td><td class="label">Kategori</td><td>: ${esc(obat.kategori || '-')}</td></tr>
  <tr><td class="label">Stok Saat Ini</td><td>: ${obat.stok_saat_ini}</td><td class="label">Stok Minimum</td><td>: ${obat.stok_minimum}</td></tr>
  <tr><td class="label">Lokasi Rak</td><td>: ${esc(obat.lokasi_rak || '-')}</td><td class="label">Kadaluarsa</td><td>: ${obat.tanggal_kadaluarsa ? esc(formatDate(obat.tanggal_kadaluarsa)) : '-'}</td></tr>
</table>
<table class="data-table" border="1" cellspacing="0" cellpadding="0">
<thead>
<tr>
  <th style="width:40px">No</th>
  <th style="width:130px">Tanggal</th>
  <th style="width:90px">No. Batch</th>
  <th style="width:110px">Jenis</th>
  <th style="width:170px">Sumber/Tujuan</th>
  <th style="width:70px">Masuk</th>
  <th style="width:70px">Keluar</th>
  <th style="width:70px">Saldo</th>
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
    link.download = `Kartu_Stok_${obat.nama_obat.replace(/\s/g, '_')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageTitle title="Kartu Stok Digital" subtitle="Saldo akhir akumulatif (running balance) per obat" />

      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex-1 max-w-md">
          <Select
            value={selectedObat}
            onChange={setSelectedObat}
            placeholder="Pilih obat untuk melihat kartu stok"
            options={obatList.map((o) => ({ value: o.id, label: `${o.nama_obat} (Stok: ${o.stok_saat_ini})` }))}
          />
        </div>
        {selectedObat && (
          <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium hover:bg-emerald-100 transition-all">
            <Download className="w-4 h-4" /> Export Excel
          </button>
        )}
      </div>

      {!selectedObat ? (
        <EmptyState icon={BookOpen} title="Pilih obat" subtitle="Pilih obat untuk melihat riwayat mutasi dengan saldo berjalan" />
      ) : rowsWithBalance.length === 0 ? (
        <EmptyState icon={BookOpen} title="Belum ada mutasi" subtitle="Obat ini belum memiliki riwayat pergerakan stok" />
      ) : (
        <Card className="p-0 overflow-hidden">
          <TableWrapper>
            <thead><tr><Th>No</Th><Th>Tanggal</Th><Th>No. Batch</Th><Th>Jenis</Th><Th>Sumber/Tujuan</Th><Th>Masuk</Th><Th>Keluar</Th><Th>Saldo</Th><Th>Petugas</Th><Th>Keterangan</Th></tr></thead>
            <tbody>
              {rowsWithBalance.map((m, i) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <Td className="text-center text-slate-400">{i + 1}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatDate(m.timestamp)}</Td>
                  <Td className="font-mono text-xs text-slate-500">{m.nomor_batch || '-'}</Td>
                  <Td>
                    {m.jenis_mutasi === 'masuk' && <Badge color="emerald">Masuk</Badge>}
                    {m.jenis_mutasi === 'keluar' && <Badge color="rose">Keluar</Badge>}
                    {m.jenis_mutasi === 'kembali_supplier' && <Badge color="violet">Retur Supplier</Badge>}
                    {m.jenis_mutasi === 'penyesuaian' && <Badge color="amber">Penyesuaian</Badge>}
                  </Td>
                  <Td className="text-slate-600">{m.sumber_tujuan}</Td>
                  <Td className="text-right text-emerald-600 font-medium">{m.jumlah > 0 ? `+${m.jumlah}` : '-'}</Td>
                  <Td className="text-right text-rose-600 font-medium">{m.jumlah < 0 ? `${Math.abs(m.jumlah)}` : '-'}</Td>
                  <Td className="text-right font-bold text-slate-700">{m.runningBalance}</Td>
                  <Td className="text-slate-500 text-xs">{m.nama_petugas}</Td>
                  <Td className="text-slate-500 text-xs">{m.keterangan || '-'}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        </Card>
      )}
    </div>
  );
}
