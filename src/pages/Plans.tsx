import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { toast } from 'sonner';

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
  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadPlans();
    loadSettings();
  }, []);

  const loadPlans = async () => {
    const { data } = await supabase.from('plans').select('*').order('sort_order');
    if (data) setPlans(data.map(p => ({ ...p, features: (p.features as any) || [] })));
    setLoading(false);
  };

  const loadSettings = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'payment_enabled').maybeSingle();
    if (data) setPaymentEnabled(data.value === true || data.value === 'true');
  };

  const handleSelectPlan = async (plan: Plan) => {
    if (!user) { navigate('/register'); return; }

    if (plan.is_free) {
      // Check if already used free trial
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_free_trial', true)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error('لقد استخدمت الباقة المجانية من قبل');
        return;
      }

      // Create free subscription
      const { error } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        plan_id: plan.id,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_free_trial: true,
      });

      if (error) {
        toast.error('حدث خطأ');
      } else {
        toast.success('تم تفعيل الباقة المجانية لمدة شهر!');
        navigate('/dashboard/new-project?plan=' + plan.id);
      }
    } else {
      if (!paymentEnabled) {
        // Payment disabled - give free access
        const { error } = await supabase.from('subscriptions').insert({
          user_id: user.id,
          plan_id: plan.id,
          status: 'active',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_free_trial: false,
        });
        if (error) {
          toast.error('حدث خطأ');
        } else {
          toast.success('تم تفعيل الباقة! (الدفع معطل حالياً)');
          navigate('/dashboard/new-project?plan=' + plan.id);
        }
      } else {
        navigate('/checkout?plan=' + plan.id);
      }
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen pt-24 pb-16 px-4" dir="rtl">
      <div className="container mx-auto">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            <span className="gradient-text">اختر باقتك</span>
          </h1>
          <p className="text-muted-foreground text-lg">باقات تناسب جميع احتياجاتك</p>
          {!paymentEnabled && (
            <Badge className="mt-4 gradient-bg text-primary-foreground">🎉 الدفع معطل حالياً - جميع الباقات مجانية!</Badge>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`glass rounded-2xl p-6 relative ${i === 2 ? 'glow-primary ring-1 ring-primary/30' : ''}`}
            >
              {i === 2 && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-bg text-primary-foreground">
                  <Star className="w-3 h-3 ml-1" /> الأكثر طلباً
                </Badge>
              )}
              {plan.is_free && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-success text-primary-foreground">
                  مجاني
                </Badge>
              )}

              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>

              <div className="mb-6">
                <span className="text-3xl font-black gradient-text">
                  {plan.price === 0 ? 'مجاناً' : `$${plan.price}`}
                </span>
                {plan.price > 0 && <span className="text-muted-foreground text-sm">/شهرياً</span>}
              </div>

              <div className="space-y-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="w-4 h-4 text-primary" />
                  {plan.storage_mb >= 1024 ? `${(plan.storage_mb / 1024).toFixed(0)} GB` : `${plan.storage_mb} MB`}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MemoryStick className="w-4 h-4 text-primary" />
                  {plan.ram_mb >= 1024 ? `${(plan.ram_mb / 1024).toFixed(0)} GB` : `${plan.ram_mb} MB`} رام
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Cpu className="w-4 h-4 text-primary" />
                  {plan.cpu_cores} نواة
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {plan.features.map((f, fi) => (
                  <div key={fi} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => handleSelectPlan(plan)}
                className={`w-full ${i === 2 ? 'gradient-bg text-primary-foreground glow-primary' : ''}`}
                variant={i === 2 ? 'default' : 'outline'}
              >
                {plan.is_free ? 'ابدأ مجاناً' : 'اشترك الآن'}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
