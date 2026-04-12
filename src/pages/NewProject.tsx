import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertCircle, Server } from 'lucide-react';

const languages = [
  { id: 'javascript', name: 'JavaScript', icon: '🟨' },
  { id: 'typescript', name: 'TypeScript', icon: '🔷' },
  { id: 'python', name: 'Python', icon: '🐍' },
  { id: 'java', name: 'Java', icon: '☕' },
  { id: 'go', name: 'Go', icon: '🐹' },
  { id: 'rust', name: 'Rust', icon: '🦀' },
];

function parseMaxProjects(features: any): number {
  if (Array.isArray(features)) {
    for (const f of features) {
      if (typeof f === 'string') {
        const match = f.match(/(\d+)\s*(مشاريع|مشروع|projects?)/i);
        if (match) return parseInt(match[1]);
        if (f.includes('غير محدودة') || f.includes('unlimited')) return Infinity;
      }
    }
    return 1;
  }
  return 1;
}

interface BestSub {
  subId: string;
  planName: string;
  maxProjects: number;
  storageMb: number;
}

export default function NewProject() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [loading, setLoading] = useState(false);
  const [bestSub, setBestSub] = useState<BestSub | null>(null);
  const [usedProjects, setUsedProjects] = useState(0);

  // Find the BEST active subscription (highest sort_order / price) on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get ALL active subscriptions with their plan details (sort_order determines tier)
      const { data: allSubs } = await supabase
        .from('subscriptions')
        .select('id, plan_id, plans!inner(id, name, features, storage_mb, sort_order, price)')
        .eq('user_id', user!.id)
        .eq('status', 'active');

      if (!allSubs || allSubs.length === 0) {
        toast.error('لا يوجد اشتراك فعال');
        navigate('/plans');
        return;
      }

      // Sort by sort_order desc (highest tier first), then by price desc
      const sorted = [...allSubs].sort((a, b) => {
        const planA = (a as any).plans;
        const planB = (b as any).plans;
        if (planB.sort_order !== planA.sort_order) return planB.sort_order - planA.sort_order;
        return planB.price - planA.price;
      });

      const topSub = sorted[0];
      const topPlan = (topSub as any).plans;

      // Count ALL projects across ALL active subscriptions
      const allSubIds = allSubs.map(s => s.id);
      const { count: projCount } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id);
        // Count all user projects regardless of subscription

      setBestSub({
        subId: topSub.id,
        planName: topPlan.name,
        maxProjects: parseMaxProjects(topPlan.features),
        storageMb: topPlan.storage_mb,
      });
      setUsedProjects(projCount || 0);
    })();
  }, [user, navigate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !bestSub) return;
    setLoading(true);

    // Re-check: count all user projects vs best plan limit
    const { count: totalProjects } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const currentCount = totalProjects || 0;

    if (currentCount >= bestSub.maxProjects) {
      toast.error(`وصلت لحد المشاريع! (${currentCount}/${bestSub.maxProjects === Infinity ? '∞' : bestSub.maxProjects})`);
      setLoading(false);
      return;
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        subscription_id: bestSub.subId,
        name: name.trim(),
        language,
      })
      .select()
      .single();

    if (error) {
      toast.error('حدث خطأ في إنشاء المشروع');
    } else {
      // Create default file
      const defaultContent = language === 'python'
        ? `import discord\nfrom discord.ext import commands\n\nbot = commands.Bot(command_prefix='!')\n\n@bot.event\nasync def on_ready():\n    print(f'{bot.user} is online!')\n\nbot.run('YOUR_TOKEN')`
        : `const { Client, GatewayIntentBits } = require('discord.js');\n\nconst client = new Client({ intents: [GatewayIntentBits.Guilds] });\n\nclient.on('ready', () => {\n  console.log(\`Logged in as \${client.user.tag}!\`);\n});\n\nclient.login('YOUR_TOKEN');`;

      await supabase.from('project_files').insert({
        project_id: project.id,
        file_name: language === 'python' ? 'bot.py' : 'index.js',
        file_path: '/',
        content: defaultContent,
      });

      toast.success('تم إنشاء المشروع بنجاح!');
      navigate(`/dashboard/project/${project.id}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-4" dir="rtl">
      <div className="container mx-auto max-w-lg">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-bold gradient-text mb-6 text-center">مشروع جديد</h1>

          {/* Plan info & limits */}
          {bestSub && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${
                usedProjects >= bestSub.maxProjects
                  ? 'bg-red-500/10 border border-red-500/20'
                  : 'bg-secondary/50 border border-border/30'
              }`}
            >
              {usedProjects >= bestSub.maxProjects ? (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              ) : (
                <Server className="w-5 h-5 text-primary flex-shrink-0" />
              )}
              <div className="text-sm">
                <span className="text-muted-foreground">أفضل باقة ({bestSub.planName}) — </span>
                <span className={usedProjects >= bestSub.maxProjects ? 'text-red-400 font-medium' : 'text-foreground'}>
                  {usedProjects}/{bestSub.maxProjects === Infinity ? '∞' : bestSub.maxProjects} مشاريع مستخدمة
                </span>
                {usedProjects >= bestSub.maxProjects && (
                  <p className="text-red-400 text-xs mt-0.5">وصلت للحد الأقصى! قم بترقية باقتك لإنشاء مشاريع إضافية.</p>
                )}
              </div>
            </motion.div>
          )}

          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">اسم المشروع</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: My Discord Bot"
                required
                className="bg-secondary border-border/50"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-3">لغة البرمجة</label>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">
                {languages.map(lang => (
                  <motion.button
                    key={lang.id}
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setLanguage(lang.id)}
                    className={`p-3 rounded-xl text-center transition-all ${
                      language === lang.id
                        ? 'gradient-bg text-primary-foreground glow-primary'
                        : 'glass hover:bg-secondary'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{lang.icon}</span>
                    <span className="text-xs font-medium">{lang.name}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={loading || !bestSub} className="w-full gradient-bg text-primary-foreground">
              {loading ? 'جاري الإنشاء...' : 'إنشاء المشروع'}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
