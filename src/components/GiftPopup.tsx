import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Gift, Sparkles, Crown, Zap, Check, Star } from 'lucide-react';

interface PendingGift {
  id: string;
  from_name: string;
  plan_name: string;
  message: string | null;
  created_at: string;
}

// Try to read from gifts table, fallback to localStorage
async function fetchPendingGifts(email: string): Promise<PendingGift[]> {
  try {
    const { data, error } = await supabase
      .from('gifts')
      .select('*')
      .eq('to_email', email)
      .eq('claimed', false)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!error && data && data.length > 0) return data as PendingGift[];
  } catch {}
  // Fallback: check localStorage
  try {
    const stored = localStorage.getItem('nova_pending_gifts');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.filter((g: any) => g.to_email === email && !g.claimed);
    }
  } catch {}
  return [];
}

async function claimGift(giftId: string, planName: string, userId: string): Promise<boolean> {
  try {
    const { data: planData } = await supabase.from('plans').select('id').eq('name', planName).maybeSingle();
    if (planData) {
      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_id: planData.id,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_free_trial: false,
      });
    }
    await supabase.from('gifts').update({ claimed: true }).eq('id', giftId);
    return true;
  } catch {
    // Fallback: mark in localStorage
    try {
      const stored = localStorage.getItem('nova_pending_gifts');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.forEach((g: any) => { if (g.id === giftId) g.claimed = true; });
        localStorage.setItem('nova_pending_gifts', JSON.stringify(parsed));
      }
    } catch {}
    return true;
  }
}

async function saveGiftLocal(gift: any) {
  try {
    const stored = localStorage.getItem('nova_pending_gifts');
    const parsed = stored ? JSON.parse(stored) : [];
    parsed.push(gift);
    localStorage.setItem('nova_pending_gifts', JSON.stringify(parsed));
  } catch {}
}

export { fetchPendingGifts, claimGift, saveGiftLocal };
export type { PendingGift };

export default function GiftPopup() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [gift, setGift] = useState<PendingGift | null>(null);
  const [show, setShow] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const gifts = await fetchPendingGifts(user!.email!);
      if (gifts.length > 0) {
        setGift(gifts[0]);
        setTimeout(() => setShow(true), 800);
      }
    };
    check();
  }, [user]);

  const handleClaim = async () => {
    if (!gift || !user) return;
    setClaiming(true);
    await claimGift(gift.id, gift.plan_name, user.id);
    setClaiming(false);
    setClaimed(true);
    toast.success(t('gift.giftReceived'));
    setTimeout(() => setShow(false), 4000);
  };

  return (
    <AnimatePresence>
      {show && gift && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md"
          onClick={() => !claimed && setShow(false)}
        >
          {!claimed ? (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotateY: -180 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              transition={{ type: 'spring', damping: 15, duration: 0.8 }}
              className="w-full max-w-sm mx-4 relative"
              onClick={e => e.stopPropagation()}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 1, y: 0, scale: 1 }}
                  animate={{ opacity: 0, y: -80 - i * 20, scale: 0 }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 1.5 }}
                  className="absolute top-0 left-1/2 w-2 h-2 rounded-full"
                  style={{ backgroundColor: ['#a78bfa', '#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#c084fc', '#f87171'][i] }}
                />
              ))}

              <div className="glass rounded-2xl p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
                <div className="relative z-10">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6"
                  >
                    <Gift className="w-10 h-10 text-primary-foreground" />
                  </motion.div>

                  <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                    className="text-2xl font-black mb-2">
                    <span className="gradient-text">{t('gift.youHaveGift')}</span>
                  </motion.h2>

                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                    className="bg-secondary/50 rounded-xl p-4 mb-4">
                    <p className="text-muted-foreground text-sm mb-1">{t('gift.giftFrom')}</p>
                    <p className="font-bold text-lg flex items-center justify-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400" />
                      {gift.from_name}
                    </p>
                    {gift.message && <p className="text-sm text-muted-foreground mt-2 italic">"{gift.message}"</p>}
                  </motion.div>

                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                    className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Crown className="w-5 h-5 text-yellow-400" />
                      <span className="font-bold text-lg">{gift.plan_name}</span>
                    </div>
                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {t('gift.duration')}</span>
                    </div>
                  </motion.div>

                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
                    <Button onClick={handleClaim} disabled={claiming}
                      className="w-full gradient-bg text-primary-foreground h-12 text-base font-bold gap-2">
                      {claiming ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                          <Sparkles className="w-5 h-5" />
                        </motion.div>
                      ) : (
                        <><Check className="w-5 h-5" /> {t('gift.claim')}</>
                      )}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass rounded-2xl p-8 text-center max-w-sm mx-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}
                className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: 2 }}>
                  <Check className="w-10 h-10 text-green-400" />
                </motion.div>
              </motion.div>
              <motion.h2 initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                className="text-xl font-bold mb-2 text-green-400">
                {t('gift.claimed')}
              </motion.h2>
              <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                className="text-muted-foreground text-sm mb-4">
                {t('gift.planActive', { plan: gift.plan_name })}
              </motion.p>
              <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
                <Button onClick={() => setShow(false)} className="gradient-bg text-primary-foreground">
                  {t('gift.goToDashboard')}
                </Button>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
