import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const languages = [
  { id: 'javascript', name: 'JavaScript', icon: '🟨' },
  { id: 'typescript', name: 'TypeScript', icon: '🔷' },
  { id: 'python', name: 'Python', icon: '🐍' },
  { id: 'java', name: 'Java', icon: '☕' },
  { id: 'go', name: 'Go', icon: '🐹' },
  { id: 'rust', name: 'Rust', icon: '🦀' },
];

export default function NewProject() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan');

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !planId) return;
    setLoading(true);

    // Get active subscription for this plan
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('plan_id', planId)
      .eq('status', 'active')
      .maybeSingle();

    if (!sub) {
      toast.error('لا يوجد اشتراك فعال لهذه الباقة');
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
