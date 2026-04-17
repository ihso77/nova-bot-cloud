import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export default function PaymentCancel() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-4 flex items-center justify-center" dir="rtl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md glass rounded-2xl p-6 sm:p-8 text-center"
      >
        <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">{t('paymentCancel.title')}</h1>
        <p className="text-muted-foreground mb-6">
          {t('paymentCancel.description')}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>
            {t('paymentCancel.home')}
          </Button>
          <Button className="flex-1 gradient-bg text-primary-foreground" onClick={() => navigate('/plans')}>
            {t('paymentCancel.backToPlans')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
