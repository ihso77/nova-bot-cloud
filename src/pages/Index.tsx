import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Server, Zap, Shield, Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ParticlesBackground from '@/components/ParticlesBackground';

const features = [
  { icon: Server, title: 'استضافة موثوقة', desc: 'خوادم عالية الأداء على Railway' },
  { icon: Zap, title: 'نشر فوري', desc: 'شغّل بوتك بضغطة زر' },
  { icon: Shield, title: 'حماية متقدمة', desc: 'حماية DDoS ونسخ احتياطي' },
  { icon: Clock, title: 'عمل 24/7', desc: 'بوتك يعمل بدون توقف' },
];

export default function Index() {
  return (
    <div className="min-h-screen relative overflow-hidden" dir="rtl">
      <ParticlesBackground />
      
      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: 'spring' }}
          className="mb-8"
        >
          <div className="w-24 h-24 rounded-2xl gradient-bg flex items-center justify-center mx-auto glow-primary floating">
            <Server className="w-12 h-12 text-primary-foreground" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-5xl md:text-7xl font-black mb-6"
        >
          <span className="gradient-text">Nova VPS</span>
        </motion.h1>

        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-10"
        >
          استضف بوتات ديسكورد بكل سهولة وأداء عالي
        </motion.p>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex gap-4"
        >
          <Link to="/plans">
            <Button size="lg" className="gradient-bg text-primary-foreground text-lg px-8 glow-primary">
              تصفح الباقات <ArrowLeft className="w-5 h-5 mr-2" />
            </Button>
          </Link>
          <Link to="/register">
            <Button size="lg" variant="outline" className="text-lg px-8 border-primary/30 hover:bg-primary/10">
              ابدأ مجاناً
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-24 px-4">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="glass rounded-xl p-6 text-center"
            >
              <div className="w-14 h-14 rounded-lg gradient-bg flex items-center justify-center mx-auto mb-4">
                <f.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
