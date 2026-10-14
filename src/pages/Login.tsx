import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Activity, Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError);
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo and header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-500 shadow-lg shadow-sky-200 mb-4">
            <Activity className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Puskesmas Sehat Sentosa</h1>
          <p className="text-sm text-slate-500 mt-1">Sistem Informasi Manajemen Puskesmas</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-6">Masuk ke Sistem</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="nama@puskesmas.go.id"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition-all text-slate-700 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-2.5 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition-all text-slate-700 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 text-white font-semibold shadow-lg shadow-sky-200 hover:shadow-sky-300 hover:from-sky-600 hover:to-teal-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-400 mb-3 text-center">Akun Demo (Klik untuk isi otomatis)</p>
            <div className="grid grid-cols-2 gap-2">
              <DemoButton label="Admin" email="admin@puskesmas.go.id" password="admin123" onClick={fillDemo} color="bg-violet-50 text-violet-600 border-violet-200" />
              <DemoButton label="Pendaftaran" email="pendaftaran@puskesmas.go.id" password="pendaftaran123" onClick={fillDemo} color="bg-sky-50 text-sky-600 border-sky-200" />
              <DemoButton label="Dokter" email="dokter@puskesmas.go.id" password="dokter123" onClick={fillDemo} color="bg-teal-50 text-teal-600 border-teal-200" />
              <DemoButton label="Apoteker" email="apoteker@puskesmas.go.id" password="apoteker123" onClick={fillDemo} color="bg-emerald-50 text-emerald-600 border-emerald-200" />
              <DemoButton label="Inventori" email="inventori@puskesmas.go.id" password="inventori123" onClick={fillDemo} color="bg-amber-50 text-amber-600 border-amber-200" />
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © 2024 Puskesmas Sehat Sentosa. Sistem Informasi Manajemen.
        </p>
      </div>
    </div>
  );
}

function DemoButton({
  label,
  email,
  password,
  onClick,
  color,
}: {
  label: string;
  email: string;
  password: string;
  onClick: (email: string, password: string) => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(email, password)}
      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all hover:scale-105 ${color}`}
    >
      {label}
    </button>
  );
}
