-- ============================================================
-- Nova VPS - SQL Fix: جداول جديدة + تحديث الباقات
-- ============================================================
-- نفّذ هذه الأوامر في Supabase SQL Editor
-- تم إصلاح مشكلة UUID - كل ID صالح
-- ============================================================

-- 1. جدول سجل حالة المواقع (للمراقبة)
CREATE TABLE IF NOT EXISTS site_status_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'error')),
  latency_ms INTEGER,
  status_code INTEGER,
  error_message TEXT,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_status_logs_service ON site_status_logs(service_name);
CREATE INDEX IF NOT EXISTS idx_site_status_logs_checked ON site_status_logs(checked_at DESC);

-- ============================================================

-- 2. جدول سجل نشاط المنصة
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================

-- 3. جدول تذاكر الدعم
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  discord_user_id TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  admin_reply TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================

-- 4. جدول بيانات اتصال Discord
CREATE TABLE IF NOT EXISTS discord_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  discord_user_id TEXT NOT NULL UNIQUE,
  discord_username TEXT,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================

-- 5. جدول تفضيلات الإشعارات
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE,
  email_notifications BOOLEAN DEFAULT true,
  discord_notifications BOOLEAN DEFAULT false,
  payment_alerts BOOLEAN DEFAULT true,
  maintenance_alerts BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- تحديث الباقات الموجودة (أسعار أرخص + مميزات أكثر)
-- باستخدام UPDATE لأن الجداول موجودة مسبقاً
-- ============================================================

-- باقة مجانية
UPDATE plans SET
  name = 'مجاني',
  description = 'تجربة مجانية لاستضافة بوت واحد',
  price = 0,
  storage_mb = 512,
  ram_mb = 256,
  cpu_cores = 1,
  is_free = true,
  is_active = true,
  features = '["بوت واحد", "512MB تخزين", "256MB رام", "نشر فوري", "لوحة تحكم"]'::jsonb,
  sort_order = 1
WHERE sort_order = 1;

-- باقة أساسية
UPDATE plans SET
  name = 'أساسي',
  description = 'للبوتات الصغيرة - اقتصادي وعملي',
  price = 0.49,
  storage_mb = 1024,
  ram_mb = 512,
  cpu_cores = 1,
  is_free = false,
  is_active = true,
  features = '["3 مشاريع", "1GB تخزين", "512MB رام", "دعم فني أولي", "سجل الأنشطة", "إعادة تشغيل تلقائية"]'::jsonb,
  sort_order = 2
WHERE sort_order = 2;

-- باقة احترافية
UPDATE plans SET
  name = 'احترافي',
  description = 'الأكثر طلباً - أفضل قيمة مقابل السعر',
  price = 0.99,
  storage_mb = 3072,
  ram_mb = 1024,
  cpu_cores = 2,
  is_free = false,
  is_active = true,
  features = '["10 مشاريع", "3GB تخزين", "1GB رام", "دعم فني ذهبي", "نسخ احتياطي يومي", "نطاق فرعي مجاني", "إحصائيات متقدمة"]'::jsonb,
  sort_order = 3
WHERE sort_order = 3;

-- باقة مؤسسية
UPDATE plans SET
  name = 'مؤسسي',
  description = 'للخدمات الكبيرة والاحترافية',
  price = 1.99,
  storage_mb = 5120,
  ram_mb = 2048,
  cpu_cores = 4,
  is_free = false,
  is_active = true,
  features = '["مشاريع غير محدودة", "5GB تخزين", "2GB رام", "دعم VIP 24/7", "نسخ احتياطي كل ساعة", "نطاق فرعي + SSL", "API متقدم", "أولوية نشر"]'::jsonb,
  sort_order = 4
WHERE sort_order = 4;
