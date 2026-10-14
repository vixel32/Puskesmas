/*
# Create obat (medicine) table

1. New Tables
- `obat`
  - `id` (uuid PK)
  - `nama_obat` (text, medicine name)
  - `kategori` (text, category: Antibiotik/Analgesik/Vitamin/etc)
  - `satuan` (text, unit: tablet/botol/strip/etc)
  - `stok_saat_ini` (integer, current stock)
  - `stok_minimum` (integer, minimum stock threshold)
  - `harga` (numeric, price)
  - `lokasi_rak` (text, shelf location)
  - `tanggal_kadaluarsa` (date, expiry date)
  - `supplier` (text, supplier name)
  - `created_at` (timestamptz)

2. Security
- RLS enabled. SELECT for all authenticated staff.
- INSERT/UPDATE/DELETE for inventori and admin roles only.
*/

CREATE TABLE IF NOT EXISTS public.obat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_obat text NOT NULL DEFAULT '',
  kategori text DEFAULT '',
  satuan text DEFAULT 'tablet',
  stok_saat_ini integer NOT NULL DEFAULT 0,
  stok_minimum integer NOT NULL DEFAULT 0,
  harga numeric(12,2) DEFAULT 0,
  lokasi_rak text DEFAULT '',
  tanggal_kadaluarsa date,
  supplier text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obat_nama ON public.obat(nama_obat);
CREATE INDEX IF NOT EXISTS idx_obat_stok ON public.obat(stok_saat_ini);

ALTER TABLE public.obat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obat_select_staff" ON public.obat;
CREATE POLICY "obat_select_staff"
  ON public.obat FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "obat_insert_inventori_admin" ON public.obat;
CREATE POLICY "obat_insert_inventori_admin"
  ON public.obat FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('inventori','admin'));

DROP POLICY IF EXISTS "obat_update_inventori_admin" ON public.obat;
CREATE POLICY "obat_update_inventori_admin"
  ON public.obat FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('inventori','admin'))
  WITH CHECK (public.current_user_role() IN ('inventori','admin'));

DROP POLICY IF EXISTS "obat_delete_inventori_admin" ON public.obat;
CREATE POLICY "obat_delete_inventori_admin"
  ON public.obat FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('inventori','admin'));
