/*
# Add expired drug auto-return to supplier support

Changes:
1. Extend log_mutasi.jenis_mutasi CHECK to include 'kembali_supplier'
2. Add status_retur column to batch_stok ('normal', 'dijadwalkan_retur', 'sudah_retur')
3. Create process_expired_batches() function that:
   - Finds all batches with stock > 0 and tanggal_kadaluarsa < today
   - For each: deducts stock via record_mutasi, marks batch as 'sudah_retur'
   - Returns summary of processed batches
*/
-- 1. Extend jenis_mutasi CHECK constraint
ALTER TABLE public.log_mutasi DROP CONSTRAINT IF EXISTS log_mutasi_jenis_mutasi_check;
ALTER TABLE public.log_mutasi ADD CONSTRAINT log_mutasi_jenis_mutasi_check
  CHECK (jenis_mutasi IN ('masuk', 'keluar', 'penyesuaian', 'kembali_supplier'));

-- 2. Add status_retur to batch_stok
ALTER TABLE public.batch_stok ADD COLUMN IF NOT EXISTS status_retur text NOT NULL DEFAULT 'normal'
  CHECK (status_retur IN ('normal', 'dijadwalkan_retur', 'sudah_retur'));

-- 3. Create process_expired_batches function
CREATE OR REPLACE FUNCTION public.process_expired_batches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_batch record;
  v_count integer := 0;
  v_results jsonb[] := '{}';
  v_result jsonb;
  v_petugas uuid := auth.uid();
  v_petugas_nama text;
BEGIN
  -- Get petugas name
  IF v_petugas IS NOT NULL THEN
    SELECT nama_lengkap INTO v_petugas_nama FROM public.profiles WHERE id = v_petugas;
  END IF;

  -- Find all expired batches with remaining stock that haven't been returned
  FOR v_batch IN
    SELECT b.id, b.obat_id, b.nomor_batch, b.tanggal_kadaluarsa, b.jumlah_stok, b.supplier,
           o.nama_obat
      FROM public.batch_stok b
      JOIN public.obat o ON b.obat_id = o.id
      WHERE b.jumlah_stok > 0
        AND b.tanggal_kadaluarsa IS NOT NULL
        AND b.tanggal_kadaluarsa < CURRENT_DATE
        AND b.status_retur = 'normal'
      ORDER BY b.tanggal_kadaluarsa ASC
  LOOP
    -- Record mutasi keluar (return to supplier)
    SELECT * INTO v_result FROM public.record_mutasi(
      v_batch.obat_id,
      'kembali_supplier',
      v_batch.jumlah_stok,
      'Retur ke Supplier: ' || COALESCE(v_batch.supplier, 'Supplier Tidak Diketahui'),
      v_batch.nomor_batch,
      v_batch.tanggal_kadaluarsa,
      'AUTO: Obat kadaluarsa - dikembalikan ke ' || COALESCE(v_batch.supplier, 'supplier') || ' (Batch: ' || v_batch.nomor_batch || ', Exp: ' || v_batch.tanggal_kadaluarsa || ')',
      v_petugas,
      COALESCE(v_petugas_nama, 'Sistem Otomatis')
    );

    IF (v_result->>'success')::boolean THEN
      -- Mark batch as sudah_retur
      UPDATE public.batch_stok SET status_retur = 'sudah_retur' WHERE id = v_batch.id;
      v_count := v_count + 1;
      v_results := array_append(v_results, jsonb_build_object(
        'obat', v_batch.nama_obat,
        'batch', v_batch.nomor_batch,
        'jumlah', v_batch.jumlah_stok,
        'supplier', v_batch.supplier,
        'kadaluarsa', v_batch.tanggal_kadaluarsa
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', v_count, 'items', to_jsonb(v_results));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.process_expired_batches() TO authenticated;
