-- Trigger: auto-update dam volumes whenever a movement is inserted
DROP TRIGGER IF EXISTS trg_apply_movement ON public.movements;
CREATE TRIGGER trg_apply_movement
  AFTER INSERT ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_movement();

-- Trigger: auto-create profile + role for new auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers: maintain updated_at columns
DROP TRIGGER IF EXISTS trg_dams_updated_at ON public.dams;
CREATE TRIGGER trg_dams_updated_at
  BEFORE UPDATE ON public.dams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();