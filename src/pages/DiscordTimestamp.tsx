import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Copy, Check, CalendarDays, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const FORMATS = [
  { key: 't', label: 'وقت قصير', example: '09:30 PM' },
  { key: 'T', label: 'وقت طويل', example: '09:30:00 PM' },
  { key: 'd', label: 'تاريخ قصير', example: '14/04/2026' },
  { key: 'D', label: 'تاريخ طويل', example: 'April 14, 2026' },
  { key: 'f', label: 'تاريخ ووقت', example: 'April 14, 2026 09:30 PM' },
  { key: 'F', label: 'تاريخ ووقت كامل', example: 'Tuesday, April 14, 2026 09:30 PM' },
  { key: 'R', label: 'نسبي', example: 'منذ 5 دقائق' },
];

export default function DiscordTimestamp() {
  const [date, setDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const unix = useMemo(() => {
    const d = new Date(date);
    return Math.floor(d.getTime() / 1000);
  }, [date]);

  const copyCode = (key: string) => {
    const code = `<t:${unix}:${key}>`;
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    toast.success('تم النسخ!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const previewTimestamp = (key: string) => {
    const d = new Date(unix * 1000);
    const opts: Record<string, Intl.DateTimeFormatOptions> = {
      t: { hour: '2-digit', minute: '2-digit' },
      T: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
      d: { day: '2-digit', month: '2-digit', year: 'numeric' },
      D: { day: 'numeric', month: 'long', year: 'numeric' },
      f: { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
      F: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    };

    if (key === 'R') {
      const diff = Math.floor((Date.now() - d.getTime()) / 1000);
      if (Math.abs(diff) < 60) return `منذ ${Math.abs(diff)} ثانية`;
      if (Math.abs(diff) < 3600) return `منذ ${Math.floor(Math.abs(diff) / 60)} دقيقة`;
      if (Math.abs(diff) < 86400) return `منذ ${Math.floor(Math.abs(diff) / 3600)} ساعة`;
      return `منذ ${Math.floor(Math.abs(diff) / 86400)} يوم`;
    }

    return d.toLocaleString('en-US', opts[key]);
  };

  const setNow = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    setDate(local.toISOString().slice(0, 16));
  };

  const addMinutes = (mins: number) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + mins);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    setDate(local.toISOString().slice(0, 16));
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-3 sm:px-4" dir="rtl">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-6 sm:mb-10"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, type: 'spring' }}
            className="mb-4"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto glow-primary floating">
              <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground" />
            </div>
          </motion.div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3">
            <span className="gradient-text">مولد طوابع الوقت</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-lg max-w-lg mx-auto">
            أنشئ طوابع وقت ديسكورد الديناميكية - تظهر بتوقيت كل مستخدم تلقائياً
          </p>
        </motion.div>

        {/* Date Picker */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">اختر التاريخ والوقت</h2>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 font-mono text-base"
              />
              <Button onClick={setNow} variant="outline" className="gap-2">
                <Clock className="w-4 h-4" /> الآن
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {[5, 10, 30, 60, 1440].map((m) => (
                <Button
                  key={m}
                  variant="outline"
                  size="sm"
                  onClick={() => addMinutes(m)}
                  className="text-xs"
                >
                  +{m >= 60 ? `${m / 60} ساعة` : `${m} دقيقة`}
                </Button>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">Unix Timestamp:</span>
                <code className="font-mono font-bold text-primary">{unix}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 mr-auto"
                  onClick={() => {
                    navigator.clipboard.writeText(String(unix));
                    toast.success('تم النسخ!');
                  }}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Formats Grid */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <AnimatePresence>
              {FORMATS.map((fmt, i) => (
                <motion.div
                  key={fmt.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  whileHover={{ scale: 1.02, y: -2 }}
                >
                  <Card
                    className="glass p-4 cursor-pointer group hover:border-primary/40 transition-all animate-border-glow"
                    onClick={() => copyCode(fmt.key)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-sm mb-1">{fmt.label}</h3>
                        <Badge variant="outline" className="text-xs font-mono">
                          {`:${fmt.key}`}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        {copiedKey === fmt.key ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                      </Button>
                    </div>

                    <div className="mt-2 p-2 rounded bg-[#2b2d31] border border-[#3f4147]">
                      <span className="text-sm text-[#00a8fc] font-medium">
                        {previewTimestamp(fmt.key)}
                      </span>
                    </div>

                    <div className="mt-2">
                      <code className="text-xs text-muted-foreground font-mono select-all">
                        {`<t:${unix}:${fmt.key}>`}
                      </code>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* How to use */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 sm:mt-8"
        >
          <Card className="glass p-4 sm:p-6">
            <h3 className="font-bold text-lg mb-3 gradient-text">كيف تستخدم؟</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>1. اختر التاريخ والوقت المطلوب</p>
              <p>2. اضغط على الصيغة المناسبة لنسخ الكود</p>
              <p>3. الصق الكود في رسالة ديسكورد</p>
              <p>4. سيظهر الوقت ديناميكياً بتوقيت كل مستخدم!</p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
