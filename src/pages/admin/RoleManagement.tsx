import { useEffect, useState } from 'react';
import { supabase, RoleRow } from '@/lib/supabase';
import { Card, Badge, Button, Input, LoadingSpinner, EmptyState, PageTitle, Modal, TableWrapper, Th, Td, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { Shield, Plus, Trash2, ShieldCheck } from 'lucide-react';
import { formatDate } from '@/lib/types';

export default function RoleManagement() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [form, setForm] = useState({ nama_role: '', label: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('roles').select('*').order('created_at', { ascending: true });
    if (error) toast('Gagal memuat role: ' + error.message, 'error');
    setRoles((data || []) as RoleRow[]);
    setLoading(false);
  }

  async function addRole() {
    if (!form.nama_role || !form.label) { toast('Lengkapi semua field', 'warning'); return; }
    setSaving(true);
    const { error } = await supabase.from('roles').insert({
      nama_role: form.nama_role.toLowerCase().replace(/\s+/g, '_'),
      label: form.label,
    });
    if (error) {
      toast('Gagal menambah role: ' + error.message, 'error');
    } else {
      toast('Role berhasil ditambahkan', 'success');
      setAddModal(false);
      setForm({ nama_role: '', label: '' });
      load();
    }
    setSaving(false);
  }

  async function deleteRole(role: RoleRow) {
    const { error } = await supabase.from('roles').delete().eq('id', role.id);
    if (error) {
      toast('Gagal menghapus role: ' + error.message, 'error');
    } else {
      toast(`Role "${role.label}" dihapus`, 'success');
      load();
    }
    setDeleteTarget(null);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageTitle title="Manajemen Role" subtitle="Tambah dan hapus role pengguna sistem" />

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-500">Role menentukan hak akses dan menu yang tersedia untuk setiap pengguna.</p>
        <Button onClick={() => setAddModal(true)}><Plus className="w-4 h-4" /> Tambah Role</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {roles.length === 0 ? (
          <EmptyState icon={Shield} title="Tidak ada role" />
        ) : (
          <TableWrapper>
            <thead><tr><Th>Nama Role</Th><Th>Label Tampilan</Th><Th>Dibuat</Th><Th>Aksi</Th></tr></thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-violet-500" />
                      <span className="font-mono text-sm font-medium text-slate-700">{r.nama_role}</span>
                    </div>
                  </Td>
                  <Td><Badge color="violet">{r.label}</Badge></Td>
                  <Td className="text-slate-500">{formatDate(r.created_at)}</Td>
                  <Td>
                    <button
                      onClick={() => setDeleteTarget(r)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
      </Card>

      <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-100">
        <p className="text-xs text-amber-700">
          <b>Catatan:</b> Menghapus role dari daftar ini tidak akan mengubah role pengguna yang sudah ada.
          Role default (admin, pendaftaran, dokter, apoteker, inventori) disarankan untuk tidak dihapus.
        </p>
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Tambah Role Baru">
        <div className="space-y-4">
          <Input
            label="Nama Role (sistem)"
            value={form.nama_role}
            onChange={(v) => setForm({ ...form, nama_role: v })}
            placeholder="contoh: dokter_anak"
            required
          />
          <p className="text-xs text-slate-400 -mt-2">Gunakan huruf kecil dan garis bawah. Contoh: bidan, dokter_spesialis_anak</p>
          <Input
            label="Label Tampilan"
            value={form.label}
            onChange={(v) => setForm({ ...form, label: v })}
            placeholder="contoh: Dokter Spesialis Anak"
            required
          />
          <div className="flex gap-3 pt-2">
            <Button onClick={addRole} disabled={saving} className="flex-1">
              {saving ? 'Menyimpan...' : 'Tambah Role'}
            </Button>
            <Button variant="secondary" onClick={() => setAddModal(false)}>Batal</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteRole(deleteTarget)}
        title="Hapus Role"
        message={`Yakin ingin menghapus role "${deleteTarget?.label}"? Pengguna dengan role ini tidak akan terpengaruh, namun role ini tidak akan tersedia untuk pengguna baru.`}
        confirmLabel="Hapus"
      />
    </div>
  );
}
