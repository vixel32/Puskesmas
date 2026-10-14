/*
# Add harga_jual to obat, enhance stok_masuk with full item details

## Overview
This migration supports inventory enhancements:
1. Add `harga_jual` (selling price) to the `obat` table — previously only had `harga` (purchase price).
2. Add detailed columns to `stok_masuk`: kategori, satuan, harga_beli, harga_jual, tanggal_kadaluarsa, lokasi_rak.
   These capture the item state at the time of stock receipt for audit purposes.
3. Rename existing `harga` column to `harga_beli` for clarity (keep old column as alias via view is NOT needed;
   we add `harga_beli` as a new column and keep `harga` for backwards compatibility).

## Changes

### 1. obat table
- Add `harga_jual` (numeric, default 0) — selling price per unit

### 2. stok_masuk table
- Add `kategori` (text, default '') — category at time of receipt
- Add `satuan` (text, default '') — unit at time of receipt
- Add `harga_beli` (numeric, default 0) — purchase price per unit
- Add `harga_jual` (numeric, default 0) — selling price per unit
- Add `tanggal_kadaluarsa` (date, nullable) — expiry date
- Add `lokasi_rak` (text, default '') — shelf location

## Security
- No RLS policy changes needed — existing policies already cover the new columns.
*/

-- 1. Add harga_jual to obat
ALTER TABLE public.obat ADD COLUMN IF NOT EXISTS harga_jual numeric(12,2) NOT NULL DEFAULT 0;

-- 2. Add detailed columns to stok_masuk
ALTER TABLE public.stok_masuk ADD COLUMN IF NOT EXISTS kategori text NOT NULL DEFAULT '';
ALTER TABLE public.stok_masuk ADD COLUMN IF NOT EXISTS satuan text NOT NULL DEFAULT '';
ALTER TABLE public.stok_masuk ADD COLUMN IF NOT EXISTS harga_beli numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.stok_masuk ADD COLUMN IF NOT EXISTS harga_jual numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.stok_masuk ADD COLUMN IF NOT EXISTS tanggal_kadaluarsa date;
ALTER TABLE public.stok_masuk ADD COLUMN IF NOT EXISTS lokasi_rak text NOT NULL DEFAULT '';
