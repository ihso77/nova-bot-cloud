-- Update plan prices to lower values
UPDATE public.plans SET price = 0.99, updated_at = now() WHERE name = 'أساسي' AND price != 0.99;
UPDATE public.plans SET price = 2.49, updated_at = now() WHERE name = 'احترافي' AND price != 2.49;
UPDATE public.plans SET price = 4.99, updated_at = now() WHERE name = 'مؤسسي' AND price != 4.99;
