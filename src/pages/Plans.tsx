import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  storage_mb: number;
  ram_mb: number;
  cpu_cores: number;
  is_free: boolean;
  features: string[];
  sort_order: number;
}

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    const { data } = await supabase.from('plans').select('*').order('sort_order');
    if (data) setPlans(data.map(p => ({ ...p, features: (p.features as any) || [] })));
    setLoading(false);
  };

  const handleSelectPlan = async (plan: Plan) => {
    if (!user) { navigate('/register'); return; }

    if (plan.is_free) {
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_free_trial', true)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error(t('plans.alreadyUsedFree'));
        return;
      }

      const { error } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        plan_id: plan.id,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_free_trial: true,
      });

      if (error) {
        toast.error(t('plans.error'));
      } else {
        toast.success(t('plans.freeActivated'));
        navigate('/dashboard/new-project');
      }
    } else {
      navigate('/checkout?plan=' + plan.id);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center pt-16"><div className="w-8 h-8 border-2 border-[#002b86] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-10 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3 sm:mb-4 text-white">
            <span className="gradient-text">{t('plans.title')}</span>
          </h1>
          <p className="text-[#71717a] text-sm sm:text-lg">{t('plans.subtitle')}</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-6xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`glass-card rounded-2xl p-5 sm:p-6 relative ${i === 2 ? 'ring-1 ring-[#002b86]/50 shadow-[0_0_30px_-5px_rgba(0,43,134,0.3)]' : ''}`}
            >
              {i === 2 && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#002b86] text-white">
                  <Star className="w-3 h-3 ml-1" /> {t('plans.mostPopular')}
                </Badge>
              )}
              {plan.is_free && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white">
                  {t('plans.free')}
                </Badge>
              )}

              <h3 className="text-lg sm:text-xl font-bold mb-2 text-white">{plan.name}</h3>
              <p className="text-[#71717a] text-xs sm:text-sm mb-4">{plan.description}</p>

              <div className="mb-5 sm:mb-6">
                <span className="text-2xl sm:text-3xl font-black gradient-text">
                  {plan.price === 0 ? t('plans.free') : `$${plan.price}`}
                </span>
                {plan.price > 0 && <span className="text-[#71717a] text-xs sm:text-sm">{t('plans.perMonth')}</span>}
              </div>

              <div className="space-y-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-[#71717a]">
                  <HardDrive className="w-4 h-4 text-[#002b86]" />
                  {plan.storage_mb >= 1024 ? `${(plan.storage_mb / 1024).toFixed(0)} GB` : `${plan.storage_mb} MB`}
                </div>
                <div className="flex items-center gap-2 text-[#71717a]">
                  <MemoryStick className="w-4 h-4 text-[#002b86]" />
                  {plan.ram_mb >= 1024 ? `${(plan.ram_mb / 1024).toFixed(0)} GB` : `${plan.ram_mb} MB`} {t('plans.ram')}
                </div>
                <div className="flex items-center gap-2 text-[#71717a]">
                  <Cpu className="w-4 h-4 text-[#002b86]" />
                  {plan.cpu_cores} {t('plans.core')}
                </div>
              </div>

              <div className="space-y-2 mb-5 sm:mb-6">
                {plan.features.map((f, fi) => (
                  <div key={fi} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-[#71717a]">{f}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => handleSelectPlan(plan)}
                className={`w-full transition-all ${i === 2 ? 'bg-[#002b86] hover:bg-[#0035a0] text-white shadow-[0_0_30px_-5px_rgba(0,43,134,0.3)]' : 'border-white/8 hover:bg-white/5 text-zinc-300'}`}
                variant={i === 2 ? 'default' : 'outline'}
              >
                {plan.is_free ? t('plans.startFree') : t('plans.subscribe')}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
