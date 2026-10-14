/*
# Update record_mutasi to accept 'kembali_supplier' jenis_mutasi

Treats 'kembali_supplier' identically to 'keluar' (FEFO stock deduction),
but logs with the actual jenis_mutasi value passed in.
*/
CREATE OR REPLACE FUNCTION public.record_mutasi(
  p_obat_id uuid,
  p_jenis_mutasi text,
  p_jumlah integer,
  p_sumber_tujuan text DEFAULT '',
  p_nomor_batch text DEFAULT '',
  p_tanggal_kadaluarsa date DEFAULT NULL,
  p_keterangan text DEFAULT '',
  p_petugas_id uuid DEFAULT NULL,
  p_petugas_nama text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stok_awal integer;
  v_stok_akhir integer;
  v_adj integer;
  v_remaining integer;
  v_batch record;
  v_take integer;
  v_batch_id uuid;
  v_existing_batch record;
  v_petugas uuid := COALESCE(p_petugas_id, auth.uid());
  v_is_outflow boolean;
BEGIN
  -- Validate jenis_mutasi
  IF p_jenis_mutasi NOT IN ('masuk', 'keluar', 'penyesuaian', 'kembali_supplier') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Jenis mutasi tidak valid');
  END IF;

  -- Validate jumlah
  IF p_jumlah IS NULL OR p_jumlah = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Jumlah harus lebih dari 0');
  END IF;

  -- Get current stock
  SELECT stok_saat_ini INTO v_stok_awal FROM public.obat WHERE id = p_obat_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Obat tidak ditemukan');
  END IF;

  -- Get petugas name if not provided
  IF p_petugas_nama = '' AND v_petugas IS NOT NULL THEN
    SELECT nama_lengkap INTO p_petugas_nama FROM public.profiles WHERE id = v_petugas;
  END IF;

  -- 'keluar' and 'kembali_supplier' both deduct stock with FEFO
  v_is_outflow := p_jenis_mutasi IN ('keluar', 'kembali_supplier');

  IF p_jenis_mutasi = 'masuk' THEN
    -- MASUK: increase stock
    v_stok_akhir := v_stok_awal + p_jumlah;

    -- Create or update batch_stok
    IF p_nomor_batch IS NOT NULL AND p_nomor_batch <> '' THEN
      SELECT id, jumlah_stok INTO v_existing_batch
        FROM public.batch_stok
        WHERE obat_id = p_obat_id AND nomor_batch = p_nomor_batch
        LIMIT 1;

      IF FOUND THEN
        UPDATE public.batch_stok
          SET jumlah_stok = jumlah_stok + p_jumlah,
              tanggal_kadaluarsa = COALESCE(p_tanggal_kadaluarsa, tanggal_kadaluarsa),
              supplier = CASE WHEN p_sumber_tujuan <> '' THEN p_sumber_tujuan ELSE supplier END
          WHERE id = v_existing_batch.id;
        v_batch_id := v_existing_batch.id;
      ELSE
        INSERT INTO public.batch_stok (obat_id, nomor_batch, tanggal_kadaluarsa, jumlah_stok, supplier)
          VALUES (p_obat_id, p_nomor_batch, p_tanggal_kadaluarsa, p_jumlah, p_sumber_tujuan)
          RETURNING id INTO v_batch_id;
      END IF;
    END IF;

    -- Update obat stock
    UPDATE public.obat SET stok_saat_ini = v_stok_akhir WHERE id = p_obat_id;

    -- Log mutation
    INSERT INTO public.log_mutasi (
      obat_id, batch_stok_id, nomor_batch, jenis_mutasi, jumlah,
      sumber_tujuan, stok_awal, stok_akhir, nama_petugas, petugas_id, keterangan
    ) VALUES (
      p_obat_id, v_batch_id, COALESCE(p_nomor_batch, ''), 'masuk', p_jumlah,
      COALESCE(p_sumber_tujuan, ''), v_stok_awal, v_stok_akhir, COALESCE(p_petugas_nama, ''), v_petugas, COALESCE(p_keterangan, '')
    );

  ELSIF v_is_outflow THEN
    -- KELUAR / KEMBALI_SUPPLIER: decrease stock with FEFO
    IF p_jumlah > v_stok_awal THEN
      RETURN jsonb_build_object('success', false, 'error', 'Stok tidak cukup. Tersedia: ' || v_stok_awal);
    END IF;

    v_stok_akhir := v_stok_awal - p_jumlah;
    v_remaining := p_jumlah;

    -- FEFO: deduct from batches with earliest expiry first
    FOR v_batch IN
      SELECT id, nomor_batch, jumlah_stok
        FROM public.batch_stok
        WHERE obat_id = p_obat_id AND jumlah_stok > 0
        ORDER BY tanggal_kadaluarsa ASC NULLS LAST, created_at ASC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_batch.jumlah_stok, v_remaining);

      -- Update batch stock
      UPDATE public.batch_stok SET jumlah_stok = jumlah_stok - v_take WHERE id = v_batch.id;

      -- Log mutation per batch
      INSERT INTO public.log_mutasi (
        obat_id, batch_stok_id, nomor_batch, jenis_mutasi, jumlah,
        sumber_tujuan, stok_awal, stok_akhir, nama_petugas, petugas_id, keterangan
      ) VALUES (
        p_obat_id, v_batch.id, v_batch.nomor_batch, p_jenis_mutasi, -v_take,
        COALESCE(p_sumber_tujuan, ''), v_stok_awal, v_stok_akhir, COALESCE(p_petugas_nama, ''), v_petugas, COALESCE(p_keterangan, '')
      );

      v_remaining := v_remaining - v_take;
    END LOOP;

    -- If no batches existed, log a single entry without batch
    IF v_remaining = p_jumlah THEN
      INSERT INTO public.log_mutasi (
        obat_id, batch_stok_id, nomor_batch, jenis_mutasi, jumlah,
        sumber_tujuan, stok_awal, stok_akhir, nama_petugas, petugas_id, keterangan
      ) VALUES (
        p_obat_id, NULL, '', p_jenis_mutasi, -p_jumlah,
        COALESCE(p_sumber_tujuan, ''), v_stok_awal, v_stok_akhir, COALESCE(p_petugas_nama, ''), v_petugas, COALESCE(p_keterangan, '')
      );
      v_remaining := 0;
    END IF;

    -- Update obat stock
    UPDATE public.obat SET stok_saat_ini = v_stok_akhir WHERE id = p_obat_id;

  ELSIF p_jenis_mutasi = 'penyesuaian' THEN
    -- PENYESUAIAN: +/- adjustment (p_jumlah can be negative for reduction)
    v_adj := p_jumlah;
    v_stok_akhir := v_stok_awal + v_adj;

    IF v_stok_akhir < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Stok hasil penyesuaian tidak boleh minus');
    END IF;

    -- Update obat stock
    UPDATE public.obat SET stok_saat_ini = v_stok_akhir WHERE id = p_obat_id;

    -- Log mutation
    INSERT INTO public.log_mutasi (
      obat_id, batch_stok_id, nomor_batch, jenis_mutasi, jumlah,
      sumber_tujuan, stok_awal, stok_akhir, nama_petugas, petugas_id, keterangan
    ) VALUES (
      p_obat_id, NULL, COALESCE(p_nomor_batch, ''), 'penyesuaian', v_adj,
      COALESCE(p_sumber_tujuan, 'Stock Opname'), v_stok_awal, v_stok_akhir, COALESCE(p_petugas_nama, ''), v_petugas, COALESCE(p_keterangan, '')
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'stok_awal', v_stok_awal, 'stok_akhir', v_stok_akhir);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_mutasi(uuid, text, integer, text, text, date, text, uuid, text) TO authenticated;
