export const POLI_OPTIONS = [
  'Umum',
  'Gigi',
  'KIA',
  'Penyakit Dalam',
  'Anak',
  'Mata',
  'THT',
] as const;

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Super Admin',
  pendaftaran: 'Administrasi Pendaftaran',
  dokter: 'Dokter',
  apoteker: 'Apoteker',
  inventori: 'Petugas Inventori Obat',
};

export const JENIS_TUJUAN_DISTRIBUSI = ['Posyandu', 'Puskesmas Pembantu', 'Lainnya'] as const;

export const PEMBIAYAAN_OPTIONS = ['Umum', 'BPJS'] as const;

export const STATUS_KUNJUNGAN_LABELS: Record<string, string> = {
  menunggu: 'Menunggu',
  dipanggil: 'Dipanggil',
  diperiksa: 'Diperiksa',
  selesai: 'Selesai',
  batal: 'Batal',
};

export const STATUS_RESEP_LABELS: Record<string, string> = {
  menunggu: 'Menunggu',
  diproses: 'Diproses',
  selesai: 'Selesai',
};

export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTime(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function calcAge(tanggalLahir: string | null | undefined): number | string {
  if (!tanggalLahir) return '-';
  const birth = new Date(tanggalLahir);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
