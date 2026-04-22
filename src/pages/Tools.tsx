import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowLeft, Wrench, Zap, Clock, Star, Package } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } },
};
const item = {
  hidden: { y: 40, opacity: 0 },
  show: { y: 0, opacity: 1 },
};

export default function Tools() {
  const { t } = useTranslation();

  const tools = [
    {
      name: t('tools.usernameChecker'),
      description: t('tools.usernameCheckerDesc'),
      icon: Search,
      route: '/tools/discord-username-checker',
      tag: t('tools.free'),
      tagColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    },
    {
      name: t('tools.nitroGenerator'),
      description: t('tools.nitroGeneratorDesc'),
      icon: Zap,
      route: '/tools/nitro-generator',
      tag: t('tools.free'),
      tagColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    },
    {
      name: t('tools.timestampGen'),
      description: t('tools.timestampGenDesc'),
      icon: Clock,
      route: '/tools/discord-timestamp',
      tag: t('tools.free'),
      tagColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    },
    {
      name: t('tools.novaTool'),
      description: t('tools.novaToolDesc'),
      icon: Package,
      route: '/tools/nova-tool',
      tag: t('tools.novaToolTag'),
      tagColor: 'bg-primary/20 text-primary border-primary/30',
      image: '/NOVA_TOOL.png',
      price: 0.99,
    },
  ];

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-10 sm:mb-14"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, type: 'spring' }}
            className="mb-5"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#002b86] flex items-center justify-center mx-auto floating">
              <Wrench className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
          </motion.div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3 sm:mb-4">
            <span className="gradient-text">{t('tools.title')}</span>
          </h1>
          <p className="text-[#71717a] text-sm sm:text-lg max-w-lg mx-auto">
            {t('tools.subtitle')}
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
        >
          {tools.map((tool) => (
            <motion.div
              key={tool.route}
              variants={item}
              whileHover={{ y: -6, scale: 1.02 }}
              className="glass-card rounded-2xl p-5 sm:p-7 relative group cursor-pointer hover:border-primary/30 transition-all duration-300"
            >
              <div className="absolute top-4 left-4">
                <Badge className={`${tool.tagColor} text-xs`}>{tool.tag}</Badge>
              </div>
              {tool.image ? (
                <div className="mb-4 sm:mb-5 rounded-xl overflow-hidden border border-white/8">
                  <img src={tool.image} alt={tool.name} className="w-full h-32 sm:h-36 object-contain bg-secondary/20 group-hover:glow-primary transition-all duration-300" />
                </div>
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#002b86] flex items-center justify-center mb-4 sm:mb-5 transition-all duration-300">
                  <tool.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
              )}
              <h3 className="text-lg sm:text-xl font-bold mb-2">{tool.name}</h3>
              <p className="text-[#71717a] text-sm leading-relaxed mb-2">{tool.description}</p>
              {'price' in tool && (
                <div className="flex items-center gap-2 mb-5 sm:mb-6">
                  <Star className="w-4 h-4 text-[#002b86]" />
                  <span className="text-lg font-bold gradient-text">${(tool as any).price.toFixed(2)}</span>
                  <span className="text-[#71717a] text-xs">{t('novaTool.oneTime')}</span>
                </div>
              )}
              <Link to={tool.route}>
                <Button className="bg-[#002b86] hover:bg-[#0035a0] text-white gap-2 transition-all">
                  <span>{tool.tagColor.includes('primary') ? t('tools.viewDetails') : t('tools.openTool')}</span>
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 sm:mt-14 text-center"
        >
          <p className="text-[#71717a] text-sm">{t('tools.comingSoon')}</p>
        </motion.div>
      </div>
    </div>
  );
}
