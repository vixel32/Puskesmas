/*
# Create profiles table and role helper function

1. New Tables
- `profiles`
  - `id` (uuid, primary key, references auth.users)
  - `nama_lengkap` (text, full name of staff member)
  - `role` (text, one of: admin, pendaftaran, dokter, apoteker, inventori)
  - `no_hp` (text, phone number)
  - `foto` (text, URL to profile photo)
  - `status_aktif` (boolean, whether account is active, default true)
  - `created_at` (timestamptz)

2. Security
- Enable RLS on `profiles`.
- Each authenticated user can read all profiles (needed to display doctor/staff names across the app).
- Each user can update only their own profile row.
- Admin role can insert/update/delete any profile.
- A SECURITY DEFINER function `current_user_role()` returns the role of the calling user, used by RLS policies on all other tables to enforce role-based access.

3. Important Notes
- The `current_user_role()` function is SECURITY DEFINER so it can read profiles without being blocked by RLS (avoids recursion).
- A trigger `handle_new_user` auto-creates a profile row when a new auth.users record is inserted (e.g. via admin-created accounts). The role defaults to 'pendaftaran' and is updated by the admin user-management edge function.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_lengkap text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'pendaftaran' CHECK (role IN ('admin','pendaftaran','dokter','apoteker','inventori')),
  no_hp text DEFAULT '',
  foto text DEFAULT '',
  status_aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper: returns the role of the currently authenticated user (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid();
$$;

-- Helper: returns true if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.role = 'admin' FROM public.profiles p WHERE p.id = auth.uid()), false);
$$;

-- Trigger: auto-create a profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nama_lengkap, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_app_meta_data->>'role', 'pendaftaran')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin_insert" ON public.profiles;
CREATE POLICY "profiles_admin_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());
