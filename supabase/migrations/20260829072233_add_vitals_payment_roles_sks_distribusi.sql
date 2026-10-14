/*
# Add vital signs fields, payment type, roles table, surat keterangan sakit, and distribusi obat

## Overview
This migration adds support for 6 new features:
1. Vital signs (tekanan darah, suhu, berat badan, tinggi badan) recorded by pendaftaran at visit creation
2. Surat keterangan sakit (sick leave certificate) with digital doctor signature
3. Medicine distribution to external units (posyandu, etc.)
4. Payment type (Umum/BPJS) on kunjungan
5. Dynamic roles management (admin can add/remove roles like "dokter spesialis anak", "bidan")
6. Stock report data already available via stok_masuk/stok_keluar tables

## Changes

### 1. kunjungan table - add vital signs + payment type
- `tekanan_darah` (text) - blood pressure, e.g. "120/80"
- `suhu` (numeric) - temperature in Celsius
- `berat_badan` (numeric) - weight in kg
- `tinggi_badan` (numeric) - height in cm
- `pembiayaan` (text) - payment type: 'Umum' or 'BPJS', default 'Umum'

### 2. New table: roles
- Dynamic role management so admin can add custom roles
- `id` (uuid PK)
- `nama_role` (text, unique) - role name e.g. "dokter", "bidan"
- `label` (text) - display label e.g. "Dokter", "Bidan"
- `dibuat_oleh` (uuid FK to profiles)
- `created_at` (timestamptz)

### 3. profiles table - relax role CHECK constraint
- Drop the CHECK constraint that limits role to fixed set
- Add new constraint allowing any non-empty text (validated against roles table at app level)

### 4. New table: surat_keterangan_sakit
- Sick leave certificates created by doctors
- `id` (uuid PK)
- `kunjungan_id` (uuid FK to kunjungan)
- `pasien_id` (uuid FK to pasien)
- `dokter_id` (uuid FK to profiles)
- `hari_sakit` (integer) - number of sick days
- `tanggal_mulai` (date) - start date
- `tanggal_selesai` (date) - end date
- `diagnosa` (text)
- `tanda_tangan_digital` (text) - doctor's name as digital signature
- `status` (text: 'aktif', 'dibatalkan')
- `created_at` (timestamptz)

### 5. New table: distribusi_obat
- Medicine distribution to external units (posyandu, etc.)
- `id` (uuid PK)
- `obat_id` (uuid FK to obat)
- `jumlah` (integer)
- `tujuan` (text) - destination e.g. "Posyandu Anggrek"
- `jenis_tujuan` (text) - type: 'Posyandu', 'Puskesmas Pembantu', 'Lainnya'
- `tanggal` (date)
- `petugas_id` (uuid FK to profiles)
- `keterangan` (text)
- `created_at` (timestamptz)

## Security
- All new tables have RLS enabled
- roles: SELECT all authenticated; INSERT/UPDATE/DELETE admin only
- surat_keterangan_sakit: SELECT all authenticated; INSERT/UPDATE dokter+admin; DELETE admin
- distribusi_obat: SELECT all authenticated; INSERT/UPDATE/DELETE inventori+admin
- kunjungan UPDATE policy updated to include pendaftaran (already allows pendaftaran)
*/

-- 1. Add vital signs + payment type to kunjungan
ALTER TABLE public.kunjungan ADD COLUMN IF NOT EXISTS tekanan_darah text DEFAULT '';
ALTER TABLE public.kunjungan ADD COLUMN IF NOT EXISTS suhu numeric DEFAULT NULL;
ALTER TABLE public.kunjungan ADD COLUMN IF NOT EXISTS berat_badan numeric DEFAULT NULL;
ALTER TABLE public.kunjungan ADD COLUMN IF NOT EXISTS tinggi_badan numeric DEFAULT NULL;
ALTER TABLE public.kunjungan ADD COLUMN IF NOT EXISTS pembiayaan text NOT NULL DEFAULT 'Umum' CHECK (pembiayaan IN ('Umum','BPJS'));

-- 2. Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_role text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  dibuat_oleh uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_staff" ON public.roles;
CREATE POLICY "roles_select_staff"
  ON public.roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "roles_insert_admin" ON public.roles;
CREATE POLICY "roles_insert_admin"
  ON public.roles FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "roles_update_admin" ON public.roles;
CREATE POLICY "roles_update_admin"
  ON public.roles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "roles_delete_admin" ON public.roles;
CREATE POLICY "roles_delete_admin"
  ON public.roles FOR DELETE TO authenticated USING (public.is_admin());

-- 3. Relax profiles role CHECK constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IS NOT NULL AND role <> '');

-- 4. Create surat_keterangan_sakit table
CREATE TABLE IF NOT EXISTS public.surat_keterangan_sakit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kunjungan_id uuid NOT NULL REFERENCES public.kunjungan(id) ON DELETE CASCADE,
  pasien_id uuid NOT NULL REFERENCES public.pasien(id) ON DELETE CASCADE,
  dokter_id uuid REFERENCES public.profiles(id),
  hari_sakit integer NOT NULL DEFAULT 1,
  tanggal_mulai date NOT NULL DEFAULT CURRENT_DATE,
  tanggal_selesai date NOT NULL DEFAULT CURRENT_DATE,
  diagnosa text DEFAULT '',
  tanda_tangan_digital text DEFAULT '',
  status text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','dibatalkan')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sks_kunjungan ON public.surat_keterangan_sakit(kunjungan_id);
CREATE INDEX IF NOT EXISTS idx_sks_pasien ON public.surat_keterangan_sakit(pasien_id);

ALTER TABLE public.surat_keterangan_sakit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sks_select_staff" ON public.surat_keterangan_sakit;
CREATE POLICY "sks_select_staff"
  ON public.surat_keterangan_sakit FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sks_insert_dokter_admin" ON public.surat_keterangan_sakit;
CREATE POLICY "sks_insert_dokter_admin"
  ON public.surat_keterangan_sakit FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('dokter','admin'));

DROP POLICY IF EXISTS "sks_update_dokter_admin" ON public.surat_keterangan_sakit;
CREATE POLICY "sks_update_dokter_admin"
  ON public.surat_keterangan_sakit FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('dokter','admin'))
  WITH CHECK (public.current_user_role() IN ('dokter','admin'));

DROP POLICY IF EXISTS "sks_delete_admin" ON public.surat_keterangan_sakit;
CREATE POLICY "sks_delete_admin"
  ON public.surat_keterangan_sakit FOR DELETE TO authenticated USING (public.is_admin());

-- 5. Create distribusi_obat table
CREATE TABLE IF NOT EXISTS public.distribusi_obat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obat_id uuid NOT NULL REFERENCES public.obat(id) ON DELETE RESTRICT,
  jumlah integer NOT NULL DEFAULT 0,
  tujuan text NOT NULL DEFAULT '',
  jenis_tujuan text NOT NULL DEFAULT 'Posyandu' CHECK (jenis_tujuan IN ('Posyandu','Puskesmas Pembantu','Lainnya')),
  tanggal date NOT NULL DEFAULT CURRENT_DATE,
  petugas_id uuid REFERENCES public.profiles(id),
  keterangan text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_distribusi_obat ON public.distribusi_obat(obat_id);
CREATE INDEX IF NOT EXISTS idx_distribusi_tanggal ON public.distribusi_obat(tanggal);

ALTER TABLE public.distribusi_obat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "distribusi_select_staff" ON public.distribusi_obat;
CREATE POLICY "distribusi_select_staff"
  ON public.distribusi_obat FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "distribusi_insert_inventori_admin" ON public.distribusi_obat;
CREATE POLICY "distribusi_insert_inventori_admin"
  ON public.distribusi_obat FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('inventori','admin'));

DROP POLICY IF EXISTS "distribusi_update_inventori_admin" ON public.distribusi_obat;
CREATE POLICY "distribusi_update_inventori_admin"
  ON public.distribusi_obat FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('inventori','admin'))
  WITH CHECK (public.current_user_role() IN ('inventori','admin'));

DROP POLICY IF EXISTS "distribusi_delete_admin" ON public.distribusi_obat;
CREATE POLICY "distribusi_delete_admin"
  ON public.distribusi_obat FOR DELETE TO authenticated USING (public.is_admin());

-- 6. Seed default roles
INSERT INTO public.roles (nama_role, label) VALUES
  ('admin', 'Super Admin'),
  ('pendaftaran', 'Administrasi Pendaftaran'),
  ('dokter', 'Dokter'),
  ('apoteker', 'Apoteker'),
  ('inventori', 'Petugas Inventori Obat')
ON CONFLICT (nama_role) DO NOTHING;
