import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Server, Zap, Shield, Clock, ArrowLeft, Globe, Lock, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ParticlesBackground from '@/components/ParticlesBackground';

const features = [
  { icon: Server, title: 'استضافة موثوقة', desc: 'خوادم عالية الأداء وسرعة فائقة' },
  { icon: Zap, title: 'نشر فوري', desc: 'شغّل بوتك بضغطة زر واحدة' },
  { icon: Shield, title: 'حماية متقدمة', desc: 'حماية DDoS ونسخ احتياطي تلقائي' },
  { icon: Clock, title: 'عمل 24/7', desc: 'بوتك يعمل بدون توقف على مدار الساعة' },
];

const stats = [
  { value: '99.9%', label: 'وقت التشغيل' },
  { value: '+500', label: 'بوت نشط' },
  { value: '<1s', label: 'زمن الاستجابة' },
  { value: '24/7', label: 'الدعم الفني' },
];

export default function Index() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen relative overflow-hidden" dir="rtl">
      <ParticlesBackground />

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4 sm:px-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: 'spring' }}
          className="mb-6 sm:mb-8"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl gradient-bg flex items-center justify-center mx-auto glow-primary floating">
            <Server className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-primary-foreground" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-4xl sm:text-5xl md:text-7xl font-black mb-4 sm:mb-6"
        >
          <span className="gradient-text">Nova VPS</span>
        </motion.h1>

        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mb-8 sm:mb-10 px-2"
        >
          استضف بوتات ديسكورد بكل سهولة وأداء عالي
        </motion.p>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center"
        >
          <Button onClick={() => navigate('/plans')} size="lg" className="gradient-bg text-primary-foreground text-base sm:text-lg px-8 sm:px-10 glow-primary">
            تصفح الباقات
          </Button>
          <Button onClick={() => navigate('/register')} size="lg" variant="outline" className="text-base sm:text-lg px-8 sm:px-10 border-primary/30 hover:bg-primary/10">
            ابدأ مجاناً
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-14 sm:mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 w-full max-w-3xl"
        >
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-black gradient-text">{stat.value}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-16 sm:py-24 px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-8 sm:mb-12"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 sm:mb-4">
              <span className="gradient-text">لماذا Nova VPS؟</span>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-lg">كل ما تحتاجه لاستضافة بوتاتك في مكان واحد</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 max-w-6xl mx-auto">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="glass rounded-xl p-4 sm:p-6 text-center"
              >
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg gradient-bg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <f.icon className="w-5 h-5 sm:w-7 sm:h-7 text-primary-foreground" />
                </div>
                <h3 className="text-sm sm:text-lg font-bold mb-1 sm:mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer / Website Info */}
      <footer className="relative z-10 border-t border-border/30 py-8 sm:py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-10 mb-8 sm:mb-10">
            {/* About */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Server className="w-5 h-5 text-primary" />
                <span className="text-lg font-bold gradient-text">Nova VPS</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                منصة استضافة سحابية متخصصة في بوتات ديسكورد. نوفر لك بيئة استضافة موثوقة وآمنة مع واجهة تحكم سهلة الاستخدام ونشر فوري.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold mb-4">روابط سريعة</h4>
              <div className="space-y-2">
                <Link to="/plans" className="block text-sm text-muted-foreground hover:text-primary transition-colors">الباقات والأسعار</Link>
                <Link to="/register" className="block text-sm text-muted-foreground hover:text-primary transition-colors">إنشاء حساب جديد</Link>
                <Link to="/login" className="block text-sm text-muted-foreground hover:text-primary transition-colors">تسجيل الدخول</Link>
              </div>
            </div>

            {/* Features */}
            <div>
              <h4 className="font-bold mb-4">المميزات</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>خوادم عالية السرعة</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>حماية وتشفير متقدم</span>
                </div>
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>دعم فني على مدار الساعة</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/30 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <p className="text-xs text-muted-foreground">
              Nova VPS &copy; {new Date().getFullYear()} - جميع الحقوق محفوظة
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>سياسة الخصوصية</span>
              <span>شروط الاستخدام</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
