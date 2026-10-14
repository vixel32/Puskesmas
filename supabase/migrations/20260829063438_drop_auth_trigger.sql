-- Drop the trigger that might be interfering with auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;