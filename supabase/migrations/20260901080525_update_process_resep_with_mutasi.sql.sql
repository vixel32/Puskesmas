/*
# Update process_resep to use record_mutasi for automatic stock mutation logging

Now when a prescription is dispensed, each drug item:
1. Has stock deducted via FEFO (earliest expiry batch first)
2. Gets a log_mutasi entry automatically
3. Still records in stok_keluar for backward compatibility
*/
CREATE OR REPLACE FUNCTION public.process_resep(p_resep_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resep record;
  v_detail record;
  v_current_stock integer;
  v_petugas uuid := auth.uid();
  v_petugas_nama text;
  v_pasien_nama text;
  v_result jsonb;
BEGIN
  -- Get petugas name
  SELECT nama_lengkap INTO v_petugas_nama FROM public.profiles WHERE id = v_petugas;

  -- Check the prescription exists and is not already completed
  SELECT * INTO v_resep FROM public.resep WHERE id = p_resep_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resep tidak ditemukan');
  END IF;

  IF v_resep.status = 'selesai' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resep sudah diproses sebelumnya');
  END IF;

  -- Get patient name for keterangan
  SELECT p.nama INTO v_pasien_nama
    FROM public.resep r
    JOIN public.pemeriksaan pm ON r.pemeriksaan_id = pm.id
    JOIN public.kunjungan k ON pm.kunjungan_id = k.id
    JOIN public.pasien p ON k.pasien_id = p.id
    WHERE r.id = p_resep_id;

  -- Mark as selesai
  UPDATE public.resep SET status = 'selesai' WHERE id = p_resep_id;

  -- Process each detail item
  FOR v_detail IN SELECT * FROM public.resep_detail WHERE resep_id = p_resep_id
  LOOP
    -- Get current stock
    SELECT stok_saat_ini INTO v_current_stock FROM public.obat WHERE id = v_detail.obat_id;

    -- Record stock out via record_mutasi (FEFO + log_mutasi + obat update)
    -- Only deduct if stock > 0; if insufficient, deduct what's available
    IF v_current_stock > 0 THEN
      SELECT * INTO v_result FROM public.record_mutasi(
        v_detail.obat_id,
        'keluar',
        LEAST(v_detail.jumlah, v_current_stock),
        'Pelayanan Resep',
        '',
        NULL,
        'Resep pasien: ' || COALESCE(v_pasien_nama, '-'),
        v_petugas,
        COALESCE(v_petugas_nama, '')
      );
    END IF;

    -- Record in stok_keluar for backward compatibility
    INSERT INTO public.stok_keluar (obat_id, jumlah, tanggal, keterangan, referensi_resep_id, petugas_id)
    VALUES (v_detail.obat_id, v_detail.jumlah, CURRENT_DATE, 'resep', p_resep_id, v_petugas);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'message', 'Resep berhasil diproses');
END;
$function$;
