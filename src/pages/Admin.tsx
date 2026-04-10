import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, Users, CreditCard, Server, Settings } from 'lucide-react';

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const [stats, setStats] = useState({ users: 0, projects: 0, subscriptions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    const [settingsRes] = await Promise.all([
      supabase.from('settings').select('value').eq('key', 'payment_enabled').maybeSingle(),
    ]);
    if (settingsRes.data) {
      setPaymentEnabled(settingsRes.data.value === true || settingsRes.data.value === 'true');
    }

    // Stats via count
    const [usersRes, projectsRes, subsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    setStats({
      users: usersRes.count || 0,
      projects: projectsRes.count || 0,
      subscriptions: subsRes.count || 0,
    });
    setLoading(false);
  };

  const togglePayment = async (enabled: boolean) => {
    const { error } = await supabase
      .from('settings')
      .update({ value: enabled as any })
      .eq('key', 'payment_enabled');
    if (error) {
      toast.error('حدث خطأ');
    } else {
      setPaymentEnabled(enabled);
      toast.success(enabled ? 'تم تفعيل الدفع' : 'تم تعطيل الدفع');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const statCards = [
    { icon: Users, label: 'المستخدمين', value: stats.users, color: 'text-blue-400' },
    { icon: Server, label: 'المشاريع', value: stats.projects, color: 'text-green-400' },
    { icon: CreditCard, label: 'الاشتراكات', value: stats.subscriptions, color: 'text-purple-400' },
  ];

  return (
    <div className="min-h-screen pt-24 pb-16 px-4" dir="rtl">
      <div className="container mx-auto max-w-4xl">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold gradient-text">لوحة الأدمن</h1>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-6"
            >
              <stat.icon className={`w-8 h-8 mb-3 ${stat.color}`} />
              <p className="text-3xl font-black">{stat.value}</p>
              <p className="text-muted-foreground text-sm">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Payment Toggle */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">إعدادات الدفع</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">تفعيل الدفع</p>
              <p className="text-sm text-muted-foreground">
                عند التعطيل، جميع الباقات تكون مجانية بدون الحاجة للدفع
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={paymentEnabled ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}>
                {paymentEnabled ? 'مفعل' : 'معطل'}
              </Badge>
              <Switch checked={paymentEnabled} onCheckedChange={togglePayment} />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
