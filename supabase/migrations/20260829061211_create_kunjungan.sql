/*
# Create kunjungan (visit) table

1. New Tables
- `kunjungan`
  - `id` (uuid, primary key)
  - `pasien_id` (uuid, references pasien)
  - `tanggal_kunjungan` (date, visit date)
  - `no_antrian` (text, queue number per poli per day)
  - `poli_tujuan` (text, target clinic: Umum/Gigi/KIA/etc)
  - `keluhan_awal` (text, initial complaint)
  - `status` (text: menunggu/diperiksa/selesai/batal)
  - `dibuat_oleh` (uuid, references profiles)
  - `created_at` (timestamptz)

2. Security
- RLS enabled. All authenticated staff can SELECT (shared clinical data).
- INSERT/UPDATE for pendaftaran, dokter, and admin roles.
- DELETE restricted to admin only.
*/

CREATE TABLE IF NOT EXISTS public.kunjungan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasien_id uuid NOT NULL REFERENCES public.pasien(id) ON DELETE CASCADE,
  tanggal_kunjungan date NOT NULL DEFAULT CURRENT_DATE,
  no_antrian text DEFAULT '',
  poli_tujuan text NOT NULL DEFAULT 'Umum',
  keluhan_awal text DEFAULT '',
  status text NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','dipanggil','diperiksa','selesai','batal')),
  dibuat_oleh uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kunjungan_tanggal ON public.kunjungan(tanggal_kunjungan);
CREATE INDEX IF NOT EXISTS idx_kunjungan_status ON public.kunjungan(status);
CREATE INDEX IF NOT EXISTS idx_kunjungan_poli ON public.kunjungan(poli_tujuan);

ALTER TABLE public.kunjungan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kunjungan_select_staff" ON public.kunjungan;
CREATE POLICY "kunjungan_select_staff"
  ON public.kunjungan FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "kunjungan_insert_pendaftaran_dokter_admin" ON public.kunjungan;
CREATE POLICY "kunjungan_insert_pendaftaran_dokter_admin"
  ON public.kunjungan FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('pendaftaran','dokter','admin'));

DROP POLICY IF EXISTS "kunjungan_update_pendaftaran_dokter_admin" ON public.kunjungan;
CREATE POLICY "kunjungan_update_pendaftaran_dokter_admin"
  ON public.kunjungan FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('pendaftaran','dokter','admin'))
  WITH CHECK (public.current_user_role() IN ('pendaftaran','dokter','admin'));

DROP POLICY IF EXISTS "kunjungan_delete_admin" ON public.kunjungan;
CREATE POLICY "kunjungan_delete_admin"
  ON public.kunjungan FOR DELETE
  TO authenticated
  USING (public.is_admin());
