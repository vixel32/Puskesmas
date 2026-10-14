/*
# Create pemeriksaan, resep, and resep_detail tables

1. New Tables
- `pemeriksaan` (clinical examination record)
  - `id` (uuid PK)
  - `kunjungan_id` (uuid FK to kunjungan)
  - `dokter_id` (uuid FK to profiles)
  - `anamnesa` (text)
  - `tekanan_darah` (text, e.g. "120/80")
  - `suhu` (numeric, Celsius)
  - `berat_badan` (numeric, kg)
  - `tinggi_badan` (numeric, cm)
  - `diagnosa` (text)
  - `icd10_kode` (text, optional)
  - `catatan_dokter` (text)
  - `tanggal_pemeriksaan` (date)

- `resep` (prescription header)
  - `id` (uuid PK)
  - `pemeriksaan_id` (uuid FK to pemeriksaan)
  - `dokter_id` (uuid FK to profiles)
  - `status` (text: menunggu/diproses/selesai)
  - `catatan_resep` (text)
  - `tanggal_resep` (date)

- `resep_detail` (prescription line items)
  - `id` (uuid PK)
  - `resep_id` (uuid FK to resep)
  - `obat_id` (uuid FK to obat)
  - `jumlah` (integer)
  - `aturan_pakai` (text, e.g. "3x1 sesudah makan")
  - `catatan` (text)

2. Security
- All tables have RLS enabled.
- SELECT: all authenticated staff.
- pemeriksaan INSERT/UPDATE: dokter and admin.
- resep INSERT: dokter and admin; UPDATE: dokter, apoteker, admin.
- resep_detail INSERT/UPDATE: dokter, apoteker, admin.
- DELETE: admin only on all three.
*/

CREATE TABLE IF NOT EXISTS public.pemeriksaan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kunjungan_id uuid NOT NULL REFERENCES public.kunjungan(id) ON DELETE CASCADE,
  dokter_id uuid REFERENCES public.profiles(id),
  anamnesa text DEFAULT '',
  tekanan_darah text DEFAULT '',
  suhu numeric DEFAULT NULL,
  berat_badan numeric DEFAULT NULL,
  tinggi_badan numeric DEFAULT NULL,
  diagnosa text DEFAULT '',
  icd10_kode text DEFAULT '',
  catatan_dokter text DEFAULT '',
  tanggal_pemeriksaan date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pemeriksaan_kunjungan ON public.pemeriksaan(kunjungan_id);
CREATE INDEX IF NOT EXISTS idx_pemeriksaan_dokter ON public.pemeriksaan(dokter_id);

ALTER TABLE public.pemeriksaan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pemeriksaan_select_staff" ON public.pemeriksaan;
CREATE POLICY "pemeriksaan_select_staff"
  ON public.pemeriksaan FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "pemeriksaan_insert_dokter_admin" ON public.pemeriksaan;
CREATE POLICY "pemeriksaan_insert_dokter_admin"
  ON public.pemeriksaan FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('dokter','admin'));

DROP POLICY IF EXISTS "pemeriksaan_update_dokter_admin" ON public.pemeriksaan;
CREATE POLICY "pemeriksaan_update_dokter_admin"
  ON public.pemeriksaan FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('dokter','admin'))
  WITH CHECK (public.current_user_role() IN ('dokter','admin'));

DROP POLICY IF EXISTS "pemeriksaan_delete_admin" ON public.pemeriksaan;
CREATE POLICY "pemeriksaan_delete_admin"
  ON public.pemeriksaan FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- resep
CREATE TABLE IF NOT EXISTS public.resep (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pemeriksaan_id uuid NOT NULL REFERENCES public.pemeriksaan(id) ON DELETE CASCADE,
  dokter_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','diproses','selesai')),
  catatan_resep text DEFAULT '',
  tanggal_resep date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resep_pemeriksaan ON public.resep(pemeriksaan_id);
CREATE INDEX IF NOT EXISTS idx_resep_status ON public.resep(status);

ALTER TABLE public.resep ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resep_select_staff" ON public.resep;
CREATE POLICY "resep_select_staff"
  ON public.resep FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "resep_insert_dokter_admin" ON public.resep;
CREATE POLICY "resep_insert_dokter_admin"
  ON public.resep FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('dokter','admin'));

DROP POLICY IF EXISTS "resep_update_dokter_apoteker_admin" ON public.resep;
CREATE POLICY "resep_update_dokter_apoteker_admin"
  ON public.resep FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('dokter','apoteker','admin'))
  WITH CHECK (public.current_user_role() IN ('dokter','apoteker','admin'));

DROP POLICY IF EXISTS "resep_delete_admin" ON public.resep;
CREATE POLICY "resep_delete_admin"
  ON public.resep FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- resep_detail
CREATE TABLE IF NOT EXISTS public.resep_detail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resep_id uuid NOT NULL REFERENCES public.resep(id) ON DELETE CASCADE,
  obat_id uuid NOT NULL REFERENCES public.obat(id) ON DELETE RESTRICT,
  jumlah integer NOT NULL DEFAULT 1,
  aturan_pakai text DEFAULT '',
  catatan text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resep_detail_resep ON public.resep_detail(resep_id);

ALTER TABLE public.resep_detail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resep_detail_select_staff" ON public.resep_detail;
CREATE POLICY "resep_detail_select_staff"
  ON public.resep_detail FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "resep_detail_insert_dokter_apoteker_admin" ON public.resep_detail;
CREATE POLICY "resep_detail_insert_dokter_apoteker_admin"
  ON public.resep_detail FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('dokter','apoteker','admin'));

DROP POLICY IF EXISTS "resep_detail_update_dokter_apoteker_admin" ON public.resep_detail;
CREATE POLICY "resep_detail_update_dokter_apoteker_admin"
  ON public.resep_detail FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('dokter','apoteker','admin'))
  WITH CHECK (public.current_user_role() IN ('dokter','apoteker','admin'));

DROP POLICY IF EXISTS "resep_detail_delete_admin" ON public.resep_detail;
CREATE POLICY "resep_detail_delete_admin"
  ON public.resep_detail FOR DELETE
  TO authenticated
  USING (public.is_admin());
