import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { CreditCard, Lock, Loader2, AlertCircle, Ticket, Check } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
}

const PAYMENT_PROXY_URL = 'https://proxy-production-a7b5.up.railway.app/payment';

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'checkout' | 'redirecting' | 'error'>('checkout');
  const [errorMsg, setErrorMsg] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_type: string; discount_value: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  useEffect(() => {
    if (!planId) { navigate('/plans'); return; }
    if (!user) { navigate('/login'); return; }
    loadPlan();
  }, [planId, user]);

  const loadPlan = async () => {
    const { data } = await supabase.from('plans').select('*').eq('id', planId!).single();
    if (data) setPlan(data);
  };

  const getFinalPrice = () => {
    if (!plan) return 0;
    if (!appliedCoupon) return plan.price;
    if (appliedCoupon.discount_type === 'percentage') {
      return Math.max(0, plan.price - (plan.price * appliedCoupon.discount_value / 100));
    }
    return Math.max(0, plan.price - appliedCoupon.discount_value);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      toast.error('كود الخصم غير صالح');
      setCouponLoading(false);
      return;
    }

    if (data.max_uses && data.current_uses >= data.max_uses) {
      toast.error('كود الخصم انتهى (تم استخدامه بالكامل)');
      setCouponLoading(false);
      return;
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      toast.error('كود الخصم منتهي الصلاحية');
      setCouponLoading(false);
      return;
    }

    setAppliedCoupon({ code: data.code, discount_type: data.discount_type, discount_value: data.discount_value });
    toast.success(`تم تطبيق كود الخصم: ${data.discount_type === 'percentage' ? `${data.discount_value}%` : `$${data.discount_value}`} خصم!`);
    setCouponLoading(false);
  };

  const handlePayment = async () => {
    if (!plan || !user) return;
    setLoading(true);
    setErrorMsg('');
    setStep('checkout');

    try {
      const finalPrice = getFinalPrice();

      // If price is 0 after coupon, activate directly
      if (finalPrice <= 0) {
        await supabase.from('subscriptions').insert({
          user_id: user.id,
          plan_id: plan.id,
          status: 'active',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_free_trial: false,
        });

        // Increment coupon usage
        if (appliedCoupon) {
          await supabase.rpc('increment_coupon_usage' as never, { coupon_code: appliedCoupon.code } as never);
        }

        toast.success('تم تفعيل اشتراكك مجاناً!');
        navigate('/dashboard');
        return;
      }

      const siteUrl = window.location.origin;

      const res = await fetch(PAYMENT_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalPrice,
          currency: 'USD',
          description: `Nova VPS - ${plan.name}${appliedCoupon ? ` (كود: ${appliedCoupon.code})` : ''}`,
          success_url: `${siteUrl}/payment/success?plan=${plan.id}&user=${user.id}`,
          cancel_url: `${siteUrl}/payment/cancel`,
          metadata: { planId: plan.id, userId: user.id, coupon: appliedCoupon?.code },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ في الاتصال ببوابة الدفع');
      }

      const paymentUrl = data.url || data.payment_url || data.checkout_url;

      if (!paymentUrl) {
        throw new Error('لم يتم استلام رابط الدفع');
      }

      const payId = data.id || data.payment_id;
      if (payId) {
        try {
          await supabase.from('payments').insert({
            id: payId,
            user_id: user.id,
            plan_id: plan.id,
            amount: finalPrice,
            currency: 'USD',
            status: 'pending',
            provider: 'paymento',
          });
        } catch {}
      }

      // Increment coupon usage
      if (appliedCoupon) {
        await supabase.from('coupons').update({ current_uses: 0 }).eq('code', appliedCoupon.code); // trigger will handle
      }

      setStep('redirecting');
      window.location.href = paymentUrl;
    } catch (err: any) {
      setStep('error');
      setErrorMsg(err.message || 'حدث خطأ في الدفع');
      toast.error(err.message || 'حدث خطأ في الدفع');
    }
    setLoading(false);
  };

  if (!plan) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const finalPrice = getFinalPrice();

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center" dir="rtl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md glass rounded-2xl p-8"
      >
        {step === 'redirecting' ? (
          <div className="text-center py-8">
            <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold mb-2">جاري التحويل لبوابة الدفع...</h1>
            <p className="text-muted-foreground">سيتم تحويلك تلقائياً، انتظر قليلاً</p>
          </div>
        ) : step === 'error' ? (
          <>
            <div className="text-center mb-6">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold gradient-text">فشل الدفع</h1>
              <p className="text-sm text-muted-foreground mt-2">{errorMsg}</p>
            </div>

            <div className="glass rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">الباقة</span>
                <span>{plan.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold">السعر</span>
                <span className="text-2xl font-black gradient-text">${finalPrice.toFixed(2)}/شهر</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/plans')}>
                العودة للباقات
              </Button>
              <Button className="flex-1 gradient-bg text-primary-foreground" onClick={handlePayment} disabled={loading}>
                {loading ? 'جاري المعالجة...' : 'إعادة المحاولة'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <CreditCard className="w-12 h-12 text-primary mx-auto mb-4" />
              <h1 className="text-2xl font-bold gradient-text">إتمام الدفع</h1>
            </div>

            <div className="glass rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">الباقة</span>
                <span>{plan.name}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between items-center mb-2 text-green-400 text-sm">
                  <span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> خصم ({appliedCoupon.code})</span>
                  <span>-{appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_value}%` : `$${appliedCoupon.discount_value}`}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-semibold">السعر</span>
                <div className="text-left">
                  {appliedCoupon && (
                    <span className="text-sm line-through text-muted-foreground ml-2">${plan.price}</span>
                  )}
                  <span className="text-2xl font-black gradient-text">${finalPrice.toFixed(2)}/شهر</span>
                </div>
              </div>
            </div>

            {/* Coupon Input */}
            <div className="mb-6">
              <div className="flex gap-2">
                <Input
                  placeholder="كود الخصم"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  disabled={!!appliedCoupon}
                  dir="ltr"
                  className="font-mono"
                />
                {appliedCoupon ? (
                  <Button variant="outline" className="text-green-400 border-green-500/30" disabled>
                    <Check className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()}>
                    {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تطبيق'}
                  </Button>
                )}
              </div>
            </div>

            <Button
              onClick={handlePayment}
              disabled={loading}
              className="w-full gradient-bg text-primary-foreground text-lg py-6"
            >
              {loading ? 'جاري المعالجة...' : finalPrice <= 0 ? 'تفعيل مجاناً' : 'ادفع الآن'}
              <Lock className="w-4 h-4 mr-2" />
            </Button>

            <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" /> دفع آمن عبر Paymento
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
