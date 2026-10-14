/*
# Add batch_stok and log_mutasi tables for FEFO-based inventory tracking

## Overview
This migration creates the core tables for a proper pharmacy inventory system:
1. `batch_stok` — tracks individual medicine batches with expiry dates and current stock per batch
2. `log_mutasi` — the master mutation log recording every stock movement (in, out, adjustment) with running balance
3. `obat` table — add `kode_obat` column for medicine codes

## Changes

### 1. obat table
- Add `kode_obat` (text, default '') — unique medicine code

### 2. New table: batch_stok
- `id` (uuid PK)
- `obat_id` (uuid FK to obat)
- `nomor_batch` (text) — batch number
- `tanggal_kadaluarsa` (date) — expiry date
- `jumlah_stok` (integer, default 0) — current stock in this batch
- `supplier` (text) — supplier for this batch
- `harga_beli` (numeric) — purchase price per unit
- `harga_jual` (numeric) — selling price per unit
- `created_at` (timestamptz)

### 3. New table: log_mutasi
- `id` (uuid PK)
- `timestamp` (timestamptz) — when the mutation occurred
- `obat_id` (uuid FK to obat)
- `batch_stok_id` (uuid FK to batch_stok, nullable) — which batch was affected
- `nomor_batch` (text) — batch number (denormalized for history)
- `jenis_mutasi` (text) — 'masuk', 'keluar', 'penyesuaian'
- `jumlah` (integer) — quantity moved (positive for masuk, negative for keluar)
- `sumber_tujuan` (text) — source/destination e.g. 'Gudang Utama', 'Poli Gigi', 'Pustu'
- `stok_awal` (integer) — stock before this mutation
- `stok_akhir` (integer) — stock after this mutation
- `nama_petugas` (text) — who recorded it
- `petugas_id` (uuid FK to profiles, nullable)
- `keterangan` (text) — additional notes

## Security
- Both tables: SELECT all authenticated; INSERT/UPDATE/DELETE for inventori+admin
*/

-- 1. Add kode_obat to obat
ALTER TABLE public.obat ADD COLUMN IF NOT EXISTS kode_obat text NOT NULL DEFAULT '';

-- 2. Create batch_stok table
CREATE TABLE IF NOT EXISTS public.batch_stok (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obat_id uuid NOT NULL REFERENCES public.obat(id) ON DELETE CASCADE,
  nomor_batch text NOT NULL DEFAULT '',
  tanggal_kadaluarsa date,
  jumlah_stok integer NOT NULL DEFAULT 0,
  supplier text NOT NULL DEFAULT '',
  harga_beli numeric(12,2) NOT NULL DEFAULT 0,
  harga_jual numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_obat ON public.batch_stok(obat_id);
CREATE INDEX IF NOT EXISTS idx_batch_kadaluarsa ON public.batch_stok(tanggal_kadaluarsa);

ALTER TABLE public.batch_stok ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "batch_select_staff" ON public.batch_stok;
CREATE POLICY "batch_select_staff"
  ON public.batch_stok FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "batch_insert_inventori_admin" ON public.batch_stok;
CREATE POLICY "batch_insert_inventori_admin"
  ON public.batch_stok FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('inventori','admin'));

DROP POLICY IF EXISTS "batch_update_inventori_admin" ON public.batch_stok;
CREATE POLICY "batch_update_inventori_admin"
  ON public.batch_stok FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('inventori','admin'))
  WITH CHECK (public.current_user_role() IN ('inventori','admin'));

DROP POLICY IF EXISTS "batch_delete_admin" ON public.batch_stok;
CREATE POLICY "batch_delete_admin"
  ON public.batch_stok FOR DELETE TO authenticated USING (public.is_admin());

-- 3. Create log_mutasi table
CREATE TABLE IF NOT EXISTS public.log_mutasi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  obat_id uuid NOT NULL REFERENCES public.obat(id) ON DELETE CASCADE,
  batch_stok_id uuid REFERENCES public.batch_stok(id) ON DELETE SET NULL,
  nomor_batch text NOT NULL DEFAULT '',
  jenis_mutasi text NOT NULL DEFAULT 'masuk' CHECK (jenis_mutasi IN ('masuk','keluar','penyesuaian')),
  jumlah integer NOT NULL DEFAULT 0,
  sumber_tujuan text NOT NULL DEFAULT '',
  stok_awal integer NOT NULL DEFAULT 0,
  stok_akhir integer NOT NULL DEFAULT 0,
  nama_petugas text NOT NULL DEFAULT '',
  petugas_id uuid REFERENCES public.profiles(id),
  keterangan text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_mutasi_obat ON public.log_mutasi(obat_id);
CREATE INDEX IF NOT EXISTS idx_mutasi_timestamp ON public.log_mutasi(timestamp);
CREATE INDEX IF NOT EXISTS idx_mutasi_jenis ON public.log_mutasi(jenis_mutasi);

ALTER TABLE public.log_mutasi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mutasi_select_staff" ON public.log_mutasi;
CREATE POLICY "mutasi_select_staff"
  ON public.log_mutasi FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "mutasi_insert_inventori_admin" ON public.log_mutasi;
CREATE POLICY "mutasi_insert_inventori_admin"
  ON public.log_mutasi FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('inventori','admin','apoteker'));

DROP POLICY IF EXISTS "mutasi_update_inventori_admin" ON public.log_mutasi;
CREATE POLICY "mutasi_update_inventori_admin"
  ON public.log_mutasi FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('inventori','admin'))
  WITH CHECK (public.current_user_role() IN ('inventori','admin'));

DROP POLICY IF EXISTS "mutasi_delete_admin" ON public.log_mutasi;
CREATE POLICY "mutasi_delete_admin"
  ON public.log_mutasi FOR DELETE TO authenticated USING (public.is_admin());
