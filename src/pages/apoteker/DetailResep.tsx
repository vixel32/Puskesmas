import { useEffect, useState } from 'react';
import { supabase, Resep } from '@/lib/supabase';
import { Card, Badge, Button, LoadingSpinner, PageTitle } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { ArrowLeft, Pill, CheckCircle, AlertTriangle, Package, Printer, Tag } from 'lucide-react';
import { formatDate, calcAge, formatCurrency } from '@/lib/types';

export default function DetailResep({ resepId, onNavigate }: { resepId: string; onNavigate: (p: string) => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [resep, setResep] = useState<Resep | null>(null);

  useEffect(() => { load(); }, [resepId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('resep')
      .select('*, pemeriksaan(*, kunjungan(*, pasien(*))), dokter:profiles(*), resep_detail(*, obat:obat(*))')
      .eq('id', resepId)
      .maybeSingle();
    setResep(data as Resep | null);
    setLoading(false);
  }

  async function processResep() {
    setProcessing(true);
    const { data, error } = await supabase.rpc('process_resep', { p_resep_id: resepId });
    if (error) {
      toast('Gagal memproses resep: ' + error.message, 'error');
    } else {
      const result = data as { success: boolean; message: string; error?: string };
      if (result.success) {
        toast('Resep berhasil diproses. Stok obat telah dikurangi.', 'success');
        load();
      } else {
        toast(result.error || result.message, 'error');
      }
    }
    setProcessing(false);
  }

  function printLabels() {
    if (!resep) return;
    const pasien = resep.pemeriksaan?.kunjungan?.pasien;
    const items = resep.resep_detail || [];
    if (!pasien || items.length === 0) { toast('Tidak ada obat untuk dicetak', 'warning'); return; }

    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) { toast('Popup diblokir browser', 'error'); return; }

    const labels = items.map((d) => {
      const obat = d.obat;
      if (!obat) return '';
      return `
      <div class="label">
        <div class="label-header">
          <span class="puskesmas">Puskesmas Sehat Sentosa</span>
        </div>
        <div class="label-body">
          <div class="obat-name">${obat.nama_obat}</div>
          <div class="info-row">
            <span class="label-key">Pasien:</span> <span class="label-val">${pasien.nama}</span>
          </div>
          <div class="info-row">
            <span class="label-key">No. RM:</span> <span class="label-val">${pasien.no_rekam_medis || '-'}</span>
          </div>
          <div class="info-row">
            <span class="label-key">Jumlah:</span> <span class="label-val">${d.jumlah} ${obat.satuan}</span>
          </div>
          <div class="aturan-box">
            <span class="aturan-label">ATURAN PAKAI:</span>
            <span class="aturan-val">${d.aturan_pakai || 'Sesuai anjuran dokter'}</span>
          </div>
          ${d.catatan ? `<div class="catatan">Catatan: ${d.catatan}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    const html = `
<!DOCTYPE html><html><head><title>Label Obat</title>
<style>
  @page { size: 100mm 70mm; margin: 0; }
  body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
  .label-grid { display: flex; flex-wrap: wrap; gap: 0; }
  .label {
    width: 100mm; height: 70mm;
    box-sizing: border-box;
    padding: 5mm;
    border: 1px dashed #ccc;
    page-break-after: always;
    display: flex;
    flex-direction: column;
  }
  .label-header {
    text-align: center;
    border-bottom: 2px solid #0ea5e9;
    padding-bottom: 3mm;
    margin-bottom: 3mm;
  }
  .puskesmas { font-size: 9pt; font-weight: bold; color: #0ea5e9; }
  .label-body { flex: 1; display: flex; flex-direction: column; justify-content: flex-start; }
  .obat-name { font-size: 13pt; font-weight: bold; color: #1e293b; margin-bottom: 2mm; }
  .info-row { font-size: 9pt; color: #475569; margin: 1mm 0; }
  .label-key { font-weight: bold; color: #64748b; }
  .label-val { color: #1e293b; }
  .aturan-box {
    margin-top: 3mm;
    padding: 2mm 3mm;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 2mm;
  }
  .aturan-label { font-size: 8pt; font-weight: bold; color: #0284c7; display: block; margin-bottom: 1mm; }
  .aturan-val { font-size: 11pt; font-weight: bold; color: #0c4a6e; }
  .catatan { font-size: 8pt; color: #64748b; margin-top: 2mm; font-style: italic; }
  @media print {
    .label { border: none; }
  }
</style></head><body>
<div class="label-grid">${labels}</div>
</body></html>`;

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  if (loading) return <LoadingSpinner />;
  if (!resep) return <div className="text-center py-16 text-slate-500">Resep tidak ditemukan</div>;

  const hasStockIssue = (resep.resep_detail || []).some((d) => d.obat && d.jumlah > d.obat.stok_saat_ini);

  return (
    <div>
      <button onClick={() => onNavigate('apoteker')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Resep
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient info */}
        <Card className="p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Info Pasien</h3>
          <div className="space-y-2 text-sm">
            <div><p className="text-xs text-slate-500">Nama</p><p className="font-semibold text-slate-700">{resep.pemeriksaan?.kunjungan?.pasien?.nama || '-'}</p></div>
            <div><p className="text-xs text-slate-500">No. RM</p><p className="text-slate-600">{resep.pemeriksaan?.kunjungan?.pasien?.no_rekam_medis || '-'}</p></div>
            <div><p className="text-xs text-slate-500">Usia</p><p className="text-slate-600">{calcAge(resep.pemeriksaan?.kunjungan?.pasien?.tanggal_lahir)} tahun</p></div>
            <div><p className="text-xs text-slate-500">Poli</p><Badge color="teal">{resep.pemeriksaan?.kunjungan?.poli_tujuan || '-'}</Badge></div>
            <div><p className="text-xs text-slate-500">Pembiayaan</p><Badge color={resep.pemeriksaan?.kunjungan?.pembiayaan === 'BPJS' ? 'sky' : 'slate'}>{resep.pemeriksaan?.kunjungan?.pembiayaan || 'Umum'}</Badge></div>
            <div><p className="text-xs text-slate-500">Dokter</p><p className="text-slate-600">{resep.dokter?.nama_lengkap || '-'}</p></div>
            <div><p className="text-xs text-slate-500">Tanggal Resep</p><p className="text-slate-600">{formatDate(resep.tanggal_resep)}</p></div>
          </div>
        </Card>

        {/* Prescription details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-800">Daftar Obat</h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={resep.status === 'selesai' ? 'emerald' : resep.status === 'diproses' ? 'amber' : 'sky'}>{resep.status}</Badge>
                <Button size="sm" variant="secondary" onClick={printLabels}>
                  <Tag className="w-4 h-4" /> Cetak Label
                </Button>
              </div>
            </div>

            {hasStockIssue && resep.status !== 'selesai' && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <p className="text-sm text-rose-700">Beberapa obat memiliki stok tidak cukup. Stok akan diatur ke 0 jika diproses.</p>
              </div>
            )}

            <div className="space-y-3">
              {(resep.resep_detail || []).map((d) => {
                const insufficient = d.obat && d.jumlah > d.obat.stok_saat_ini;
                return (
                  <div key={d.id} className={`p-4 rounded-xl border ${insufficient ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-700">{d.obat?.nama_obat}</p>
                        <p className="text-xs text-slate-500 mt-1">{d.obat?.kategori} • {d.obat?.satuan} • {formatCurrency(d.obat?.harga)}</p>
                        <p className="text-sm text-slate-600 mt-2">Jumlah: <span className="font-bold">{d.jumlah}</span> {d.obat?.satuan}</p>
                        <p className="text-sm text-slate-600">Aturan pakai: <span className="font-medium">{d.aturan_pakai || '-'}</span></p>
                        {d.catatan && <p className="text-xs text-slate-500 mt-1">Catatan: {d.catatan}</p>}
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-bold text-slate-700">{d.obat?.stok_saat_ini}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">stok tersedia</p>
                        {insufficient && <Badge color="rose">Kurang</Badge>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {resep.catatan_resep && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-xs font-semibold text-amber-700">Catatan Dokter</p>
                <p className="text-sm text-slate-600">{resep.catatan_resep}</p>
              </div>
            )}
          </Card>

          {resep.status !== 'selesai' && (
            <Card className="p-6">
              <Button onClick={processResep} disabled={processing} variant="success" className="w-full">
                {processing ? 'Memproses...' : <><CheckCircle className="w-5 h-5" /> Proses & Serahkan Resep</>}
              </Button>
              <p className="text-xs text-slate-400 text-center mt-2">
                Stok obat akan otomatis berkurang dan tercatat di mutasi stok keluar
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
