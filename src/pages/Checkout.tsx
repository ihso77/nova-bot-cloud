import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CreditCard, Lock } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
}

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!planId) { navigate('/plans'); return; }
    if (!user) { navigate('/login'); return; }
    loadPlan();
  }, [planId, user]);

  const loadPlan = async () => {
    const { data } = await supabase.from('plans').select('*').eq('id', planId!).single();
    if (data) setPlan(data);
  };

  const handlePayment = async () => {
    if (!plan || !user) return;
    setLoading(true);

    try {
      // Call edge function for Paymento payment
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { planId: plan.id, amount: plan.price, userId: user.id },
      });

      if (error) throw error;

      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        // If no payment URL, create subscription directly (for testing)
        const { error: subError } = await supabase.from('subscriptions').insert({
          user_id: user.id,
          plan_id: plan.id,
          status: 'active',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (subError) throw subError;
        toast.success('تم الاشتراك بنجاح!');
        navigate('/dashboard/new-project?plan=' + plan.id);
      }
    } catch (err: any) {
      toast.error('حدث خطأ في الدفع: ' + (err.message || 'حاول مرة أخرى'));
    }
    setLoading(false);
  };

  if (!plan) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center" dir="rtl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md glass rounded-2xl p-8"
      >
        <div className="text-center mb-8">
          <CreditCard className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold gradient-text">إتمام الدفع</h1>
        </div>

        <div className="glass rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">الباقة</span>
            <span>{plan.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold">السعر</span>
            <span className="text-2xl font-black gradient-text">${plan.price}/شهر</span>
          </div>
        </div>

        <Button
          onClick={handlePayment}
          disabled={loading}
          className="w-full gradient-bg text-primary-foreground text-lg py-6"
        >
          {loading ? 'جاري المعالجة...' : 'ادفع الآن'}
          <Lock className="w-4 h-4 mr-2" />
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" /> دفع آمن عبر Paymento
        </p>
      </motion.div>
    </div>
  );
}
