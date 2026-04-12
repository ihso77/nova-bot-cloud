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

-- باقة مجانية محسّنة
UPDATE plans SET
  name = 'مجاني',
  description = 'تجربة مجانية لاستضافة بوت واحد',
  price = 0,
  storage_mb = 1024,
  ram_mb = 512,
  cpu_cores = 1,
  is_free = true,
  is_active = true,
  features = ARRAY['استضافة بوت واحد', '1024MB تخزين', '512MB رام', '1 نواة معالج', 'دعم 24 ساعة', 'لوحة تحكم كاملة', '30 يوم تجربة']::text[],
  sort_order = 1
WHERE sort_order = 1;

-- باقة أساسية رخيصة
UPDATE plans SET
  name = 'أساسي',
  description = 'مثالي للمبتدئين مع مميزات أساسية',
  price = 0.49,
  storage_mb = 2048,
  ram_mb = 1024,
  cpu_cores = 1,
  is_free = false,
  is_active = true,
  features = ARRAY['استضافة 2 بوتات', '2GB تخزين', '1GB رام', '1 نواة معالج', 'دعم 24 ساعة', 'لوحة تحكم كاملة', 'سجل نشاط', 'إعادة تشغيل تلقائية']::text[],
  sort_order = 2
WHERE sort_order = 2;

-- باقة احترافية - الأكثر طلباً
UPDATE plans SET
  name = 'احترافي',
  description = 'للمحترفين بأداء عالي ومميزات متقدمة',
  price = 0.99,
  storage_mb = 5120,
  ram_mb = 2048,
  cpu_cores = 2,
  is_free = false,
  is_active = true,
  features = ARRAY['استضافة 5 بوتات', '5GB تخزين', '2GB رام', '2 نواة معالج', 'دعم أولوية', 'لوحة تحكم متقدمة', 'سجل نشاط مفصّل', 'إعادة تشغيل تلقائية', 'نسخ احتياطي يومي', 'نطاق مخصص', 'SSL مجاني']::text[],
  sort_order = 3
WHERE sort_order = 3;

-- باقة مؤسسية
UPDATE plans SET
  name = 'مؤسسي',
  description = 'للشركات والمشاريع الكبيرة بأقصى أداء',
  price = 1.99,
  storage_mb = 10240,
  ram_mb = 4096,
  cpu_cores = 4,
  is_free = false,
  is_active = true,
  features = ARRAY['استضافة غير محدودة', '10GB تخزين', '4GB رام', '4 نواة معالج', 'دعم VIP على مدار الساعة', 'لوحة تحكم مؤسسية', 'سجل نشاط شامل', 'إعادة تشغيل تلقائية', 'نسخ احتياطي كل 6 ساعات', 'نطاق مخصص', 'SSL مجاني', 'CDN', 'تحليلات متقدمة', 'API كامل']::text[],
  sort_order = 4
WHERE sort_order = 4;
