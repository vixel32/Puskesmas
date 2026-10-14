import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Role = string;

export interface Profile {
  id: string;
  nama_lengkap: string;
  role: Role;
  no_hp: string;
  foto: string;
  nik: string;
  tanda_tangan_digital: string;
  status_aktif: boolean;
  created_at: string;
}

export interface Pasien {
  id: string;
  no_rekam_medis: string;
  nik: string;
  nama: string;
  tanggal_lahir: string | null;
  jenis_kelamin: string;
  alamat: string;
  no_hp: string;
  golongan_darah: string;
  alergi: string;
  tanggal_daftar_pertama: string;
  created_at: string;
  created_by: string | null;
}

export interface Kunjungan {
  id: string;
  pasien_id: string;
  tanggal_kunjungan: string;
  no_antrian: string;
  poli_tujuan: string;
  keluhan_awal: string;
  status: 'menunggu' | 'dipanggil' | 'diperiksa' | 'selesai' | 'batal';
  pembiayaan: 'Umum' | 'BPJS';
  tekanan_darah: string;
  suhu: number | null;
  berat_badan: number | null;
  tinggi_badan: number | null;
  dibuat_oleh: string | null;
  created_at: string;
  pasien?: Pasien;
  profiles?: Profile | null;
}

export interface SuratKeteranganSakit {
  id: string;
  kunjungan_id: string;
  pasien_id: string;
  dokter_id: string | null;
  hari_sakit: number;
  tanggal_mulai: string;
  tanggal_selesai: string;
  diagnosa: string;
  tanda_tangan_digital: string;
  sudah_dicetak: boolean;
  status: 'aktif' | 'dibatalkan';
  created_at: string;
  pasien?: Pasien;
  dokter?: Profile | null;
  kunjungan?: Kunjungan;
}

export interface DistribusiObat {
  id: string;
  obat_id: string;
  jumlah: number;
  tujuan: string;
  jenis_tujuan: 'Posyandu' | 'Puskesmas Pembantu' | 'Lainnya';
  tanggal: string;
  petugas_id: string | null;
  keterangan: string;
  created_at: string;
  obat?: Obat;
  profiles?: Profile | null;
}

export interface RoleRow {
  id: string;
  nama_role: string;
  label: string;
  created_at: string;
}

export interface Pemeriksaan {
  id: string;
  kunjungan_id: string;
  dokter_id: string | null;
  anamnesa: string;
  tekanan_darah: string;
  suhu: number | null;
  berat_badan: number | null;
  tinggi_badan: number | null;
  diagnosa: string;
  icd10_kode: string;
  catatan_dokter: string;
  tanggal_pemeriksaan: string;
  created_at: string;
  kunjungan?: Kunjungan;
  dokter?: Profile | null;
}

export interface Resep {
  id: string;
  pemeriksaan_id: string;
  dokter_id: string | null;
  status: 'menunggu' | 'diproses' | 'selesai';
  catatan_resep: string;
  tanggal_resep: string;
  created_at: string;
  pemeriksaan?: Pemeriksaan;
  dokter?: Profile | null;
  resep_detail?: ResepDetail[];
}

export interface ResepDetail {
  id: string;
  resep_id: string;
  obat_id: string;
  jumlah: number;
  aturan_pakai: string;
  catatan: string;
  created_at: string;
  obat?: Obat;
}

export interface Obat {
  id: string;
  nama_obat: string;
  kode_obat: string;
  kategori: string;
  satuan: string;
  stok_saat_ini: number;
  stok_minimum: number;
  harga: number;
  harga_jual: number;
  lokasi_rak: string;
  tanggal_kadaluarsa: string | null;
  supplier: string;
  created_at: string;
}

export interface StokMasuk {
  id: string;
  obat_id: string;
  jumlah: number;
  tanggal: string;
  no_batch: string;
  supplier: string;
  petugas_id: string | null;
  created_at: string;
  kategori: string;
  satuan: string;
  harga_beli: number;
  harga_jual: number;
  tanggal_kadaluarsa: string | null;
  lokasi_rak: string;
  obat?: Obat;
  profiles?: Profile | null;
}

export interface StokKeluar {
  id: string;
  obat_id: string;
  jumlah: number;
  tanggal: string;
  keterangan: string;
  referensi_resep_id: string | null;
  petugas_id: string | null;
  created_at: string;
  obat?: Obat;
  profiles?: Profile | null;
}

export interface SuratRujukan {
  id: string;
  kunjungan_id: string;
  pasien_id: string;
  dokter_id: string | null;
  rs_tujuan: string;
  poli_tujuan: string;
  alasan_rujukan: string;
  diagnosa_sementara: string;
  tindakan_yang_diberikan: string;
  tanda_tangan_digital: string;
  sudah_dicetak: boolean;
  status: 'aktif' | 'dibatalkan';
  created_at: string;
  pasien?: Pasien;
  dokter?: Profile | null;
  kunjungan?: Kunjungan;
}

export interface BatchStok {
  id: string;
  obat_id: string;
  nomor_batch: string;
  tanggal_kadaluarsa: string | null;
  jumlah_stok: number;
  supplier: string;
  harga_beli: number;
  harga_jual: number;
  status_retur: 'normal' | 'dijadwalkan_retur' | 'sudah_retur';
  created_at: string;
  obat?: Obat;
}

export interface LogMutasi {
  id: string;
  timestamp: string;
  obat_id: string;
  batch_stok_id: string | null;
  nomor_batch: string;
  jenis_mutasi: 'masuk' | 'keluar' | 'penyesuaian' | 'kembali_supplier';
  jumlah: number;
  sumber_tujuan: string;
  stok_awal: number;
  stok_akhir: number;
  nama_petugas: string;
  petugas_id: string | null;
  keterangan: string;
  obat?: Obat;
  batch_stok?: BatchStok | null;
}

export interface Poli {
  id: string;
  nama_poli: string;
  kode_poli: string;
  keterangan: string;
  aktif: boolean;
  created_at: string;
}
