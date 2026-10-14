/*
# Create pasien (patient) table

1. New Tables
- `pasien`
  - `id` (uuid, primary key)
  - `no_rekam_medis` (text, unique auto-generated medical record number, format RM-YYYYMM-XXXX)
  - `nik` (text, national ID number)
  - `nama` (text, patient name)
  - `tanggal_lahir` (date, date of birth)
  - `jenis_kelamin` (text, L/P)
  - `alamat` (text, address)
  - `no_hp` (text, phone)
  - `golongan_darah` (text, blood type)
  - `alergi` (text, known allergies)
  - `tanggal_daftar_pertama` (date, first registration date)
  - `created_at` (timestamptz)
  - `created_by` (uuid, references profiles)

2. Security
- RLS enabled. All authenticated staff can SELECT (patients are shared clinical data).
- INSERT/UPDATE allowed for pendaftaran and admin roles.
- DELETE restricted to admin only.

3. Notes
- no_rekam_medis auto-generated via DEFAULT using a sequence.
*/

CREATE SEQUENCE IF NOT EXISTS public.pasien_rm_seq START 1;

CREATE TABLE IF NOT EXISTS public.pasien (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  no_rekam_medis text UNIQUE NOT NULL DEFAULT ('RM-' || to_char(now(), 'YYYYMM') || '-' || lpad((nextval('pasien_rm_seq')::text), 4, '0')),
  nik text DEFAULT '',
  nama text NOT NULL DEFAULT '',
  tanggal_lahir date,
  jenis_kelamin text DEFAULT '' CHECK (jenis_kelamin IN ('','L','P')),
  alamat text DEFAULT '',
  no_hp text DEFAULT '',
  golongan_darah text DEFAULT '' CHECK (golongan_darah IN ('','A','B','AB','O','-')),
  alergi text DEFAULT '',
  tanggal_daftar_pertama date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.pasien ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pasien_select_staff" ON public.pasien;
CREATE POLICY "pasien_select_staff"
  ON public.pasien FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "pasien_insert_pendaftaran_admin" ON public.pasien;
CREATE POLICY "pasien_insert_pendaftaran_admin"
  ON public.pasien FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('pendaftaran','admin'));

DROP POLICY IF EXISTS "pasien_update_pendaftaran_admin" ON public.pasien;
CREATE POLICY "pasien_update_pendaftaran_admin"
  ON public.pasien FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('pendaftaran','admin'))
  WITH CHECK (public.current_user_role() IN ('pendaftaran','admin'));

DROP POLICY IF EXISTS "pasien_delete_admin" ON public.pasien;
CREATE POLICY "pasien_delete_admin"
  ON public.pasien FOR DELETE
  TO authenticated
  USING (public.is_admin());
