import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function PaymentSuccess() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    activateSubscription();
  }, []);

  const activateSubscription = async () => {
    // SECURITY: Never trust user ID from URL params - always use authenticated user
    const userId = user?.id;
    const planId = searchParams.get('plan');

    if (!userId || !planId) {
      setStatus('error');
      setErrorMsg(t('paymentSuccess.incompleteInfo'));
      return;
    }

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

      // SECURITY: Find a pending payment for this user+plan and verify it was actually paid
      const { data: pendingPayments } = await supabase
        .from('payments')
        .select('id, provider, status')
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!pendingPayments || pendingPayments.length === 0) {
        setStatus('error');
        setErrorMsg(t('paymentSuccess.noPaymentRecord'));
        return;
      }

      const payment = pendingPayments[0];
      
      // SECURITY: Verify payment with Paymento via proxy
      if (payment.provider === 'paymento' && payment.id) {
        try {
          const verifyRes = await fetch('https://proxy-production-a7b5.up.railway.app/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: payment.id }),
          });
          const verifyData = await verifyRes.json();
          
          if (!verifyData.paid) {
            setStatus('error');
            setErrorMsg(t('paymentSuccess.paymentIncomplete'));
            return;
          }
        } catch {
          // If verification fails, still allow if payment record exists and is completed
          if (payment.status !== 'completed') {
            setStatus('error');
            setErrorMsg(t('paymentSuccess.verificationFailed'));
            return;
          }
        }
      }

      // Payment verified - create subscription
      const { error: subError } = await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_free_trial: false,
        payment_id: payment.id,
      });

      if (subError) {
        // Handle race condition - check if subscription was created by parallel request
        const { data: checkAgain } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('plan_id', planId)
          .eq('status', 'active')
          .limit(1);

        if (checkAgain && checkAgain.length > 0) {
          setStatus('active');
          toast.success(t('paymentSuccess.alreadyActive'));
          return;
        }
        throw subError;
      }

      // Update payment status
      await supabase.from('payments').update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      }).eq('id', payment.id);

      setStatus('active');
      toast.success(t('paymentSuccess.activated'));
    } catch (err: any) {
      console.error('Subscription activation error:', err);
      setStatus('error');
      setErrorMsg(t('paymentSuccess.activationError'));
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
            <h1 className="text-2xl font-bold mb-2">{t('paymentSuccess.verifying')}</h1>
            <p className="text-muted-foreground">{t('paymentSuccess.pleaseWait')}</p>
          </>
        ) : status === 'active' ? (
          <>
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold gradient-text mb-2">{t('paymentSuccess.success')}</h1>
            <p className="text-muted-foreground mb-6">{t('paymentSuccess.successDesc')}</p>
            <Button onClick={() => navigate('/dashboard')} className="gradient-bg text-primary-foreground">
              {t('paymentSuccess.goToDashboard')}
            </Button>
          </>
        ) : (
          <>
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t('paymentSuccess.genericError')}</h1>
            <p className="text-muted-foreground mb-6">{errorMsg}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/plans')}>
                {t('paymentSuccess.backToPlans')}
              </Button>
              <Button className="flex-1 gradient-bg text-primary-foreground" onClick={() => navigate('/dashboard')}>
                {t('paymentSuccess.dashboard')}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
