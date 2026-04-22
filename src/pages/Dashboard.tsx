import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderOpen, Clock, Play, Square, HardDrive } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

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
  plans: { name: string; price: number; storage_mb: number } | null;
}

interface ProjectStorage {
  [projectId: string]: number; // bytes
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectStorage, setProjectStorage] = useState<ProjectStorage>({});

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    const [projRes, subRes] = await Promise.all([
      supabase.from('projects').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*, plans(name, price, storage_mb)').eq('user_id', user!.id).eq('status', 'active'),
    ]);
    if (projRes.data) {
      setProjects(projRes.data);
      // Load storage for each project
      const storageMap: ProjectStorage = {};
      for (const p of projRes.data) {
        const { data: files } = await supabase.from('project_files').select('content').eq('project_id', p.id);
        if (files) {
          storageMap[p.id] = files.reduce((sum, f) => sum + new Blob([f.content || '']).size, 0);
        }
      }
      setProjectStorage(storageMap);
    }
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
    running: t('dashboard.running'),
    stopped: t('dashboard.stopped'),
    deploying: t('dashboard.deploying'),
    error: t('dashboard.error'),
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center pt-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">{t('dashboard.title')}</h1>
          {subscriptions.length > 0 && (
              <Button onClick={() => navigate('/dashboard/new-project')} className="bg-[#002b86] hover:bg-[#0035a0] text-white w-full sm:w-auto justify-center">
                <Plus className="w-4 h-4 ml-2" /> {t('dashboard.newProject')}
              </Button>
          )}
        </motion.div>

        {/* Active Subscriptions - show best plan storage */}
        {subscriptions.length > 0 && (() => {
          // Pick the best subscription (highest price = highest tier)
          const sorted = [...subscriptions].sort((a, b) => (b.plans?.price || 0) - (a.plans?.price || 0));
          const bestSub = sorted[0];
          const storageLimit = bestSub.plans?.storage_mb || 512;
          const storageLimitBytes = storageLimit * 1024 * 1024;
          const totalStorage = Object.values(projectStorage).reduce((a, b) => a + b, 0);
          const storagePct = Math.min(100, (totalStorage / storageLimitBytes) * 100);
          const isNearLimit = storagePct > 85;
          return (
            <div className="mb-8 space-y-3">
              {subscriptions.map(sub => (
                <div key={sub.id} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{sub.plans?.name}</span>
                    {sub.is_free_trial && <Badge className="bg-success/20 text-success">{t('dashboard.trial')}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#71717a]">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>{t('dashboard.expires')} {format(new Date(sub.expires_at), 'dd MMM yyyy', { locale: ar })}</span>
                  </div>
                </div>
              ))}
              {/* Storage bar using BEST plan limits */}
              <div className="glass-card rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t('dashboard.storageUsed')} ({bestSub.plans?.name})</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <HardDrive className={`w-3.5 h-3.5 ${isNearLimit ? 'text-yellow-400' : 'text-[#002b86]'}`} />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1 text-[#71717a]">
                      <span>{t('dashboard.storageUsed')}</span>
                      <span className={isNearLimit ? 'text-yellow-400 font-medium' : ''}>{formatBytes(totalStorage)} / {formatBytes(storageLimitBytes)}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isNearLimit ? 'bg-yellow-500' : 'bg-[#002b86]'}`}
                        style={{ width: `${storagePct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {subscriptions.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl p-8 sm:p-12 text-center mb-6 sm:mb-8">
            <p className="text-[#71717a] mb-4">{t('dashboard.noSubscription')}</p>
            <Button onClick={() => navigate('/plans')} className="bg-[#002b86] hover:bg-[#0035a0] text-white">{t('index.browsePlans')}</Button>
          </motion.div>
        )}

        {/* Projects Grid */}
        {projects.length === 0 && subscriptions.length > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl p-12 text-center">
            <FolderOpen className="w-16 h-16 text-[#71717a] mx-auto mb-4" />
            <p className="text-[#71717a] mb-4">{t('dashboard.noProjects')}</p>
            <Button onClick={() => navigate('/dashboard/new-project')} className="bg-[#002b86] hover:bg-[#0035a0] text-white">
              <Plus className="w-4 h-4 ml-2" /> {t('dashboard.createFirst')}
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="glass-card rounded-xl p-5 cursor-pointer"
                onClick={() => navigate(`/dashboard/project/${project.id}`)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold truncate">{project.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${statusColors[project.status]}`} />
                    <span className="text-xs text-[#71717a]">{statusLabels[project.status]}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-[#71717a]">
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
