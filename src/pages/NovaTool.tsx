import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Download,
  Lock,
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  Zap,
  Star,
  Eye,
  CreditCard,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const PROXY = import.meta.env.VITE_PROXY_URL || 'https://nova-deploy-proxy-production.up.railway.app';
const TOOL_IMAGE = '/NOVA_TOOL.png';
const TOOL_FILE = '/NOVA_TOOL.zip';
const TOOL_PRICE = 0.99;
const TOOL_PRODUCT_ID = 'nova-tool-pro';

export default function NovaTool() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'idle' | 'processing' | 'redirecting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_type: string; discount_value: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  useEffect(() => {
    checkPurchase();
  }, [user]);

  useEffect(() => {
    // Check if redirected back from payment success
    if (searchParams.get('purchased') === 'true' && user) {
      markAsPurchased();
    }
  }, [searchParams, user]);

  const getAuthHeaders = async () => {
    const session = await supabase.auth.getSession();
    return { 'Authorization': `Bearer ${session.data.session?.access_token || ''}` };
  };

  const checkPurchase = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${PROXY}/tool/purchase/${TOOL_PRODUCT_ID}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPurchased(data.purchased === true);
      }
    } catch {
      // Fallback: try direct Supabase
      try {
        const { data } = await supabase
          .from('tool_purchases')
          .select('id')
          .eq('user_id', user.id)
          .eq('product_id', TOOL_PRODUCT_ID)
          .maybeSingle();
        setPurchased(!!data);
      } catch {
        setPurchased(false);
      }
    }
    setLoading(false);
  };

  const markAsPurchased = async () => {
    if (!user) return;
    try {
      const headers = await getAuthHeaders();
      await fetch(`${PROXY}/tool/purchase/${TOOL_PRODUCT_ID}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: TOOL_PRICE }),
      });
      setPurchased(true);
      toast.success(t('novaTool.purchaseSuccess'));
    } catch {
      toast.error(t('novaTool.verifyError'));
    }
  };

  const getFinalPrice = () => {
    if (!appliedCoupon) return TOOL_PRICE;
    if (appliedCoupon.discount_type === 'percentage') {
      return Math.max(0, TOOL_PRICE - (TOOL_PRICE * appliedCoupon.discount_value / 100));
    }
    return Math.max(0, TOOL_PRICE - appliedCoupon.discount_value);
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
      toast.error(t('checkout.invalidCoupon'));
      setCouponLoading(false);
      return;
    }
    if (data.max_uses && data.current_uses >= data.max_uses) {
      toast.error(t('checkout.couponUsedUp'));
      setCouponLoading(false);
      return;
    }
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      toast.error(t('checkout.couponExpired'));
      setCouponLoading(false);
      return;
    }
    setAppliedCoupon({ code: data.code, discount_type: data.discount_type, discount_value: data.discount_value });
    toast.success(`${t('checkout.couponApplied')}: ${data.discount_type === 'percentage' ? `${data.discount_value}%` : `$${data.discount_value}`}`);
    setCouponLoading(false);
  };

  const handlePurchase = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const finalPrice = getFinalPrice();

    // If price is 0 after coupon
    if (finalPrice <= 0) {
      setPurchasing(true);
      try {
        const headers = await getAuthHeaders();
        await fetch(`${PROXY}/tool/purchase/${TOOL_PRODUCT_ID}`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 0 }),
        });
        setPurchased(true);
        toast.success(t('novaTool.purchaseSuccess'));
      } catch {
        toast.error(t('novaTool.purchaseError'));
      }
      setPurchasing(false);
      return;
    }

    // Redirect to payment
    setPaymentStep('processing');
    try {
      const siteUrl = window.location.origin;
      const headers = await getAuthHeaders();
      const res = await fetch(`${PROXY}/payment`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalPrice,
          currency: 'USD',
          description: `Nova VPS - NOVA TOOL${appliedCoupon ? ` (${appliedCoupon.code})` : ''}`,
          success_url: `${siteUrl}/tools/nova-tool?purchased=true`,
          cancel_url: `${siteUrl}/tools/nova-tool`,
          metadata: { productId: TOOL_PRODUCT_ID, userId: user.id, coupon: appliedCoupon?.code },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('checkout.paymentError'));

      const paymentUrl = data.url || data.payment_url || data.checkout_url;
      if (!paymentUrl) throw new Error(t('checkout.paymentError'));

      setPaymentStep('redirecting');
      setTimeout(() => {
        window.location.href = paymentUrl;
      }, 800);
    } catch (err: any) {
      setPaymentStep('error');
      setErrorMsg(err.message || t('checkout.paymentError'));
      toast.error(err.message || t('checkout.paymentError'));
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = TOOL_FILE;
    link.download = 'NOVA_TOOL.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t('novaTool.downloadStarted'));
  };

  const finalPrice = getFinalPrice();

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-4" dir="rtl">
      <div className="container mx-auto max-w-4xl">

        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <Button
            variant="ghost"
            onClick={() => navigate('/tools')}
            className="text-muted-foreground hover:text-foreground gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('novaTool.backToTools')}
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Left: Image & Description */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3 space-y-6"
          >
            {/* Tool Image */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="relative group">
                <img
                  src={TOOL_IMAGE}
                  alt="NOVA TOOL"
                  className="w-full h-auto object-contain"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </div>

            {/* Description */}
            <div className="glass rounded-2xl p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold">{t('novaTool.featuresTitle')}</h2>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { icon: Zap, title: t('novaTool.feature1Title'), desc: t('novaTool.feature1Desc') },
                  { icon: Shield, title: t('novaTool.feature2Title'), desc: t('novaTool.feature2Desc') },
                  { icon: Star, title: t('novaTool.feature3Title'), desc: t('novaTool.feature3Desc') },
                  { icon: Eye, title: t('novaTool.feature4Title'), desc: t('novaTool.feature4Desc') },
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex gap-3 p-3 rounded-xl hover:bg-secondary/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <feature.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{feature.title}</h4>
                      <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{feature.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right: Purchase Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2"
          >
            <div className="glass rounded-2xl p-6 sm:p-8 sticky top-24">
              <h2 className="text-2xl sm:text-3xl font-black gradient-text mb-2">NOVA TOOL</h2>
              <p className="text-muted-foreground text-sm mb-6">{t('novaTool.subtitle')}</p>

              {/* Price */}
              <div className="glass rounded-xl p-4 mb-6">
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl sm:text-4xl font-black gradient-text">${finalPrice.toFixed(2)}</span>
                  <span className="text-muted-foreground text-sm">{t('novaTool.oneTime')}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>{t('checkout.couponApplied')}: {appliedCoupon.code}</span>
                    <button onClick={() => setAppliedCoupon(null)} className="mr-auto text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {!appliedCoupon && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('checkout.couponPlaceholder')}
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      dir="ltr"
                      className="flex-1 bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                    >
                      {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('checkout.apply')}
                    </Button>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : purchased ? (
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                  <Button
                    onClick={handleDownload}
                    className="w-full gradient-bg text-primary-foreground text-lg py-6 gap-2 glow-primary"
                  >
                    <Download className="w-5 h-5" />
                    {t('novaTool.downloadNow')}
                  </Button>
                  <div className="flex items-center justify-center gap-2 mt-3 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    {t('novaTool.purchased')}
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  <Button
                    onClick={handlePurchase}
                    disabled={purchasing || paymentStep === 'processing' || paymentStep === 'redirecting'}
                    className="w-full gradient-bg text-primary-foreground text-lg py-6 gap-2"
                  >
                    {purchasing || paymentStep === 'processing' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('checkout.processing')}
                      </>
                    ) : paymentStep === 'redirecting' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('checkout.redirecting')}
                      </>
                    ) : paymentStep === 'error' ? (
                      <>
                        <AlertCircle className="w-5 h-5" />
                        {t('checkout.retry')}
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        {t('novaTool.buyNow')} - ${finalPrice.toFixed(2)}
                      </>
                    )}
                  </Button>

                  {!user && (
                    <p className="text-center text-xs text-muted-foreground">
                      {t('novaTool.loginRequired')}
                    </p>
                  )}
                </div>
              )}

              {/* Error */}
              {paymentStep === 'error' && errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                >
                  {errorMsg}
                </motion.div>
              )}

              {/* Trust badges */}
              <div className="mt-6 pt-5 border-t border-border/30">
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    {t('novaTool.securePayment')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    {t('novaTool.instantDelivery')}
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {t('novaTool.moneyBack')}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
