/*
# Create stok_masuk and stok_keluar tables

1. New Tables
- `stok_masuk` (stock-in / medicine receipt log)
  - `id` (uuid PK)
  - `obat_id` (uuid FK to obat)
  - `jumlah` (integer, quantity received)
  - `tanggal` (date, receipt date)
  - `no_batch` (text, batch number)
  - `supplier` (text, supplier name)
  - `petugas_id` (uuid FK to profiles, who recorded it)
  - `created_at` (timestamptz)

- `stok_keluar` (stock-out / medicine dispensing log)
  - `id` (uuid PK)
  - `obat_id` (uuid FK to obat)
  - `jumlah` (integer, quantity dispensed)
  - `tanggal` (date, dispensing date)
  - `keterangan` (text: resep/rusak/kadaluarsa)
  - `referensi_resep_id` (uuid, nullable FK to resep)
  - `petugas_id` (uuid FK to profiles, who recorded it)
  - `created_at` (timestamptz)

2. Security
- Both tables have RLS enabled.
- SELECT: all authenticated staff (shared inventory data).
- INSERT/UPDATE/DELETE: inventori and admin for stok_masuk; apoteker, inventori, and admin for stok_keluar.
*/

CREATE TABLE IF NOT EXISTS public.stok_masuk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obat_id uuid NOT NULL REFERENCES public.obat(id) ON DELETE RESTRICT,
  jumlah integer NOT NULL DEFAULT 0,
  tanggal date NOT NULL DEFAULT CURRENT_DATE,
  no_batch text DEFAULT '',
  supplier text DEFAULT '',
  petugas_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stok_masuk_obat ON public.stok_masuk(obat_id);
CREATE INDEX IF NOT EXISTS idx_stok_masuk_tanggal ON public.stok_masuk(tanggal);

ALTER TABLE public.stok_masuk ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stok_masuk_select_staff" ON public.stok_masuk;
CREATE POLICY "stok_masuk_select_staff"
  ON public.stok_masuk FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "stok_masuk_insert_inventori_admin" ON public.stok_masuk;
CREATE POLICY "stok_masuk_insert_inventori_admin"
  ON public.stok_masuk FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('inventori','admin'));

DROP POLICY IF EXISTS "stok_masuk_update_inventori_admin" ON public.stok_masuk;
CREATE POLICY "stok_masuk_update_inventori_admin"
  ON public.stok_masuk FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('inventori','admin'))
  WITH CHECK (public.current_user_role() IN ('inventori','admin'));

DROP POLICY IF EXISTS "stok_masuk_delete_admin" ON public.stok_masuk;
CREATE POLICY "stok_masuk_delete_admin"
  ON public.stok_masuk FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- stok_keluar
CREATE TABLE IF NOT EXISTS public.stok_keluar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obat_id uuid NOT NULL REFERENCES public.obat(id) ON DELETE RESTRICT,
  jumlah integer NOT NULL DEFAULT 0,
  tanggal date NOT NULL DEFAULT CURRENT_DATE,
  keterangan text DEFAULT 'resep' CHECK (keterangan IN ('resep','rusak','kadaluarsa','lainnya')),
  referensi_resep_id uuid REFERENCES public.resep(id) ON DELETE SET NULL,
  petugas_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stok_keluar_obat ON public.stok_keluar(obat_id);
CREATE INDEX IF NOT EXISTS idx_stok_keluar_tanggal ON public.stok_keluar(tanggal);

ALTER TABLE public.stok_keluar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stok_keluar_select_staff" ON public.stok_keluar;
CREATE POLICY "stok_keluar_select_staff"
  ON public.stok_keluar FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "stok_keluar_insert_apoteker_inventori_admin" ON public.stok_keluar;
CREATE POLICY "stok_keluar_insert_apoteker_inventori_admin"
  ON public.stok_keluar FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('apoteker','inventori','admin'));

DROP POLICY IF EXISTS "stok_keluar_update_apoteker_inventori_admin" ON public.stok_keluar;
CREATE POLICY "stok_keluar_update_apoteker_inventori_admin"
  ON public.stok_keluar FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('apoteker','inventori','admin'))
  WITH CHECK (public.current_user_role() IN ('apoteker','inventori','admin'));

DROP POLICY IF EXISTS "stok_keluar_delete_admin" ON public.stok_keluar;
CREATE POLICY "stok_keluar_delete_admin"
  ON public.stok_keluar FOR DELETE
  TO authenticated
  USING (public.is_admin());
