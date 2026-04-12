-- إنشاء جدول المدفوعات
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'paymento',
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- تفعيل الدفع
INSERT INTO public.settings (key, value) VALUES ('payment_enabled', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now();

-- تحديث أسعار الباقات
UPDATE plans SET price = 0.99 WHERE name = 'أساسي';
UPDATE plans SET price = 2.49 WHERE name = 'احترافي';
UPDATE plans SET price = 4.99 WHERE name = 'مؤسسي';
