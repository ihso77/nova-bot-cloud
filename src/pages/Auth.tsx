import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Server, Sparkles } from 'lucide-react';

// Geometric shapes
function GeometricShapes() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Floating circles */}
      <motion.div
        animate={{ y: [-20, 20, -20], rotate: [0, 180, 360] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[15%] left-[10%] w-16 h-16 rounded-full border border-primary/10"
      />
      <motion.div
        animate={{ y: [20, -20, 20], rotate: [360, 180, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        className="absolute bottom-[20%] right-[15%] w-24 h-24 rounded-full border border-accent/10"
      />
      <motion.div
        animate={{ x: [-15, 15, -15], y: [10, -10, 10] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[60%] left-[5%] w-10 h-10 rounded-full bg-primary/5"
      />

      {/* Floating squares */}
      <motion.div
        animate={{ rotate: [0, 90, 180, 270, 360], y: [-10, 10, -10] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[25%] right-[8%] w-12 h-12 border border-primary/10 rotate-45"
      />
      <motion.div
        animate={{ rotate: [45, 135, 225, 315, 45], x: [10, -10, 10] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="absolute bottom-[30%] left-[12%] w-8 h-8 border border-accent/8 rotate-12"
      />

      {/* Floating triangles using CSS */}
      <motion.div
        animate={{ y: [-15, 15, -15], rotate: [0, 15, -15, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[40%] left-[80%]"
      >
        <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[34px] border-b-primary/10" />
      </motion.div>
      <motion.div
        animate={{ y: [15, -15, 15], rotate: [0, -10, 10, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
        className="absolute bottom-[50%] left-[20%]"
      >
        <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-b-[24px] border-b-accent/8" />
      </motion.div>

      {/* Dots pattern */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.1, 0.4, 0.1], scale: [1, 1.2, 1] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute w-2 h-2 rounded-full bg-primary/20"
          style={{ top: `${15 + i * 14}%`, left: `${70 + (i % 3) * 10}%` }}
        />
      ))}

      {/* Hexagon-like shape */}
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[70%] right-[25%] w-16 h-16 border border-primary/5"
        style={{ borderRadius: '30%' }}
      />

      {/* Glow orbs */}
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 6, repeat: Infinity }}
        className="absolute top-[10%] right-[40%] w-48 h-48 rounded-full bg-primary/5 blur-3xl"
      />
      <motion.div
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.08, 0.03, 0.08] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute bottom-[15%] left-[30%] w-64 h-64 rounded-full bg-accent/5 blur-3xl"
      />
    </div>
  );
}

export default function Auth() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('تم تسجيل الدخول بنجاح');
        navigate('/dashboard');
      }
    } else {
      if (!displayName.trim()) {
        toast.error('الرجاء إدخال اسم العرض');
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, displayName);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('تم إنشاء الحساب بنجاح');
        navigate('/dashboard');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" dir="rtl">
      <GeometricShapes />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo with animation */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring' }}
          className="flex flex-col items-center mb-8"
        >
          <motion.div
            animate={{ boxShadow: ['0 0 20px -5px hsl(265 90% 60% / 0.3)', '0 0 40px -5px hsl(265 90% 60% / 0.5)', '0 0 20px -5px hsl(265 90% 60% / 0.3)'] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center mb-4"
          >
            <Server className="w-8 h-8 text-primary-foreground" />
          </motion.div>
          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold gradient-text"
          >
            {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}
          </motion.h1>
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-muted-foreground mt-1"
          >
            {isLogin ? 'مرحباً بعودتك!' : 'انضم إلينا مجاناً'}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
                <Input
                  placeholder="اسم العرض"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="bg-secondary/50 border-border/50 h-11"
                />
              </motion.div>
            )}
            <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
              <Input
                type="email"
                placeholder="البريد الإلكتروني"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                dir="ltr"
                className="bg-secondary/50 border-border/50 h-11"
              />
            </motion.div>
            <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
              <Input
                type="password"
                placeholder="كلمة المرور (8 أحرف على الأقل)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                dir="ltr"
                className="bg-secondary/50 border-border/50 h-11"
              />
            </motion.div>
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}>
              <Button type="submit" disabled={loading} className="w-full gradient-bg text-primary-foreground h-11 text-base font-semibold">
                {loading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <Sparkles className="w-4 h-4" />
                  </motion.div>
                ) : isLogin ? 'دخول' : 'إنشاء حساب'}
              </Button>
            </motion.div>
          </form>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            {isLogin ? 'ما عندك حساب؟' : 'عندك حساب؟'}{' '}
            <button
              onClick={() => navigate(isLogin ? '/register' : '/login')}
              className="text-primary hover:underline font-semibold"
            >
              {isLogin ? 'سجل الآن' : 'سجل دخول'}
            </button>
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
