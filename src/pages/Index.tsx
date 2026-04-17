import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Server, Zap, Shield, Clock, ArrowLeft, Globe, Lock, Headphones, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ParticlesBackground from '@/components/ParticlesBackground';
import { useTranslation } from 'react-i18next';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { y: 30, opacity: 0 },
  show: { y: 0, opacity: 1 },
};

export default function Index() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const features = [
    { icon: Server, title: t('index.reliableHosting'), desc: t('index.reliableHostingDesc') },
    { icon: Zap, title: t('index.instantDeploy'), desc: t('index.instantDeployDesc') },
    { icon: Shield, title: t('index.advancedProtection'), desc: t('index.advancedProtectionDesc') },
    { icon: Clock, title: t('index.uptime247'), desc: t('index.uptime247Desc') },
  ];

  const stats = [
    { value: '99.9%', label: t('index.uptime') },
    { value: '+500', label: t('index.activeBots') },
    { value: '<1s', label: t('index.responseTime') },
    { value: '24/7', label: t('index.techSupport') },
  ];

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
          <span className="gradient-text animate-glitch">Nova VPS</span>
        </motion.h1>

        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mb-8 sm:mb-10 px-2"
        >
          {t('index.heroSubtitle')}
        </motion.p>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center"
        >
          <Button onClick={() => navigate('/plans')} size="lg" className="gradient-bg text-primary-foreground text-base sm:text-lg px-8 sm:px-10 glow-primary">
            {t('index.browsePlans')}
          </Button>
          <Button onClick={() => navigate('/register')} size="lg" variant="outline" className="text-base sm:text-lg px-8 sm:px-10 border-primary/30 hover:bg-primary/10">
            {t('index.startFree')}
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="mt-14 sm:mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 w-full max-w-3xl"
        >
          {stats.map((stat, i) => (
            <motion.div key={i} variants={item} className="text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-black gradient-text">{stat.value}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</div>
            </motion.div>
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
              <span className="gradient-text">{t('index.whyNova')}</span>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-lg">{t('index.whyNovaDesc')}</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 max-w-6xl mx-auto">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -8, scale: 1.03 }}
                className="glass rounded-xl p-4 sm:p-6 text-center group hover:border-primary/30 transition-all duration-300"
              >
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg gradient-bg flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:glow-primary transition-all duration-300">
                  <f.icon className="w-5 h-5 sm:w-7 sm:h-7 text-primary-foreground" />
                </div>
                <h3 className="text-sm sm:text-lg font-bold mb-1 sm:mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-16 sm:py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-8 sm:p-12 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 animate-shimmer" />
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-black mb-4 gradient-text">{t('index.needHelp')}</h2>
              <p className="text-muted-foreground mb-6">{t('index.needHelpDesc')}</p>
              <a href="https://discord.gg/yMnRNeK2X3" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="gradient-bg text-primary-foreground gap-2 glow-primary">
                  <MessageCircle className="w-5 h-5" />
                  {t('index.joinSupport')}
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 py-8 sm:py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-10 mb-8 sm:mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Server className="w-5 h-5 text-primary" />
                <span className="text-lg font-bold gradient-text">Nova VPS</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t('index.footerDesc')}
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4">{t('index.quickLinks')}</h4>
              <div className="space-y-2">
                <Link to="/plans" className="block text-sm text-muted-foreground hover:text-primary transition-colors">{t('index.plansPricing')}</Link>
                <Link to="/register" className="block text-sm text-muted-foreground hover:text-primary transition-colors">{t('index.createAccount')}</Link>
                <Link to="/tools" className="block text-sm text-muted-foreground hover:text-primary transition-colors">{t('index.freeTools')}</Link>
                <a href="https://discord.gg/yMnRNeK2X3" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" /> {t('index.supportServer')}
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-4">{t('index.features')}</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{t('index.highSpeed')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{t('index.encryption')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{t('index.support247')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/30 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <p className="text-xs text-muted-foreground">
              Nova VPS &copy; {new Date().getFullYear()} - {t('index.allRightsReserved')}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href="https://discord.gg/yMnRNeK2X3" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Discord</a>
              <span>{t('index.privacyPolicy')}</span>
              <span>{t('index.termsOfUse')}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
