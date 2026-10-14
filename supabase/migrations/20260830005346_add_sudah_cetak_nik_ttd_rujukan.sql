/*
# Add sudah_dicetak to SKS, NIK + tanda_tangan_digital to profiles, surat_rujukan table

## Overview
This migration supports 4 feature revisions:
1. surat_keterangan_sakit: add `sudah_dicetak` boolean to track whether the certificate has been printed, so the apoteker badge only counts unprinted ones.
2. profiles: add `nik` (text) for doctor NIK and `tanda_tangan_digital` (text) for a generated digital signature string derived from NIK.
3. New table `surat_rujukan` for doctor referral letters to hospitals.

## Changes

### 1. surat_keterangan_sakit - add sudah_dicetak
- `sudah_dicetak` (boolean, default false) — set to true when the print button is clicked

### 2. profiles - add nik + tanda_tangan_digital
- `nik` (text, default '') — doctor's NIK, entered by admin when creating a user
- `tanda_tangan_digital` (text, default '') — generated digital signature string

### 3. New table: surat_rujukan
- Doctor referral letters to external hospitals
- `id` (uuid PK)
- `kunjungan_id` (uuid FK to kunjungan)
- `pasien_id` (uuid FK to pasien)
- `dokter_id` (uuid FK to profiles)
- `rs_tujuan` (text) — destination hospital name
- `poli_tujuan` (text) — destination department/poli
- `alasan_rujukan` (text) — reason for referral
- `diagnosa_sementara` (text) — preliminary diagnosis
- `tindakan_yang_diberikan` (text) — treatment given
- `tanda_tangan_digital` (text) — doctor's digital signature
- `sudah_dicetak` (boolean, default false)
- `status` (text: 'aktif', 'dibatalkan')
- `created_at` (timestamptz)

## Security
- surat_rujukan: SELECT all authenticated; INSERT/UPDATE dokter+admin; DELETE admin
- profiles UPDATE policy already allows admin; no change needed
- surat_keterangan_sakit UPDATE policy already allows dokter+admin; no change needed
*/

-- 1. Add sudah_dicetak to surat_keterangan_sakit
ALTER TABLE public.surat_keterangan_sakit ADD COLUMN IF NOT EXISTS sudah_dicetak boolean NOT NULL DEFAULT false;

-- 2. Add nik + tanda_tangan_digital to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nik text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tanda_tangan_digital text NOT NULL DEFAULT '';

-- 3. Create surat_rujukan table
CREATE TABLE IF NOT EXISTS public.surat_rujukan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kunjungan_id uuid NOT NULL REFERENCES public.kunjungan(id) ON DELETE CASCADE,
  pasien_id uuid NOT NULL REFERENCES public.pasien(id) ON DELETE CASCADE,
  dokter_id uuid REFERENCES public.profiles(id),
  rs_tujuan text NOT NULL DEFAULT '',
  poli_tujuan text NOT NULL DEFAULT '',
  alasan_rujukan text NOT NULL DEFAULT '',
  diagnosa_sementara text DEFAULT '',
  tindakan_yang_diberikan text DEFAULT '',
  tanda_tangan_digital text DEFAULT '',
  sudah_dicetak boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','dibatalkan')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rujukan_kunjungan ON public.surat_rujukan(kunjungan_id);
CREATE INDEX IF NOT EXISTS idx_rujukan_pasien ON public.surat_rujukan(pasien_id);

ALTER TABLE public.surat_rujukan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rujukan_select_staff" ON public.surat_rujukan;
CREATE POLICY "rujukan_select_staff"
  ON public.surat_rujukan FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rujukan_insert_dokter_admin" ON public.surat_rujukan;
CREATE POLICY "rujukan_insert_dokter_admin"
  ON public.surat_rujukan FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('dokter','admin'));

DROP POLICY IF EXISTS "rujukan_update_dokter_admin" ON public.surat_rujukan;
CREATE POLICY "rujukan_update_dokter_admin"
  ON public.surat_rujukan FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('dokter','admin'))
  WITH CHECK (public.current_user_role() IN ('dokter','admin'));

DROP POLICY IF EXISTS "rujukan_delete_admin" ON public.surat_rujukan;
CREATE POLICY "rujukan_delete_admin"
  ON public.surat_rujukan FOR DELETE TO authenticated USING (public.is_admin());