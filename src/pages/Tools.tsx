import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowLeft, Wrench, Zap } from 'lucide-react';

const tools = [
  {
    name: 'فاحص يوزرات ديسكورد',
    description: 'ابحث عن يوزرات ديسكورد غير مستخدمة بطول محدد. أداة مجانية وسريعة مع حفظ تلقائي للنتائج.',
    icon: Search,
    route: '/tools/discord-username-checker',
    tag: 'مجاني',
    tagColor: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  {
    name: 'مولد نيترو ديسكورد',
    description: 'يولد أكواد نيترو ديسكورد ويفحصها تلقائياً. يعرض الأكواد الصالحة وغير الصالحة مع سجل مفصل.',
    icon: Zap,
    route: '/tools/nitro-generator',
    tag: 'مجاني',
    tagColor: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
];

export default function Tools() {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-4" dir="rtl">
      <div className="container mx-auto max-w-5xl">
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
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto glow-primary">
              <Wrench className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground" />
            </div>
          </motion.div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3 sm:mb-4">
            <span className="gradient-text">ادوات مجانية</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-lg max-w-lg mx-auto">
            أدوات مفيدة ومجانية من Nova VPS لتحسين تجربتك
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {tools.map((tool, i) => (
            <motion.div
              key={tool.name}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.15 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="glass rounded-2xl p-5 sm:p-7 relative group cursor-pointer"
            >
              <div className="absolute top-4 left-4">
                <Badge className={`${tool.tagColor} text-xs`}>{tool.tag}</Badge>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl gradient-bg flex items-center justify-center mb-4 sm:mb-5">
                <tool.icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2">{tool.name}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-5 sm:mb-6">{tool.description}</p>
              <Link to={tool.route}>
                <Button className="gradient-bg text-primary-foreground gap-2 group-hover:glow-primary transition-all">
                  <span>فتح الأداة</span>
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 sm:mt-14 text-center"
        >
          <p className="text-muted-foreground text-sm">أدوات جديدة قريباً...</p>
        </motion.div>
      </div>
    </div>
  );
}
