-- Update existing plans with cheaper prices and more features
UPDATE public.plans SET
  name = 'مجاني',
  description = 'مثالي للمبتدئين والتجربة المجانية',
  price = 0,
  storage_mb = 512,
  ram_mb = 256,
  cpu_cores = 0.5,
  features = '["مشروع واحد", "512MB تخزين", "256MB رام", "0.5 نواة معالج", "دعم مجتمعي", "نشر فوري", "لوحة تحكم أساسية"]'::jsonb,
  sort_order = 1
WHERE sort_order = 1;

UPDATE public.plans SET
  name = 'أساسي',
  description = 'للبوتات الصغيرة - اقتصادي وعملي',
  price = 0.49,
  storage_mb = 1024,
  ram_mb = 512,
  cpu_cores = 1.0,
  features = '["3 مشاريع", "1GB تخزين", "512MB رام", "1 نواة معالج", "دعم فني أولي", "نسخ احتياطي يومي", "نشر فوري", "لوحة تحكم متقدمة", "سجل الأنشطة"]'::jsonb,
  sort_order = 2
WHERE sort_order = 2;

UPDATE public.plans SET
  name = 'احترافي',
  description = 'الأكثر طلباً - أفضل قيمة مقابل السعر',
  price = 0.99,
  storage_mb = 3072,
  ram_mb = 1024,
  cpu_cores = 2.0,
  features = '["10 مشاريع", "3GB تخزين", "1GB رام", "2 نواة معالج", "دعم فني ذهبي", "نسخ احتياطي كل 6 ساعات", "نطاق فرعي مجاني", "إحصائيات متقدمة", "أولوية في النشر", "سجل الأنشطة الكامل"]'::jsonb,
  sort_order = 3
WHERE sort_order = 3;

UPDATE public.plans SET
  name = 'مؤسسي',
  description = 'للخدمات الكبيرة والاحترافية',
  price = 1.99,
  storage_mb = 5120,
  ram_mb = 2048,
  cpu_cores = 4.0,
  features = '["مشاريع غير محدودة", "5GB تخزين", "2GB رام", "4 نواة معالج", "دعم فني VIP 24/7", "نسخ احتياطي كل ساعة", "نطاق فرعي + SSL مجاني", "إحصائيات متقدمة", "أولوية في النشر", "سجل الأنشطة الكامل", "API متقدم", "ويب هوكات"]'::jsonb,
  sort_order = 4
WHERE sort_order = 4;
