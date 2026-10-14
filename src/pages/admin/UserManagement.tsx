import { useEffect, useState } from 'react';
import { supabase, Profile, Role } from '@/lib/supabase';
import { Card, Badge, TableWrapper, Th, Td, SearchInput, Select, LoadingSpinner, EmptyState, PageTitle, Pagination, usePagination, Modal, Input, Button, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { Users, Plus, UserCog, UserX, UserCheck } from 'lucide-react';
import { ROLE_LABELS, formatDate } from '@/lib/types';

export default function UserManagement() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [toggleUser, setToggleUser] = useState<Profile | null>(null);
  const [form, setForm] = useState({ email: '', password: '', nama_lengkap: '', role: 'pendaftaran', no_hp: '', nik: '' });
  const [adding, setAdding] = useState(false);
  const [roles, setRoles] = useState<Record<string, string>>(ROLE_LABELS);
  const { page, setPage, totalPages, paginated } = usePagination(filtered(), 10);

  function filtered() {
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return u.nama_lengkap.toLowerCase().includes(s);
      }
      return true;
    });
  }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [usersRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('roles').select('*'),
    ]);
    setUsers((usersRes.data || []) as Profile[]);
    const roleMap: Record<string, string> = { ...ROLE_LABELS };
    (rolesRes.data || []).forEach((r: any) => { roleMap[r.nama_role] = r.label; });
    setRoles(roleMap);
    setLoading(false);
  }

  async function addUser() {
    if (!form.email || !form.password || !form.nama_lengkap) { toast('Lengkapi semua field', 'warning'); return; }
    setAdding(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) { toast(result.error || 'Gagal membuat user', 'error'); return; }
      toast('User berhasil dibuat', 'success');
      setAddModal(false);
      setForm({ email: '', password: '', nama_lengkap: '', role: 'pendaftaran', no_hp: '', nik: '' });
      // Fetch only the newly created profile instead of reloading everything
      const { data: newProfile } = await supabase.from('profiles').select('*').eq('id', result.user_id).single();
      if (newProfile) setUsers((prev) => [newProfile as Profile, ...prev]);
    } catch (err) {
      toast('Gagal: ' + (err as Error).message, 'error');
    }
    setAdding(false);
  }

  async function toggleStatus(user: Profile) {
    const { error } = await supabase.from('profiles').update({ status_aktif: !user.status_aktif }).eq('id', user.id);
    if (error) toast('Gagal: ' + error.message, 'error');
    else { toast(`User ${user.nama_lengkap} ${!user.status_aktif ? 'diaktifkan' : 'dinonaktifkan'}`, 'success'); load(); }
    setToggleUser(null);
  }

  async function updateRole(user: Profile, newRole: Role) {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id);
    if (error) toast('Gagal: ' + error.message, 'error');
    else { toast('Role diperbarui', 'success'); load(); }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageTitle title="Manajemen User" subtitle="Kelola akun pengguna sistem" />
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 max-w-xl">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama..." />
          <Select value={roleFilter} onChange={setRoleFilter} placeholder="Semua Role" options={Object.entries(roles).map(([v, l]) => ({ value: v, label: l }))} />
        </div>
        <Button onClick={() => setAddModal(true)}><Plus className="w-4 h-4" /> Tambah User</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState icon={Users} title="Tidak ada user" />
        ) : (
          <TableWrapper>
            <thead><tr><Th>Nama</Th><Th>Role</Th><Th>NIK</Th><Th>No. HP</Th><Th>Status</Th><Th>Dibuat</Th><Th>Aksi</Th></tr></thead>
            <tbody>
              {paginated.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-teal-400 flex items-center justify-center text-white text-xs font-semibold">{u.nama_lengkap.charAt(0)}</div>
                      <span className="font-medium text-slate-700">{u.nama_lengkap}</span>
                    </div>
                  </Td>
                  <Td>
                    <select value={u.role} onChange={(e) => updateRole(u, e.target.value as Role)} className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600">
                      {Object.entries(roles).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Td>
                  <Td className="text-slate-500 font-mono text-xs">{u.nik || '-'}</Td>
                  <Td className="text-slate-500">{u.no_hp || '-'}</Td>
                  <Td><Badge color={u.status_aktif ? 'emerald' : 'rose'}>{u.status_aktif ? 'Aktif' : 'Nonaktif'}</Badge></Td>
                  <Td className="whitespace-nowrap text-slate-500">{formatDate(u.created_at)}</Td>
                  <Td>
                    <button onClick={() => setToggleUser(u)} className={`p-1.5 rounded-lg ${u.status_aktif ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                      {u.status_aktif ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
        <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
      </Card>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Tambah User Baru">
        <div className="space-y-4">
          <Input label="Nama Lengkap" value={form.nama_lengkap} onChange={(v) => setForm({ ...form, nama_lengkap: v })} required />
          <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
          <Input label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
          <Select label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={Object.entries(roles).filter(([v]) => v !== 'admin').map(([v, l]) => ({ value: v, label: l }))} />
          <Input label="NIK (khusus dokter)" value={form.nik} onChange={(v) => setForm({ ...form, nik: v })} placeholder="16 digit NIK" />
          {form.role === 'dokter' && form.nik && (
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
              <p className="text-xs text-sky-700">
                Tanda tangan digital yang akan digenerate: <b>TDD-{form.nama_lengkap.slice(0, 3).toUpperCase().padEnd(3, 'X')}-{form.nik.length >= 6 ? form.nik.slice(-6) : form.nik.padStart(6, '0')}</b>
              </p>
            </div>
          )}
          <Input label="No. HP" value={form.no_hp} onChange={(v) => setForm({ ...form, no_hp: v })} />
          <div className="flex gap-3 pt-2">
            <Button onClick={addUser} disabled={adding} className="flex-1">{adding ? 'Membuat...' : 'Buat User'}</Button>
            <Button variant="secondary" onClick={() => setAddModal(false)}>Batal</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!toggleUser} onClose={() => setToggleUser(null)} onConfirm={() => toggleUser && toggleStatus(toggleUser)} title={toggleUser?.status_aktif ? 'Nonaktifkan User' : 'Aktifkan User'} message={`${toggleUser?.status_aktif ? 'Nonaktifkan' : 'Aktifkan'} akun "${toggleUser?.nama_lengkap}"?`} confirmLabel={toggleUser?.status_aktif ? 'Nonaktifkan' : 'Aktifkan'} />
    </div>
  );
}
