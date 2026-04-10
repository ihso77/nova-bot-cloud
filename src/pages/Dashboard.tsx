import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderOpen, Clock, Play, Square } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  language: string;
  status: string;
  created_at: string;
}

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  expires_at: string;
  is_free_trial: boolean;
  plans: { name: string; price: number } | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    const [projRes, subRes] = await Promise.all([
      supabase.from('projects').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*, plans(name, price)').eq('user_id', user!.id).eq('status', 'active'),
    ]);
    if (projRes.data) setProjects(projRes.data);
    if (subRes.data) setSubscriptions(subRes.data as any);
    setLoading(false);
  };

  const statusColors: Record<string, string> = {
    running: 'bg-success',
    stopped: 'bg-muted-foreground',
    deploying: 'bg-warning',
    error: 'bg-destructive',
  };

  const statusLabels: Record<string, string> = {
    running: 'يعمل',
    stopped: 'متوقف',
    deploying: 'جاري النشر',
    error: 'خطأ',
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen pt-24 pb-16 px-4" dir="rtl">
      <div className="container mx-auto max-w-5xl">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold gradient-text">مشاريعي</h1>
          {subscriptions.length > 0 && (
            <Link to={`/dashboard/new-project?plan=${subscriptions[0].plan_id}`}>
              <Button className="gradient-bg text-primary-foreground">
                <Plus className="w-4 h-4 ml-2" /> مشروع جديد
              </Button>
            </Link>
          )}
        </motion.div>

        {/* Active Subscriptions */}
        {subscriptions.length > 0 && (
          <div className="mb-8 space-y-3">
            {subscriptions.map(sub => (
              <div key={sub.id} className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="font-semibold">{sub.plans?.name}</span>
                  {sub.is_free_trial && <Badge className="mr-2 bg-success/20 text-success">تجريبية</Badge>}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  تنتهي: {format(new Date(sub.expires_at), 'dd MMM yyyy', { locale: ar })}
                </div>
              </div>
            ))}
          </div>
        )}

        {subscriptions.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-12 text-center mb-8">
            <p className="text-muted-foreground mb-4">ليس لديك اشتراك فعال</p>
            <Link to="/plans">
              <Button className="gradient-bg text-primary-foreground">تصفح الباقات</Button>
            </Link>
          </motion.div>
        )}

        {/* Projects Grid */}
        {projects.length === 0 && subscriptions.length > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-12 text-center">
            <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">لا توجد مشاريع بعد</p>
            <Link to={`/dashboard/new-project?plan=${subscriptions[0].plan_id}`}>
              <Button className="gradient-bg text-primary-foreground">
                <Plus className="w-4 h-4 ml-2" /> أنشئ أول مشروع
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="glass rounded-xl p-5 cursor-pointer"
                onClick={() => navigate(`/dashboard/project/${project.id}`)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold truncate">{project.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${statusColors[project.status]}`} />
                    <span className="text-xs text-muted-foreground">{statusLabels[project.status]}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">{project.language}</Badge>
                  <span>{format(new Date(project.created_at), 'dd/MM/yyyy')}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
