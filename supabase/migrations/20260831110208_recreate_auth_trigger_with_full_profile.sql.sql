-- Re-create the auth user trigger to auto-create a full profile row
-- (including nik, no_hp, tanda_tangan_digital) so the edge function
-- only needs to call auth.admin.createUser — no separate upsert needed.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nik text;
  v_nama text;
  v_nik_suffix text;
  v_nama_prefix text;
  v_tdd text;
BEGIN
  v_nama := COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.raw_user_meta_data->>'full_name', '');
  v_nik := COALESCE(NEW.raw_user_meta_data->>'nik', '');

  -- Generate digital signature: TDD-{first 3 chars of name}-{last 6 chars of NIK}
  IF length(v_nama) >= 3 THEN
    v_nama_prefix := upper(substr(v_nama, 1, 3));
  ELSE
    v_nama_prefix := upper(rpad(v_nama, 3, 'X'));
  END IF;

  IF length(v_nik) >= 6 THEN
    v_nik_suffix := substr(v_nik, length(v_nik) - 5);
  ELSE
    v_nik_suffix := lpad(v_nik, 6, '0');
  END IF;

  IF v_nik = '' THEN
    v_tdd := '';
  ELSE
    v_tdd := 'TDD-' || v_nama_prefix || '-' || v_nik_suffix;
  END IF;

  INSERT INTO public.profiles (id, nama_lengkap, role, no_hp, nik, tanda_tangan_digital, status_aktif)
  VALUES (
    NEW.id,
    v_nama,
    COALESCE(NEW.raw_app_meta_data->>'role', 'pendaftaran'),
    COALESCE(NEW.raw_user_meta_data->>'no_hp', ''),
    v_nik,
    v_tdd,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    nama_lengkap = EXCLUDED.nama_lengkap,
    role = EXCLUDED.role,
    no_hp = EXCLUDED.no_hp,
    nik = EXCLUDED.nik,
    tanda_tangan_digital = EXCLUDED.tanda_tangan_digital;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
