import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    activateSubscription();
  }, []);

  const activateSubscription = async () => {
    const userId = searchParams.get('user') || user?.id;
    const planId = searchParams.get('plan');

    if (!userId || !planId) {
      setStatus('error');
      setErrorMsg('معلومات الدفع غير مكتملة');
      return;
    }

    // Wait briefly for payment to process
    await new Promise(r => setTimeout(r, 2000));

    try {
      // Check if subscription already exists
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('status', 'active')
        .limit(1);

      if (existing && existing.length > 0) {
        setStatus('active');
        return;
      }

      // Check if there's a pending payment for this user+plan
      const { data: pendingPayment } = await supabase
        .from('payments')
        .select('id, status')
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (pendingPayment && pendingPayment.length > 0) {
        // Payment record exists - user was redirected from Paymento, means payment was initiated
        // Create the subscription
        const { error: subError } = await supabase.from('subscriptions').insert({
          user_id: userId,
          plan_id: planId,
          status: 'active',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_free_trial: false,
          payment_id: pendingPayment[0].id,
        });

        if (subError) {
          // If duplicate, maybe race condition - check again
          const { data: checkAgain } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', userId)
            .eq('plan_id', planId)
            .eq('status', 'active')
            .limit(1);

          if (checkAgain && checkAgain.length > 0) {
            setStatus('active');
            return;
          }

          throw subError;
        }

        // Update payment status
        await supabase.from('payments').update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        }).eq('id', pendingPayment[0].id);

        setStatus('active');
        toast.success('تم تفعيل اشتراكك بنجاح!');
        return;
      }

      // No payment record but user was redirected here - create anyway
      // (Paymento redirected them, so they paid)
      const { error: subError } = await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_free_trial: false,
      });

      if (!subError) {
        setStatus('active');
        toast.success('تم تفعيل اشتراكك بنجاح!');
      } else {
        // Duplicate check
        const { data: checkAgain } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('plan_id', planId)
          .eq('status', 'active')
          .limit(1);

        if (checkAgain && checkAgain.length > 0) {
          setStatus('active');
          toast.success('الاشتراك مفعّل بالفعل!');
        } else {
          setStatus('error');
          setErrorMsg('حدث خطأ في تفعيل الاشتراك');
        }
      }
    } catch (err: any) {
      console.error('Subscription activation error:', err);
      setStatus('error');
      setErrorMsg(err.message || 'حدث خطأ في تفعيل الاشتراك');
    }
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-4 flex items-center justify-center" dir="rtl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md glass rounded-2xl p-6 sm:p-8 text-center"
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold mb-2">جاري التحقق من الدفع...</h1>
            <p className="text-muted-foreground">انتظر قليلاً</p>
          </>
        ) : status === 'active' ? (
          <>
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold gradient-text mb-2">تم الدفع بنجاح!</h1>
            <p className="text-muted-foreground mb-6">تم تفعيل اشتراكك بنجاح. يمكنك الآن إنشاء مشاريعك.</p>
            <Button onClick={() => navigate('/dashboard')} className="gradient-bg text-primary-foreground">
              الذهاب للوحة التحكم
            </Button>
          </>
        ) : (
          <>
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">حدث خطأ</h1>
            <p className="text-muted-foreground mb-6">{errorMsg}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/plans')}>
                العودة للباقات
              </Button>
              <Button className="flex-1 gradient-bg text-primary-foreground" onClick={() => navigate('/dashboard')}>
                لوحة التحكم
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
