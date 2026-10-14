/*
# Add poli table for dynamic poli management

## Overview
Admin can CRUD poli. BuatKunjungan reads poli from this table instead of hardcoded POLI_OPTIONS.

## Security
- SELECT all authenticated (needed for pendaftaran to list poli)
- INSERT/UPDATE/DELETE admin only
*/

CREATE TABLE IF NOT EXISTS public.poli (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_poli text NOT NULL UNIQUE,
  kode_poli text NOT NULL DEFAULT '',
  keterangan text NOT NULL DEFAULT '',
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.poli ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poli_select_all" ON public.poli;
CREATE POLICY "poli_select_all"
  ON public.poli FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "poli_insert_admin" ON public.poli;
CREATE POLICY "poli_insert_admin"
  ON public.poli FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "poli_update_admin" ON public.poli;
CREATE POLICY "poli_update_admin"
  ON public.poli FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "poli_delete_admin" ON public.poli;
CREATE POLICY "poli_delete_admin"
  ON public.poli FOR DELETE TO authenticated USING (public.is_admin());

-- Seed default poli
INSERT INTO public.poli (nama_poli, kode_poli) VALUES
  ('Umum', 'UM'),
  ('Gigi', 'GG'),
  ('KIA', 'KIA'),
  ('Penyakit Dalam', 'PD'),
  ('Anak', 'AK'),
  ('Mata', 'MT'),
  ('THT', 'THT')
ON CONFLICT (nama_poli) DO NOTHING;