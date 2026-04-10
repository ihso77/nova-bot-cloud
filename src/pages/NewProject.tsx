import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

export default function NewProject() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan');

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [loading, setLoading] = useState(false);
  const [planInfo, setPlanInfo] = useState<{ name: string; maxProjects: number; usedProjects: number } | null>(null);

  // Load plan info on mount
  useEffect(() => {
    if (!user || !planId) return;
    (async () => {
      const { data: plan } = await supabase.from('plans').select('*').eq('id', planId).single();
      if (plan) {
        const { count } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', user!.id);
        setPlanInfo({
          name: plan.name,
          maxProjects: parseMaxProjects(plan.features),
          usedProjects: count || 0,
        });
      }
    })();
  }, [user, planId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !planId) return;
    setLoading(true);

    // Get active subscription for this plan
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, plan_id')
      .eq('user_id', user.id)
      .eq('plan_id', planId)
      .eq('status', 'active')
      .maybeSingle();

    if (!sub) {
      toast.error('لا يوجد اشتراك فعال لهذه الباقة');
      setLoading(false);
      return;
    }

    // Check project count limit
    const { count: projectCount } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    const { data: planData } = await supabase.from('plans').select('features').eq('id', sub.plan_id).single();
    const maxProjects = planData ? parseMaxProjects(planData.features) : 1;
    const usedProjects = projectCount || 0;

    if (usedProjects >= maxProjects) {
      toast.error(`وصلت لحد المشاريع! (${usedProjects}/${maxProjects === Infinity ? '∞' : maxProjects})`);
      setLoading(false);
      return;
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        subscription_id: sub.id,
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
    <div className="min-h-screen pt-24 pb-16 px-4" dir="rtl">
      <div className="container mx-auto max-w-lg">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass rounded-2xl p-8">
          <h1 className="text-2xl font-bold gradient-text mb-6 text-center">مشروع جديد</h1>

          {/* Plan info & limits */}
          {planInfo && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${
                planInfo.usedProjects >= planInfo.maxProjects
                  ? 'bg-red-500/10 border border-red-500/20'
                  : 'bg-secondary/50 border border-border/30'
              }`}
            >
              {planInfo.usedProjects >= planInfo.maxProjects ? (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              ) : (
                <Server className="w-5 h-5 text-primary flex-shrink-0" />
              )}
              <div className="text-sm">
                <span className="text-muted-foreground">باقة {planInfo.name} — </span>
                <span className={planInfo.usedProjects >= planInfo.maxProjects ? 'text-red-400 font-medium' : 'text-foreground'}>
                  {planInfo.usedProjects}/{planInfo.maxProjects === Infinity ? '∞' : planInfo.maxProjects} مشاريع مستخدمة
                </span>
                {planInfo.usedProjects >= planInfo.maxProjects && (
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
              <div className="grid grid-cols-3 gap-3">
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

            <Button type="submit" disabled={loading} className="w-full gradient-bg text-primary-foreground">
              {loading ? 'جاري الإنشاء...' : 'إنشاء المشروع'}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
