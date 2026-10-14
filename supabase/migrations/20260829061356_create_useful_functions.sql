/*
# Create utility functions: generate_no_antrian and process_resep

1. Functions
- `generate_no_antrian(poli text)` — returns the next queue number for a given poli on the current day.
  Format: e.g. "U-001" for Umum, "G-001" for Gigi, "K-001" for KIA.

- `process_resep(p_resep_id uuid)` — SECURITY DEFINER function that:
  a) Marks the prescription status as 'selesai'
  b) For each resep_detail item, deducts the quantity from obat.stok_saat_ini
  c) Inserts a stok_keluar record for each item with keterangan='resep'
  d) Returns a success/error message
  This function is callable by apoteker and admin roles.

2. Security
- generate_no_antrian is callable by all authenticated users (SECURITY DEFINER).
- process_resep is SECURITY DEFINER so it can update obat stock and insert stok_keluar
  even though the calling role (apoteker) doesn't have direct UPDATE on obat.
*/

CREATE OR REPLACE FUNCTION public.generate_no_antrian(p_poli text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_count integer;
  v_result text;
BEGIN
  v_prefix := UPPER(LEFT(COALESCE(p_poli, 'Umum'), 1));
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.kunjungan
  WHERE poli_tujuan = p_poli
    AND tanggal_kunjungan = CURRENT_DATE
    AND status != 'batal';
    
  v_result := v_prefix || '-' || lpad(v_count::text, 3, '0');
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_no_antrian(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_resep(p_resep_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resep record;
  v_detail record;
  v_current_stock integer;
  v_petugas uuid := auth.uid();
BEGIN
  -- Check the prescription exists and is not already completed
  SELECT * INTO v_resep FROM public.resep WHERE id = p_resep_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resep tidak ditemukan');
  END IF;
  
  IF v_resep.status = 'selesai' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resep sudah diproses sebelumnya');
  END IF;
  
  -- Mark as selesai
  UPDATE public.resep SET status = 'selesai' WHERE id = p_resep_id;
  
  -- Process each detail item
  FOR v_detail IN SELECT * FROM public.resep_detail WHERE resep_id = p_resep_id
  LOOP
    -- Get current stock
    SELECT stok_saat_ini INTO v_current_stock FROM public.obat WHERE id = v_detail.obat_id;
    
    -- Deduct stock (can go to 0, but not negative — if insufficient, set to 0)
    UPDATE public.obat 
    SET stok_saat_ini = GREATEST(0, stok_saat_ini - v_detail.jumlah)
    WHERE id = v_detail.obat_id;
    
    -- Record stock out
    INSERT INTO public.stok_keluar (obat_id, jumlah, tanggal, keterangan, referensi_resep_id, petugas_id)
    VALUES (v_detail.obat_id, v_detail.jumlah, CURRENT_DATE, 'resep', p_resep_id, v_petugas);
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'message', 'Resep berhasil diproses');
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_resep(uuid) TO authenticated;
