import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { saveGiftLocal } from '@/components/GiftPopup';
import {
  Shield, Users, Server, CreditCard, Settings, Gift, BarChart3,
  ChevronLeft, Search, Crown, Activity, Clock, Mail, User as UserIcon,
  Monitor, Trash2, Eye, Ban, Wrench, Zap, ArrowLeft, Star, Package,
  ToggleLeft, ToggleRight, Send, X, Check, Sparkles, Heart,
  TrendingUp, Layers, Database, ShieldCheck, FileCode2, Ticket, Plus, Percent,
  Bot, MessageSquare, Hash,
} from 'lucide-react';

// --- Admin Navigation ---
const navItems = [
  { id: 'overview', icon: BarChart3, label: 'نظرة عامة' },
  { id: 'users', icon: Users, label: 'المستخدمين' },
  { id: 'projects', icon: Server, label: 'المشاريع' },
  { id: 'discord-bot', icon: Bot, label: 'بوت ديسكورد' },
  { id: 'coupons', icon: Ticket, label: 'أكواد الخصم' },
  { id: 'gifts', icon: Gift, label: 'إهداء الباقات' },
  { id: 'settings', icon: Settings, label: 'إعدادات الموقع' },
  { id: 'plans-manage', icon: Crown, label: 'إدارة الباقات' },
  { id: 'activity', icon: Activity, label: 'النشاط' },
];

interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  role: string | null;
  projects_count: number;
  subscriptions_count: number;
  last_sign_in: string | null;
}

interface AdminProject {
  id: string;
  name: string;
  language: string;
  status: string;
  created_at: string;
  user_email: string | null;
}

interface GiftRecord {
  id: string;
  from_user_id: string;
  from_name: string;
  to_email: string;
  plan_id: string;
  plan_name: string;
  claimed: boolean;
  created_at: string;
}

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // Overview stats
  const [stats, setStats] = useState({ users: 0, projects: 0, subs: 0, running: 0 });

  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // Projects
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Settings
  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [siteName, setSiteName] = useState('Nova VPS');

  // Gifts
  const [gifts, setGifts] = useState<GiftRecord[]>([]);
  const [giftsLoading, setGiftsLoading] = useState(false);
  const [showGiftForm, setShowGiftForm] = useState(false);
  const [giftEmail, setGiftEmail] = useState('');
  const [giftPlanId, setGiftPlanId] = useState('');
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [giftMessage, setGiftMessage] = useState('');

  // Coupons
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponType, setCouponType] = useState<'percentage' | 'fixed'>('percentage');
  const [couponValue, setCouponValue] = useState('');
  const [couponMaxUses, setCouponMaxUses] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    loadOverview();
    loadSettings();
    loadPlans();
  }, [isAdmin]);

  const loadOverview = async () => {
    const [u, p, s, r] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    ]);
    setStats({ users: u.count || 0, projects: p.count || 0, subs: s.count || 0, running: r.count || 0 });
    setLoading(false);
  };

  const loadSettings = async () => {
    const { data: payData } = await supabase.from('settings').select('value').eq('key', 'payment_enabled').maybeSingle();
    if (payData) setPaymentEnabled(payData.value === true || payData.value === 'true');

    const { data: maintData } = await supabase.from('settings').select('value').eq('key', 'maintenance_mode').maybeSingle();
    if (maintData) setMaintenanceMode(maintData.value === true || maintData.value === 'true');

    const { data: nameData } = await supabase.from('settings').select('value').eq('key', 'site_name').maybeSingle();
    if (nameData) setSiteName(String(nameData.value) || 'Nova VPS');
  };

  const loadPlans = async () => {
    const { data } = await supabase.from('plans').select('*').order('sort_order');
    if (data) setAvailablePlans(data);
  };

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (!profiles) { setUsersLoading(false); return; }

    const enriched = await Promise.all(profiles.map(async (p: any) => {
      const [projRes, subRes] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', p.id),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', p.id).eq('status', 'active'),
      ]);
      const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', p.id).maybeSingle();
      return {
        id: p.id,
        email: p.email || p.user_email || '',
        display_name: p.display_name || p.full_name || '',
        created_at: p.created_at,
        role: roleData?.role || null,
        projects_count: projRes.count || 0,
        subscriptions_count: subRes.count || 0,
        last_sign_in: p.last_sign_in_at || null,
      };
    }));
    setUsers(enriched);
    setUsersLoading(false);
  }, []);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    const { data } = await supabase.from('projects').select('*, profiles(email)').order('created_at', { ascending: false });
    if (data) {
      setProjects(data.map((p: any) => ({
        id: p.id,
        name: p.name,
        language: p.language,
        status: p.status,
        created_at: p.created_at,
        user_email: p.profiles?.email || '',
      })));
    }
    setProjectsLoading(false);
  }, []);

  const loadGifts = useCallback(async () => {
    setGiftsLoading(true);
    try {
      const { data } = await supabase.from('gifts').select('*').order('created_at', { ascending: false });
      if (data && data.length > 0) { setGifts(data as any); setGiftsLoading(false); return; }
    } catch {}
    // Fallback: localStorage
    try {
      const stored = localStorage.getItem('nova_pending_gifts');
      if (stored) { setGifts(JSON.parse(stored)); }
    } catch {}
    setGiftsLoading(false);
  }, []);

  const loadCoupons = useCallback(async () => {
    setCouponsLoading(true);
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (data) setCoupons(data);
    setCouponsLoading(false);
  }, []);

  const handleCreateCoupon = async () => {
    if (!couponCode.trim() || !couponValue) { toast.error('أكمل جميع الحقول'); return; }
    const { error } = await supabase.from('coupons').insert({
      code: couponCode.trim().toUpperCase(),
      discount_type: couponType,
      discount_value: parseFloat(couponValue),
      max_uses: couponMaxUses ? parseInt(couponMaxUses) : null,
    });
    if (error) { toast.error('خطأ: ' + error.message); return; }
    toast.success('تم إنشاء كود الخصم!');
    setCouponCode(''); setCouponValue(''); setCouponMaxUses('');
    setShowCouponForm(false);
    loadCoupons();
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('حذف كود الخصم؟')) return;
    await supabase.from('coupons').delete().eq('id', id);
    toast.success('تم الحذف');
    loadCoupons();
  };

  const handleToggleCoupon = async (id: string, active: boolean) => {
    await supabase.from('coupons').update({ is_active: !active }).eq('id', id);
    loadCoupons();
  };

  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) loadUsers();
    if (activeTab === 'projects' && projects.length === 0) loadProjects();
    if (activeTab === 'gifts' && gifts.length === 0) loadGifts();
    if (activeTab === 'coupons' && coupons.length === 0) loadCoupons();
    if (activeTab === 'overview') loadOverview();
  }, [activeTab]);

  const updateSetting = async (key: string, value: any) => {
    await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
    toast.success('تم تحديث الإعداد');
  };

  const handleSendGift = async () => {
    if (!giftEmail.trim() || !giftPlanId) { toast.error('أكمل جميع الحقول'); return; }
    const plan = availablePlans.find(p => p.id === giftPlanId);
    const giftData = {
      id: crypto.randomUUID(),
      from_user_id: user?.id,
      from_name: 'Nova VPS',
      to_email: giftEmail.trim(),
      plan_id: giftPlanId,
      plan_name: plan?.name || '',
      claimed: false,
      message: giftMessage.trim(),
      created_at: new Date().toISOString(),
    };

    // Try Supabase first, fallback to localStorage
    try {
      const { error } = await supabase.from('gifts').insert(giftData);
      if (!error) {
        toast.success('تم إرسال الهدية بنجاح!');
        setGiftEmail(''); setGiftPlanId(''); setGiftMessage('');
        setShowGiftForm(false);
        loadGifts();
        return;
      }
    } catch {}

    // Fallback: save to localStorage
    await saveGiftLocal(giftData);
    toast.success('تم إرسال الهدية بنجاح!');
    setGiftEmail(''); setGiftPlanId(''); setGiftMessage('');
    setShowGiftForm(false);
    loadGifts();
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(usersSearch.toLowerCase()) ||
    (u.display_name && u.display_name.toLowerCase().includes(usersSearch.toLowerCase()))
  );

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('projects').delete().eq('user_id', userId);
    await supabase.from('subscriptions').delete().eq('user_id', userId);
    toast.success('تم حذف المستخدم');
    loadUsers();
    loadOverview();
  };

  const handleBanUser = async (userId: string) => {
    await supabase.from('user_roles').upsert({ user_id: userId, role: 'user' as const }, { onConflict: 'user_id' });
    toast.success('تم حظر المستخدم');
    loadUsers();
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-screen pt-16 flex" dir="rtl">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className={`glass border-l border-border/30 flex flex-col flex-shrink-0 transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-16'}`}
      >
        <div className="p-3 border-b border-border/30 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary">الأدمن</span>
            </div>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
                activeTab === item.id
                  ? 'bg-primary/15 text-primary border-r-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-border/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">المدير</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {/* Overview */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <h2 className="text-2xl font-bold mb-6 gradient-text">نظرة عامة</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { icon: Users, label: 'المستخدمين', value: stats.users, color: 'from-blue-500 to-cyan-500', iconBg: 'bg-blue-500/10' },
                  { icon: Server, label: 'المشاريع', value: stats.projects, color: 'from-green-500 to-emerald-500', iconBg: 'bg-green-500/10' },
                  { icon: CreditCard, label: 'اشتراكات فعالة', value: stats.subs, color: 'from-purple-500 to-pink-500', iconBg: 'bg-purple-500/10' },
                  { icon: Activity, label: 'بوتات تعمل', value: stats.running, color: 'from-yellow-500 to-orange-500', iconBg: 'bg-yellow-500/10' },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass rounded-xl p-5 group hover:scale-[1.02] transition-transform"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                        <s.icon className="w-5 h-5 text-primary" />
                      </div>
                      <TrendingUp className="w-4 h-4 text-muted-foreground/30" />
                    </div>
                    <p className="text-3xl font-black mb-1">{s.value}</p>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                  className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-primary" />
                    <h3 className="font-bold">إجراءات سريعة</h3>
                  </div>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start text-sm" onClick={() => { setActiveTab('gifts'); }}>
                      <Gift className="w-4 h-4 ml-2" /> إرسال هدية باقة
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-sm" onClick={() => { setActiveTab('settings'); }}>
                      <Wrench className="w-4 h-4 ml-2" /> إعدادات الموقع
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-sm" onClick={() => { setActiveTab('users'); }}>
                      <Users className="w-4 h-4 ml-2" /> عرض المستخدمين
                    </Button>
                  </div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                  className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <h3 className="font-bold">حالة النظام</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">الدفع</span><Badge className={paymentEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>{paymentEnabled ? 'مفعل' : 'معطل'}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">الصيانة</span><Badge className={maintenanceMode ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}>{maintenanceMode ? 'مفعل' : 'معطل'}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">اسم الموقع</span><span>{siteName}</span></div>
                  </div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}
                  className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-primary" />
                    <h3 className="font-bold">قاعدة البيانات</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">الجداول</span><span>8</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">الحالة</span><Badge className="bg-green-500/20 text-green-400">متصلة</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">النوع</span><span>Supabase</span></div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Users */}
          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold gradient-text">المستخدمين</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{users.length} مستخدم</Badge>
                  <Button size="sm" variant="outline" onClick={loadUsers}><Monitor className="w-4 h-4 ml-1" /> تحديث</Button>
                </div>
              </div>

              <div className="relative mb-4">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالبريد أو الاسم..."
                  value={usersSearch}
                  onChange={e => setUsersSearch(e.target.value)}
                  className="pr-10 bg-secondary/50"
                />
              </div>

              {usersLoading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="glass rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">المستخدم</th>
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">البريد</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">المشاريع</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">الاشتراكات</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">الدور</th>
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">تاريخ التسجيل</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u, i) => (
                          <motion.tr
                            key={u.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-b border-border/20 hover:bg-secondary/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
                                  <UserIcon className="w-4 h-4 text-primary-foreground" />
                                </div>
                                <span className="font-medium truncate max-w-[120px]">{u.display_name || 'بدون اسم'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]" dir="ltr">{u.email}</td>
                            <td className="px-4 py-3 text-center"><Badge variant="secondary">{u.projects_count}</Badge></td>
                            <td className="px-4 py-3 text-center"><Badge variant="secondary">{u.subscriptions_count}</Badge></td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : u.role === 'banned' ? 'bg-red-500/20 text-red-400' : 'bg-muted'}>
                                {u.role === 'admin' ? 'أدمن' : u.role === 'banned' ? 'محظور' : 'مستخدم'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => handleDeleteUser(u.id)} title="حذف">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-orange-400 hover:text-orange-300" onClick={() => handleBanUser(u.id)} title="حظر">
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">لا يوجد مستخدمين</div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Projects */}
          {activeTab === 'projects' && (
            <motion.div key="projects" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold gradient-text">المشاريع</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{projects.length} مشروع</Badge>
                  <Button size="sm" variant="outline" onClick={loadProjects}><Monitor className="w-4 h-4 ml-1" /> تحديث</Button>
                </div>
              </div>

              {projectsLoading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="glass rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">المشروع</th>
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">المالك</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">اللغة</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">الحالة</th>
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">تاريخ الإنشاء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p, i) => (
                          <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                            className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3 flex items-center gap-2"><FileCode2 className="w-4 h-4 text-primary flex-shrink-0" /> {p.name}</td>
                            <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]" dir="ltr">{p.user_email || '-'}</td>
                            <td className="px-4 py-3 text-center"><Badge variant="secondary">{p.language}</Badge></td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={p.status === 'running' ? 'bg-green-500/20 text-green-400' : p.status === 'stopped' ? 'bg-gray-500/20 text-gray-400' : p.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}>
                                {p.status === 'running' ? 'يعمل' : p.status === 'stopped' ? 'متوقف' : p.status === 'error' ? 'خطأ' : 'جاري النشر'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(p.created_at)}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {projects.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">لا يوجد مشاريع</div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Gifts */}
          {activeTab === 'gifts' && (
            <motion.div key="gifts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold gradient-text">إهداء الباقات</h2>
                <Button className="gradient-bg text-primary-foreground" onClick={() => setShowGiftForm(true)}>
                  <Gift className="w-4 h-4 ml-2" /> إرسال هدية
                </Button>
              </div>

              {showGiftForm && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> هدية جديدة</h3>
                    <Button size="sm" variant="ghost" onClick={() => setShowGiftForm(false)}><X className="w-4 h-4" /></Button>
                  </div>
                  <div className="space-y-3">
                    <Input placeholder="بريد المستخدم المرسل إليه..." value={giftEmail} onChange={e => setGiftEmail(e.target.value)} dir="ltr" />
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={giftPlanId}
                        onChange={e => setGiftPlanId(e.target.value)}
                        className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm"
                      >
                        <option value="">اختر باقة</option>
                        {availablePlans.map(p => (
                          <option key={p.id} value={p.id}>{p.name} - {p.price === 0 ? 'مجاني' : `$${p.price}`}</option>
                        ))}
                      </select>
                    </div>
                    <Input placeholder="رسالة اختيارية..." value={giftMessage} onChange={e => setGiftMessage(e.target.value)} />
                    <Button className="w-full gradient-bg text-primary-foreground" onClick={handleSendGift}>
                      <Send className="w-4 h-4 ml-2" /> إرسال الهدية
                    </Button>
                  </div>
                </motion.div>
              )}

              {giftsLoading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  {gifts.map((g, i) => (
                    <motion.div key={g.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="glass rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Gift className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium">هدية {g.plan_name}</p>
                          <p className="text-xs text-muted-foreground" dir="ltr">{g.to_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatDate(g.created_at)}</span>
                        <Badge className={g.claimed ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                          {g.claimed ? 'تم الاستلام' : 'بالانتظار'}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                  {gifts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground"><Gift className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا يوجد هدايا بعد</p></div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Settings */}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <h2 className="text-2xl font-bold mb-6 gradient-text">إعدادات الموقع</h2>

              <div className="space-y-4">
                {/* Maintenance Mode */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                  className="glass rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <Wrench className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="font-bold">وضع الصيانة</p>
                        <p className="text-sm text-muted-foreground">عند التفعيل، فقط الأدمن يقدر يدخل الموقع</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={maintenanceMode ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}>
                        {maintenanceMode ? 'مفعل' : 'معطل'}
                      </Badge>
                      <Switch checked={maintenanceMode} onCheckedChange={v => { setMaintenanceMode(v); updateSetting('maintenance_mode', v); }} />
                    </div>
                  </div>
                </motion.div>

                {/* Payment */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                  className="glass rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="font-bold">تفعيل الدفع</p>
                        <p className="text-sm text-muted-foreground">عند التعطيل، جميع الباقات مجانية</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={paymentEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                        {paymentEnabled ? 'مفعل' : 'معطل'}
                      </Badge>
                      <Switch checked={paymentEnabled} onCheckedChange={v => { setPaymentEnabled(v); updateSetting('payment_enabled', v); }} />
                    </div>
                  </div>
                </motion.div>

                {/* Site Name */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                  className="glass rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-bold">اسم الموقع</p>
                      <p className="text-sm text-muted-foreground">الاسم اللي يظهر في المتصفح</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input value={siteName} onChange={e => setSiteName(e.target.value)} className="max-w-xs" />
                    <Button className="gradient-bg text-primary-foreground" onClick={() => updateSetting('site_name', siteName)}>
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>

                {/* Danger Zone */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                  className="glass rounded-xl p-5 border border-red-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <p className="font-bold text-red-400">منطقة الخطر</p>
                      <p className="text-sm text-muted-foreground">إجراءات لا يمكن التراجع عنها</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={async () => {
                      if (!confirm('هل أنت متأكد؟ سيتم حذف جميع الاشتراكات المنتهية!')) return;
                      const { data: expired } = await supabase.from('subscriptions').select('id').lt('expires_at', new Date().toISOString()).eq('status', 'active');
                      if (expired && expired.length > 0) {
                        await supabase.from('subscriptions').delete().in('id', expired.map(e => e.id));
                        toast.success(`تم حذف ${expired.length} اشتراك منتهي`);
                        loadOverview();
                      } else {
                        toast.info('لا يوجد اشتراكات منتهية');
                      }
                    }}>
                      <Trash2 className="w-4 h-4 ml-2" /> حذف الاشتراكات المنتهية
                    </Button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Plans Manage */}
          {activeTab === 'plans-manage' && (
            <motion.div key="plans-manage" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <h2 className="text-2xl font-bold mb-6 gradient-text">إدارة الباقات</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availablePlans.map((plan, i) => (
                  <motion.div key={plan.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
                    className="glass rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="w-5 h-5 text-yellow-400" />
                      <h3 className="font-bold">{plan.name}</h3>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground mb-4">
                      <div className="flex justify-between"><span>السعر</span><span className="text-foreground font-semibold">{plan.price === 0 ? 'مجاني' : `$${plan.price}/شهر`}</span></div>
                      <div className="flex justify-between"><span>التخزين</span><span>{plan.storage_mb >= 1024 ? `${plan.storage_mb / 1024}GB` : `${plan.storage_mb}MB`}</span></div>
                      <div className="flex justify-between"><span>الرام</span><span>{plan.ram_mb >= 1024 ? `${plan.ram_mb / 1024}GB` : `${plan.ram_mb}MB`}</span></div>
                      <div className="flex justify-between"><span>المعالج</span><span>{plan.cpu_cores} نواة</span></div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{plan.is_free ? 'باقة تجريبية' : 'باقة مدفوعة'}</Badge>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Coupons */}
          {activeTab === 'coupons' && (
            <motion.div key="coupons" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold gradient-text">أكواد الخصم</h2>
                <Button className="gradient-bg text-primary-foreground" onClick={() => setShowCouponForm(true)}>
                  <Plus className="w-4 h-4 ml-2" /> إضافة كود
                </Button>
              </div>

              {showCouponForm && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2"><Ticket className="w-4 h-4 text-primary" /> كود خصم جديد</h3>
                    <Button size="sm" variant="ghost" onClick={() => setShowCouponForm(false)}><X className="w-4 h-4" /></Button>
                  </div>
                  <div className="space-y-3">
                    <Input placeholder="كود الخصم (مثل: NOVA50)" value={couponCode} onChange={e => setCouponCode(e.target.value)} dir="ltr" />
                    <div className="grid grid-cols-2 gap-3">
                      <select value={couponType} onChange={e => setCouponType(e.target.value as 'percentage' | 'fixed')}
                        className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm">
                        <option value="percentage">نسبة مئوية (%)</option>
                        <option value="fixed">مبلغ ثابت ($)</option>
                      </select>
                      <Input type="number" placeholder={couponType === 'percentage' ? 'النسبة (مثل: 50)' : 'المبلغ (مثل: 2)'} value={couponValue} onChange={e => setCouponValue(e.target.value)} dir="ltr" />
                    </div>
                    <Input type="number" placeholder="الحد الأقصى للاستخدام (اتركه فارغ = غير محدود)" value={couponMaxUses} onChange={e => setCouponMaxUses(e.target.value)} dir="ltr" />
                    <Button className="w-full gradient-bg text-primary-foreground" onClick={handleCreateCoupon}>
                      <Check className="w-4 h-4 ml-2" /> إنشاء الكود
                    </Button>
                  </div>
                </motion.div>
              )}

              {couponsLoading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  {coupons.map((c, i) => (
                    <motion.div key={c.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="glass rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Ticket className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-mono font-bold text-lg">{c.code}</p>
                          <p className="text-xs text-muted-foreground">
                            خصم {c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`}
                            {' · '} استخدم {c.current_uses} مرة {c.max_uses ? `من ${c.max_uses}` : '(غير محدود)'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={c.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                          {c.is_active ? 'مفعل' : 'معطل'}
                        </Badge>
                        <Switch checked={c.is_active} onCheckedChange={() => handleToggleCoupon(c.id, c.is_active)} />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => handleDeleteCoupon(c.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                  {coupons.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground"><Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا يوجد أكواد خصم</p></div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Activity */}
          {activeTab === 'activity' && (
            <motion.div key="activity" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <h2 className="text-2xl font-bold mb-6 gradient-text">سجل النشاط</h2>
              <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>سجل النشاط سيظهر هنا</p>
                <p className="text-sm mt-1">الميزة قيد التطوير</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
