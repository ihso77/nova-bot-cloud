import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Server } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center px-4" dir="rtl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md"
      >
        <div className="glass rounded-2xl p-8 glow-primary">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-xl gradient-bg flex items-center justify-center mb-4">
              <Server className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">
              {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Input
                placeholder="اسم العرض"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="bg-secondary border-border/50"
              />
            )}
            <Input
              type="email"
              placeholder="البريد الإلكتروني"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="bg-secondary border-border/50"
            />
            <Input
              type="password"
              placeholder="كلمة المرور"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-secondary border-border/50"
            />
            <Button type="submit" disabled={loading} className="w-full gradient-bg text-primary-foreground">
              {loading ? 'جاري...' : isLogin ? 'دخول' : 'تسجيل'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLogin ? 'ما عندك حساب؟' : 'عندك حساب؟'}{' '}
            <button
              onClick={() => navigate(isLogin ? '/register' : '/login')}
              className="text-primary hover:underline"
            >
              {isLogin ? 'سجل الآن' : 'سجل دخول'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
