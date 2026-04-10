import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'active' | 'pending' | 'error'>('loading');

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    // Wait a moment for webhook to process
    await new Promise(r => setTimeout(r, 3000));

    const userId = searchParams.get('user');
    const planId = searchParams.get('plan');

    if (userId && planId) {
      // Check if subscription was created by the webhook
      const { data } = await supabase
        .from('subscriptions')
        .select('id, status')
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('status', 'active')
        .limit(1);

      if (data && data.length > 0) {
        setStatus('active');
        return;
      }
    }

    // Payment might still be processing
    setStatus('pending');
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center" dir="rtl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md glass rounded-2xl p-8 text-center"
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
            <CheckCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">الدفع قيد المعالجة</h1>
            <p className="text-muted-foreground mb-2">تم استلام طلب الدفع بنجاح.</p>
            <p className="text-muted-foreground mb-6 text-sm">
              قد يستغرق تفعيل الاشتراك بضع دقائق. اذهب للوحة التحكم وتحقق لاحقاً.
            </p>
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
