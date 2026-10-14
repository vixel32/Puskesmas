import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast';
import { Role } from '@/lib/supabase';
import Login from '@/pages/Login';
import Layout from '@/components/Layout';
import { Activity, LayoutDashboard, UserPlus, Ticket, ClipboardList, History, Stethoscope, Pill, Package, ArrowDownUp, Users, FileText, Shield, FileBarChart, Send, Building2, FileSignature, BookOpen, Tv } from 'lucide-react';

// Pendaftaran pages
import PendaftaranDashboard from '@/pages/pendaftaran/PendaftaranDashboard';
import PasienBaru from '@/pages/pendaftaran/PasienBaru';
import BuatKunjungan from '@/pages/pendaftaran/BuatKunjungan';
import ManajemenAntrian from '@/pages/pendaftaran/ManajemenAntrian';
import PapanAntrian from '@/pages/pendaftaran/PapanAntrian';
import RiwayatKunjungan from '@/pages/pendaftaran/RiwayatKunjungan';

// Dokter pages
import DokterDashboard from '@/pages/dokter/DokterDashboard';
import PemeriksaanPasien from '@/pages/dokter/PemeriksaanPasien';
import RiwayatMedis from '@/pages/dokter/RiwayatMedis';
import KelolaSuratRujukan from '@/pages/KelolaSuratRujukan';
import KelolaSuratKeteranganSakit from '@/pages/KelolaSuratKeteranganSakit';

// Apoteker pages
import ApotekerDashboard from '@/pages/apoteker/ApotekerDashboard';
import DetailResep from '@/pages/apoteker/DetailResep';

// Inventori pages
import InventoriDashboard from '@/pages/inventori/InventoriDashboard';
import ManajemenObat from '@/pages/inventori/ManajemenObat';
import MutasiStok from '@/pages/inventori/MutasiStok';
import LaporanStok from '@/pages/inventori/LaporanStok';
import DistribusiObatPage from '@/pages/inventori/DistribusiObat';
import KartuStok from '@/pages/inventori/KartuStok';

// Admin & Profile
import AdminDashboard from '@/pages/admin/AdminDashboard';
import UserManagement from '@/pages/admin/UserManagement';
import RoleManagement from '@/pages/admin/RoleManagement';
import KelolaPoli from '@/pages/admin/KelolaPoli';
import Profile from '@/pages/Profile';

interface NavItem {
  label: string;
  icon: typeof Activity;
  page: string;
  roles: Role[];
  external?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  // Pendaftaran
  { label: 'Dashboard', icon: LayoutDashboard, page: 'pendaftaran', roles: ['pendaftaran'] },
  { label: 'Pasien Baru', icon: UserPlus, page: 'pendaftaran-pasien-baru', roles: ['pendaftaran'] },
  { label: 'Buat Kunjungan', icon: Ticket, page: 'pendaftaran-kunjungan', roles: ['pendaftaran'] },
  { label: 'Manajemen Antrian', icon: ClipboardList, page: 'pendaftaran-antrian', roles: ['pendaftaran'] },
  { label: 'Papan Antrian', icon: Tv, page: 'pendaftaran-papan', roles: ['pendaftaran'], external: true },
  { label: 'Riwayat Kunjungan', icon: History, page: 'pendaftaran-riwayat', roles: ['pendaftaran'] },
  { label: 'Kelola Surat Rujukan', icon: Stethoscope, page: 'pendaftaran-rujukan', roles: ['pendaftaran'] },
  { label: 'Kelola Surat Keterangan Sakit', icon: FileSignature, page: 'pendaftaran-sks', roles: ['pendaftaran'] },
  // Dokter
  { label: 'Dashboard', icon: LayoutDashboard, page: 'dokter', roles: ['dokter'] },
  { label: 'Riwayat Rekam Medis', icon: FileText, page: 'dokter-riwayat', roles: ['dokter'] },
  { label: 'Kelola Surat Rujukan', icon: Stethoscope, page: 'dokter-rujukan', roles: ['dokter'] },
  { label: 'Kelola Surat Keterangan Sakit', icon: FileSignature, page: 'dokter-sks', roles: ['dokter'] },
  // Apoteker
  { label: 'Dashboard', icon: LayoutDashboard, page: 'apoteker', roles: ['apoteker'] },
  // Inventori
  { label: 'Dashboard', icon: LayoutDashboard, page: 'inventori', roles: ['inventori'] },
  { label: 'Manajemen Obat', icon: Package, page: 'inventori-obat', roles: ['inventori'] },
  { label: 'Mutasi Stok', icon: ArrowDownUp, page: 'inventori-mutasi', roles: ['inventori'] },
  { label: 'Kartu Stok', icon: BookOpen, page: 'inventori-kartu-stok', roles: ['inventori'] },
  { label: 'Laporan Stok', icon: FileBarChart, page: 'inventori-laporan', roles: ['inventori'] },
  { label: 'Distribusi Obat', icon: Send, page: 'inventori-distribusi', roles: ['inventori'] },
  // Admin
  { label: 'Dashboard', icon: LayoutDashboard, page: 'admin', roles: ['admin'] },
  { label: 'Manajemen User', icon: Users, page: 'admin-users', roles: ['admin'] },
  { label: 'Manajemen Role', icon: Shield, page: 'admin-roles', roles: ['admin'] },
  { label: 'Kelola Poli', icon: Building2, page: 'admin-poli', roles: ['admin'] },
];

function AppContent() {
  const { profile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('');

  const hashPage = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
  const isPapanAntrianWindow = hashPage === 'pendaftaran-papan';

  useEffect(() => {
    if (profile) {
      setCurrentPage(profile.role);
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center animate-pulse">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <p className="text-sm text-slate-500">Memuat...</p>
        </div>
      </div>
    );
  }

  if (isPapanAntrianWindow) {
    return <PapanAntrian />;
  }

  if (!profile) {
    return <Login />;
  }

  const navForRole = NAV_ITEMS.filter((item) => item.roles.includes(profile.role));
  const roleHome: Record<string, string> = { pendaftaran: 'pendaftaran', dokter: 'dokter', apoteker: 'apoteker', inventori: 'inventori', admin: 'admin' };
  const effectivePage = currentPage || roleHome[profile.role] || 'pendaftaran';

  function renderPage() {
    // Profile is accessible to all
    if (effectivePage === 'profile') return <Profile />;

    // Pendaftaran
    if (effectivePage === 'pendaftaran') return <PendaftaranDashboard onNavigate={setCurrentPage} />;
    if (effectivePage === 'pendaftaran-pasien-baru') return <PasienBaru onNavigate={setCurrentPage} />;
    if (effectivePage === 'pendaftaran-kunjungan') return <BuatKunjungan onNavigate={setCurrentPage} />;
    if (effectivePage === 'pendaftaran-antrian') return <ManajemenAntrian />;
    if (effectivePage === 'pendaftaran-riwayat') return <RiwayatKunjungan />;
    if (effectivePage === 'pendaftaran-rujukan') return <KelolaSuratRujukan mode="pendaftaran" onNavigate={setCurrentPage} />;
    if (effectivePage === 'pendaftaran-sks') return <KelolaSuratKeteranganSakit mode="pendaftaran" onNavigate={setCurrentPage} />;

    // Dokter
    if (effectivePage === 'dokter') return <DokterDashboard onNavigate={setCurrentPage} />;
    if (effectivePage.startsWith('dokter-periksa:')) {
      const id = effectivePage.split(':')[1];
      return <PemeriksaanPasien kunjunganId={id} onNavigate={setCurrentPage} />;
    }
    if (effectivePage === 'dokter-riwayat') return <RiwayatMedis />;
    if (effectivePage === 'dokter-rujukan') return <KelolaSuratRujukan mode="dokter" onNavigate={setCurrentPage} />;
    if (effectivePage === 'dokter-sks') return <KelolaSuratKeteranganSakit mode="dokter" onNavigate={setCurrentPage} />;

    // Apoteker
    if (effectivePage === 'apoteker') return <ApotekerDashboard onNavigate={setCurrentPage} />;
    if (effectivePage.startsWith('apoteker-detail:')) {
      const id = effectivePage.split(':')[1];
      return <DetailResep resepId={id} onNavigate={setCurrentPage} />;
    }

    // Inventori
    if (effectivePage === 'inventori') return <InventoriDashboard onNavigate={setCurrentPage} />;
    if (effectivePage === 'inventori-obat') return <ManajemenObat />;
    if (effectivePage === 'inventori-mutasi') return <MutasiStok />;
    if (effectivePage === 'inventori-kartu-stok') return <KartuStok />;
    if (effectivePage === 'inventori-laporan') return <LaporanStok />;
    if (effectivePage === 'inventori-distribusi') return <DistribusiObatPage />;

    // Admin
    if (effectivePage === 'admin') return <AdminDashboard onNavigate={setCurrentPage} />;
    if (effectivePage === 'admin-users') return <UserManagement />;
    if (effectivePage === 'admin-roles') return <RoleManagement />;
    if (effectivePage === 'admin-poli') return <KelolaPoli />;

    return <PendaftaranDashboard onNavigate={setCurrentPage} />;
  }

  return (
    <Layout currentPage={effectivePage} onNavigate={setCurrentPage} navItems={navForRole}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
