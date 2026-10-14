import { useState, ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/types';
import { Role } from '@/lib/supabase';
import {
  Activity, LogOut, Menu, X, User, ChevronDown, Bell, ExternalLink
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: typeof Activity;
  page: string;
  roles: Role[];
  external?: boolean;
}

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  navItems: NavItem[];
}

export default function Layout({ children, currentPage, onNavigate, navItems }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const filteredNav = navItems.filter((item) => !profile || item.roles.includes(profile.role));
  const activeItem = filteredNav.find((item) => item.page === currentPage);
  const pageTitle = activeItem?.label || 'Dashboard';

  const roleColors: Record<string, string> = {
    admin: 'bg-violet-100 text-violet-700',
    pendaftaran: 'bg-sky-100 text-sky-700',
    dokter: 'bg-teal-100 text-teal-700',
    apoteker: 'bg-emerald-100 text-emerald-700',
    inventori: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200 transition-transform duration-300 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center shadow-md shadow-sky-200">
            <Activity className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">Puskesmas</p>
            <p className="text-xs text-slate-500 leading-tight">Sehat Sentosa</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => {
                  if (item.external) {
                    window.open(`${window.location.origin}${window.location.pathname}#${item.page}`, 'papan-antrian', 'noopener,width=1280,height=800');
                  } else {
                    onNavigate(item.page);
                    setSidebarOpen(false);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500 to-teal-500 text-white shadow-md shadow-sky-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
                {item.external && <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-400" />}
              </button>
            );
          })}
        </nav>

        {/* User info at bottom */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-teal-400 flex items-center justify-center text-white text-sm font-semibold">
              {profile?.nama_lengkap?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{profile?.nama_lengkap}</p>
              <p className="text-xs text-slate-400 truncate">{ROLE_LABELS[profile?.role || ''] || ''}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-lg font-bold text-slate-800">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${roleColors[profile?.role || ''] || 'bg-slate-100 text-slate-600'}`}>
              {ROLE_LABELS[profile?.role || ''] || ''}
            </span>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-teal-400 flex items-center justify-center text-white text-sm font-semibold">
                  {profile?.nama_lengkap?.charAt(0) || 'U'}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-20">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-700">{profile?.nama_lengkap}</p>
                      <p className="text-xs text-slate-400">{profile?.no_hp || 'No HP belum diisi'}</p>
                    </div>
                    <button
                      onClick={() => {
                        onNavigate('profile');
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      <User className="w-4 h-4" />
                      Profil Saya
                    </button>
                    <button
                      onClick={() => signOut()}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Keluar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
