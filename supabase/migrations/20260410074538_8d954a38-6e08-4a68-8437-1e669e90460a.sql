
CREATE OR REPLACE FUNCTION public.check_admin_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'piohio309j@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) 
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER check_admin_on_profile_create
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_admin_email();
