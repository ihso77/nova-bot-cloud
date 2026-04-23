import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { saveGiftLocal } from '@/components/GiftPopup';
import {
  Shield, Users, Server, CreditCard, Settings, Gift, BarChart3,
  ChevronLeft, Search, Crown, Activity, Clock, Mail, User as UserIcon,
  Monitor, Trash2, Eye, Ban, Wrench, Zap, ArrowLeft, Star, Package,
  ToggleLeft, ToggleRight, Send, X, Check, Sparkles, Heart,
  TrendingUp, Layers, Database, ShieldCheck, FileCode2, Ticket, Plus, Percent,
  Bot, MessageSquare, Hash, Menu,
} from 'lucide-react';

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
  const { t } = useTranslation();

  // --- Admin Navigation (inside component so it can use t()) ---
  const navItems = [
    { id: 'overview', icon: BarChart3, label: t('admin.overview') },
    { id: 'users', icon: Users, label: t('admin.users') },
    { id: 'projects', icon: Server, label: t('admin.projects') },
    { id: 'payments', icon: CreditCard, label: t('admin.payments') },
    { id: 'discord-bot', icon: Bot, label: t('admin.discordBot') },
    { id: 'coupons', icon: Ticket, label: t('admin.coupons') },
    { id: 'gifts', icon: Gift, label: t('admin.gifts') },
    { id: 'notifications', icon: MessageSquare, label: t('admin.notifications') },
    { id: 'settings', icon: Settings, label: t('admin.settings') },
    { id: 'plans-manage', icon: Crown, label: t('admin.managePlans') },
    { id: 'logs', icon: Activity, label: t('admin.logs') },
  ];

  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  // Discord Bot
  const [botInfo, setBotInfo] = useState<any>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [guildChannels, setGuildChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [announceMsg, setAnnounceMsg] = useState('');

  // Payments
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Notifications/Announcements
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [showNotifForm, setShowNotifForm] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState<'info' | 'warning' | 'success'>('info');

  // Server Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

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

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setPayments(data);
    setPaymentsLoading(false);
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const { data } = await (supabase as any).from('notifications').select('*').order('created_at', { ascending: false });
      if (data) setNotifications(data);
    } catch {}
    setNotificationsLoading(false);
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data } = await (supabase as any).from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
      if (data) setLogs(data);
    } catch {}
    setLogsLoading(false);
  }, []);

  const handleCreateCoupon = async () => {
    if (!couponCode.trim() || !couponValue) { toast.error(t('admin.completeFields')); return; }
    const { error } = await supabase.from('coupons').insert({
      code: couponCode.trim().toUpperCase(),
      discount_type: couponType,
      discount_value: parseFloat(couponValue),
      max_uses: couponMaxUses ? parseInt(couponMaxUses) : null,
    });
    if (error) { toast.error(t('admin.errorWithMsg', { msg: error.message })); return; }
    toast.success(t('admin.couponCreated'));
    setCouponCode(''); setCouponValue(''); setCouponMaxUses('');
    setShowCouponForm(false);
    loadCoupons();
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm(t('admin.deleteConfirm'))) return;
    await supabase.from('coupons').delete().eq('id', id);
    toast.success(t('admin.deleted'));
    loadCoupons();
  };

  const handleToggleCoupon = async (id: string, active: boolean) => {
    await supabase.from('coupons').update({ is_active: !active }).eq('id', id);
    loadCoupons();
  };

  // Discord Bot — uses Vercel Serverless API
  const PROXY = '/api/nova-api-handler';
  const botHeaders = { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer nova-admin-2024-secret' } };
  const botHeadersPost = { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer nova-admin-2024-secret' } };

  const [missingAccessUrl, setMissingAccessUrl] = useState('');
  const [botInviteUrl, setBotInviteUrl] = useState('');

  const loadBotInfo = async () => {
    setBotLoading(true);
    try {
      const res = await fetch(`${PROXY}/bot/info`, botHeaders);
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        console.error('[Nova Bot Info] HTTP', res.status, errText);
        throw new Error(`Server error (${res.status}) - check that proxy is running on Railway`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      console.log('[Nova Bot Info] OK:', data.bot?.username, '| Guilds:', data.guilds_count);
      setBotInfo(data);
      if (data?.guilds?.length > 0) {
        setSelectedGuild(data.guilds[0].id);
        loadChannels(data.guilds[0].id);
      }
      // Also load invite URL
      try {
        const inviteRes = await fetch(`${PROXY}/bot/invite`, botHeaders);
        const inviteData = await inviteRes.json();
        if (inviteData.invite_url) setBotInviteUrl(inviteData.invite_url);
      } catch (invErr) { console.warn('[Nova Invite] Failed:', invErr); }
    } catch (e: unknown) {
      console.error('[Nova Bot Info] Full error:', e);
      toast.error(e instanceof Error ? e.message : t('admin.loadBotInfoFailed'));
    }
    setBotLoading(false);
  };

  const loadChannels = async (guildId: string) => {
    try {
      const res = await fetch(`${PROXY}/bot/guilds/${guildId}/channels`, botHeaders);
      if (!res.ok) {
        console.error('[Nova Channels] HTTP', res.status);
        throw new Error(t('admin.loadChannelsFailedWithCode', { code: res.status }));
      }
      const data = await res.json();
      console.log('[Nova Channels] OK:', data?.channels?.length, 'channels');
      setGuildChannels(data?.channels || []);
    } catch (e: unknown) {
      console.error('[Nova Channels] Full error:', e);
      toast.error(e instanceof Error ? e.message : t('admin.loadChannelsFailed'));
    }
  };

  const registerCommands = async () => {
    setBotLoading(true);
    setMissingAccessUrl('');
    try {
      const res = await fetch(`${PROXY}/bot/commands/register`, { ...botHeadersPost, method: 'POST' });
      const data = await res.json();
      if (data.error === 'Missing Access') {
        setMissingAccessUrl(data.invite_url || '');
        toast.error(data.detail || 'Missing Access — bot needs applications.commands permission', { duration: 8000 });
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        toast.success(data.message || t('admin.registerCommandsSuccess'));
      }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t('admin.registerCommandsFailed')); }
    setBotLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) loadUsers();
    if (activeTab === 'projects' && projects.length === 0) loadProjects();
    if (activeTab === 'gifts' && gifts.length === 0) loadGifts();
    if (activeTab === 'coupons' && coupons.length === 0) loadCoupons();
    if (activeTab === 'payments' && payments.length === 0) loadPayments();
    if (activeTab === 'notifications' && notifications.length === 0) loadNotifications();
    if (activeTab === 'logs' && logs.length === 0) loadLogs();
    if (activeTab === 'discord-bot' && !botInfo) loadBotInfo();
    if (activeTab === 'overview') loadOverview();
  }, [activeTab]);

  const updateSetting = async (key: string, value: any) => {
    await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
    toast.success(t('admin.settingsUpdated'));
  };

  const handleSendGift = async () => {
    if (!giftEmail.trim() || !giftPlanId) { toast.error(t('admin.completeFields')); return; }
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
        toast.success(t('admin.giftSentSuccess'));
        setGiftEmail(''); setGiftPlanId(''); setGiftMessage('');
        setShowGiftForm(false);
        loadGifts();
        return;
      }
    } catch {}

    // Fallback: save to localStorage
    await saveGiftLocal(giftData);
    toast.success(t('admin.giftSentSuccess'));
    setGiftEmail(''); setGiftPlanId(''); setGiftMessage('');
    setShowGiftForm(false);
    loadGifts();
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(usersSearch.toLowerCase()) ||
    (u.display_name && u.display_name.toLowerCase().includes(usersSearch.toLowerCase()))
  );

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(t('admin.deleteUserConfirm'))) return;
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('projects').delete().eq('user_id', userId);
    await supabase.from('subscriptions').delete().eq('user_id', userId);
    toast.success(t('admin.userDeleted'));
    loadUsers();
    loadOverview();
  };

  const handleBanUser = async (userId: string) => {
    await supabase.from('user_roles').upsert({ user_id: userId, role: 'user' as const }, { onConflict: 'user_id' });
    toast.success(t('admin.userBanned'));
    loadUsers();
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center pt-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="space-y-0.5">
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => { setActiveTab(item.id); onNavigate?.(); }}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all text-sm ${
            activeTab === item.id
              ? 'bg-primary/15 text-primary border-r-2 border-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          }`}
        >
          <item.icon className="w-4 h-4 flex-shrink-0" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-screen pt-16 flex" dir="rtl">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className={`hidden md:flex glass border-l border-border/30 flex-col flex-shrink-0 transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-16'}`}
      >
        <div className="p-3 border-b border-border/30 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary">{t('admin.admin')}</span>
            </div>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <SidebarNav />
        </div>

        <div className="p-3 border-t border-border/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{t('admin.manager')}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Mobile Menu Button + Sheet */}
      <div className="md:hidden absolute top-16 left-0 right-0 z-40">
        <div className="glass border-b border-border/30 px-4 py-2 flex items-center gap-2">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Menu className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-4">
              <SheetTitle className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-primary">{t('admin.adminPanel')}</span>
              </SheetTitle>
              <SidebarNav onNavigate={() => setMobileMenuOpen(false)} />
              <div className="border-t border-border/30 pt-3 mt-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{t('admin.manager')}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <span className="text-sm font-medium">
            {navItems.find(n => n.id === activeTab)?.label || t('admin.admin')}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 md:mt-0 mt-12">
        <AnimatePresence mode="wait">
          {/* Overview */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 gradient-text">{t('admin.overview')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {[
                  { icon: Users, label: t('admin.totalUsers'), value: stats.users, color: 'from-blue-500 to-cyan-500', iconBg: 'bg-blue-500/10' },
                  { icon: Server, label: t('admin.totalProjects'), value: stats.projects, color: 'from-green-500 to-emerald-500', iconBg: 'bg-green-500/10' },
                  { icon: CreditCard, label: t('admin.activeSubscriptions'), value: stats.subs, color: 'from-blue-500 to-cyan-500', iconBg: 'bg-blue-500/10' },
                  { icon: Activity, label: t('admin.runningBots'), value: stats.running, color: 'from-yellow-500 to-orange-500', iconBg: 'bg-yellow-500/10' },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass rounded-xl p-3 sm:p-5 group hover:scale-[1.02] transition-transform"
                  >
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                        <s.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      </div>
                      <TrendingUp className="w-4 h-4 text-muted-foreground/30" />
                    </div>
                    <p className="text-xl sm:text-3xl font-black mb-0.5 sm:mb-1">{s.value}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                  className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-primary" />
                    <h3 className="font-bold">{t('admin.quickActions')}</h3>
                  </div>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start text-sm" onClick={() => { setActiveTab('gifts'); }}>
                      <Gift className="w-4 h-4 ml-2" /> {t('admin.sendGift')}
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-sm" onClick={() => { setActiveTab('settings'); }}>
                      <Wrench className="w-4 h-4 ml-2" /> {t('admin.siteSettings')}
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-sm" onClick={() => { setActiveTab('users'); }}>
                      <Users className="w-4 h-4 ml-2" /> {t('admin.viewUsers')}
                    </Button>
                  </div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                  className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <h3 className="font-bold">{t('admin.systemStatus')}</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.paymentStatus')}</span><Badge className={paymentEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>{paymentEnabled ? t('admin.active') : t('admin.inactive')}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.maintenance')}</span><Badge className={maintenanceMode ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}>{maintenanceMode ? t('admin.active') : t('admin.inactive')}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.siteName')}</span><span>{siteName}</span></div>
                  </div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}
                  className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-primary" />
                    <h3 className="font-bold">{t('admin.database')}</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.tables')}</span><span>8</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.status')}</span><Badge className="bg-green-500/20 text-green-400">{t('admin.connected')}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.type')}</span><span>Supabase</span></div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Users */}
          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold gradient-text">{t('admin.users')}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{users.length} {t('admin.user').toLowerCase()}</Badge>
                  <Button size="sm" variant="outline" onClick={loadUsers}><Monitor className="w-4 h-4 ml-1" /> {t('admin.update')}</Button>
                </div>
              </div>

              <div className="relative mb-4">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('admin.search')}
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
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">{t('admin.user')}</th>
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">{t('admin.email')}</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">{t('admin.projectsCount')}</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">{t('admin.subsCount')}</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">{t('admin.role')}</th>
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">{t('admin.registerDate')}</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">{t('admin.actions')}</th>
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
                                <span className="font-medium truncate max-w-[120px]">{u.display_name || t('admin.withoutName')}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]" dir="ltr">{u.email}</td>
                            <td className="px-4 py-3 text-center"><Badge variant="secondary">{u.projects_count}</Badge></td>
                            <td className="px-4 py-3 text-center"><Badge variant="secondary">{u.subscriptions_count}</Badge></td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={u.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : u.role === 'banned' ? 'bg-red-500/20 text-red-400' : 'bg-muted'}>
                                {u.role === 'admin' ? t('admin.admin') : u.role === 'banned' ? t('admin.banned') : t('admin.user').toLowerCase()}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => handleDeleteUser(u.id)} title={t('admin.deleteUser')}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-orange-400 hover:text-orange-300" onClick={() => handleBanUser(u.id)} title={t('admin.banUser')}>
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
                    <div className="text-center py-12 text-muted-foreground">{t('admin.noUsers')}</div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Projects */}
          {activeTab === 'projects' && (
            <motion.div key="projects" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold gradient-text">{t('admin.projects')}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{projects.length} {t('admin.totalProjects').toLowerCase()}</Badge>
                  <Button size="sm" variant="outline" onClick={loadProjects}><Monitor className="w-4 h-4 ml-1" /> {t('admin.update')}</Button>
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
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">{t('admin.totalProjects')}</th>
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">{t('admin.owner')}</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">{t('admin.lang')}</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">{t('admin.statusCol')}</th>
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">{t('admin.createDate')}</th>
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
                                {p.status === 'running' ? t('admin.running') : p.status === 'stopped' ? t('admin.stopped') : p.status === 'error' ? t('admin.errorStatus') : t('admin.deploying')}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(p.created_at)}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {projects.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">{t('admin.noProjects')}</div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Gifts */}
          {activeTab === 'gifts' && (
            <motion.div key="gifts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold gradient-text">{t('admin.gifts')}</h2>
                <Button className="gradient-bg text-primary-foreground" onClick={() => setShowGiftForm(true)}>
                  <Gift className="w-4 h-4 ml-2" /> {t('admin.sendGiftBtn')}
                </Button>
              </div>

              {showGiftForm && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> {t('admin.newGift')}</h3>
                    <Button size="sm" variant="ghost" onClick={() => setShowGiftForm(false)}><X className="w-4 h-4" /></Button>
                  </div>
                  <div className="space-y-3">
                    <Input placeholder={t('admin.recipientEmail')} value={giftEmail} onChange={e => setGiftEmail(e.target.value)} dir="ltr" />
                    <div className="grid grid-cols-1 gap-3">
                      <select
                        value={giftPlanId}
                        onChange={e => setGiftPlanId(e.target.value)}
                        className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm"
                      >
                        <option value="">{t('admin.selectPlan')}</option>
                        {availablePlans.map(p => (
                          <option key={p.id} value={p.id}>{p.name} - {p.price === 0 ? t('admin.freePlan') : `$${p.price}`}</option>
                        ))}
                      </select>
                    </div>
                    <Input placeholder={t('admin.optionalMessage')} value={giftMessage} onChange={e => setGiftMessage(e.target.value)} />
                    <Button className="w-full gradient-bg text-primary-foreground" onClick={handleSendGift}>
                      <Send className="w-4 h-4 ml-2" /> {t('admin.sendGiftBtn2')}
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
                      className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Gift className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t('admin.giftOf')} {g.plan_name}</p>
                          <p className="text-xs text-muted-foreground truncate" dir="ltr">{g.to_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{formatDate(g.created_at)}</span>
                        <Badge className={g.claimed ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                          {g.claimed ? t('admin.claimed') : t('admin.waiting')}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                  {gifts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground"><Gift className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>{t('admin.noGifts')}</p></div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Settings */}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 gradient-text">{t('admin.settings')}</h2>

              <div className="space-y-4">
                {/* Maintenance Mode */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                  className="glass rounded-xl p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <Wrench className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="font-bold">{t('admin.maintenanceMode')}</p>
                        <p className="text-sm text-muted-foreground">{t('admin.maintenanceDesc')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={maintenanceMode ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}>
                        {maintenanceMode ? t('admin.active') : t('admin.inactive')}
                      </Badge>
                      <Switch checked={maintenanceMode} onCheckedChange={v => { setMaintenanceMode(v); updateSetting('maintenance_mode', v); }} />
                    </div>
                  </div>
                </motion.div>

                {/* Payment */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                  className="glass rounded-xl p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="font-bold">{t('admin.enablePayment')}</p>
                        <p className="text-sm text-muted-foreground">{t('admin.enablePaymentDesc')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={paymentEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                        {paymentEnabled ? t('admin.active') : t('admin.inactive')}
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
                      <p className="font-bold">{t('admin.siteName')}</p>
                      <p className="text-sm text-muted-foreground">{t('admin.siteNameDesc')}</p>
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
                      <p className="font-bold text-red-400">{t('admin.dangerZone')}</p>
                      <p className="text-sm text-muted-foreground">{t('admin.dangerZoneDesc')}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={async () => {
                      if (!confirm(t('admin.deleteExpiredConfirm'))) return;
                      const { data: expired } = await supabase.from('subscriptions').select('id').lt('expires_at', new Date().toISOString()).eq('status', 'active');
                      if (expired && expired.length > 0) {
                        await supabase.from('subscriptions').delete().in('id', expired.map(e => e.id));
                        toast.success(t('admin.deletedExpired', { count: expired.length }));
                        loadOverview();
                      } else {
                        toast.info(t('admin.noExpiredSubs'));
                      }
                    }}>
                      <Trash2 className="w-4 h-4 ml-2" /> {t('admin.deleteExpired')}
                    </Button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Plans Manage */}
          {activeTab === 'plans-manage' && (
            <motion.div key="plans-manage" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 gradient-text">{t('admin.managePlans')}</h2>

              {/* Coins System Notice */}
              <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                className="glass rounded-xl p-4 mb-6 border border-yellow-500/20 bg-yellow-500/5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                    <Star className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-yellow-400 mb-1">{t('admin.coinsSystem')}</h3>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>{t('admin.coinsSystemDesc')}</p>
                      <div className="flex flex-wrap gap-3 mt-2">
                        <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          {t('admin.lowestPlanCoins')} <span className="font-bold">75</span> {t('admin.coins')}
                        </Badge>
                        <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          {t('admin.coinsPrice')} <span className="font-bold">100</span> {t('admin.coinsPriceEquals')} <span className="font-bold">15m</span>
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {availablePlans.map((plan, i) => (
                  <motion.div key={plan.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
                    className="glass rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="w-5 h-5 text-yellow-400" />
                      <h3 className="font-bold">{plan.name}</h3>
                    </div>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
                    )}
                    <div className="space-y-2 text-sm text-muted-foreground mb-4">
                      <div className="flex justify-between"><span>{t('admin.price')}</span><span className="text-foreground font-semibold">{plan.price === 0 ? t('admin.freePlan') : `$${plan.price}/${t('admin.month')}`}</span></div>
                      <div className="flex justify-between"><span>{t('admin.storage')}</span><span>{plan.storage_mb >= 1024 ? `${plan.storage_mb / 1024}GB` : `${plan.storage_mb}MB`}</span></div>
                      <div className="flex justify-between"><span>{t('admin.ram')}</span><span>{plan.ram_mb >= 1024 ? `${plan.ram_mb / 1024}GB` : `${plan.ram_mb}MB`}</span></div>
                      <div className="flex justify-between"><span>{t('admin.processor')}</span><span>{plan.cpu_cores} {t('admin.core')}</span></div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{plan.is_free ? t('admin.planTrial') : t('admin.planPaid')}</Badge>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Discord Bot */}
          {activeTab === 'discord-bot' && (
            <motion.div key="discord-bot" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 gradient-text">{t('admin.discordBot')}</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Bot Info */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Bot className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">{t('admin.botInfo')}</h3>
                  </div>
                  {botInfo ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.botNameLabel')}</span><span className="font-bold">{botInfo.bot?.username}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.guilds')}</span><Badge variant="secondary">{botInfo.guilds_count}</Badge></div>
                      {botInfo.guilds?.map((g: any) => (
                        <button key={g.id} onClick={() => { setSelectedGuild(g.id); loadChannels(g.id); }}
                          className={`w-full text-right p-2 rounded-lg transition-colors text-sm ${selectedGuild === g.id ? 'bg-primary/15 text-primary' : 'hover:bg-secondary/50'}`}>
                          {g.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={loadBotInfo} disabled={botLoading}>
                      {botLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Monitor className="w-4 h-4 ml-2" />}
                      {t('admin.loadBotInfo')}
                    </Button>
                  )}
                </motion.div>

                {/* Commands */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">{t('admin.commands')}</h3>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <p className="text-xs font-semibold text-primary mb-1">📋 {t('admin.commandGeneral')}</p>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/help</code> - {t('admin.commandHelp')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/prices</code> - {t('admin.sendPrices')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/serverinfo</code> - {t('admin.commandServerInfo')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/user</code> - {t('admin.commandUserInfo')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/avatar</code> - {t('admin.commandAvatar')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/stats</code> - {t('admin.commandStats')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/ping</code> - {t('admin.commandPing')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/invite</code> - {t('admin.commandInvite')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/poll</code> - {t('admin.commandPoll')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/announce</code> - {t('admin.sendAnnouncement')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/status</code> - {t('admin.commandStatus')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/uptime</code> - {t('admin.commandUptime')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/roles</code> - {t('admin.commandRoles')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/emoji-info</code> - {t('admin.commandEmojiInfo')}</div>
                    <div className="p-2 rounded-lg bg-secondary/30"><code>/banner</code> - {t('admin.commandBanner')}</div>
                    <p className="text-xs font-semibold text-green-400 mt-3 mb-1">🌐 {t('admin.commandSiteCommands')}</p>
                    <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20"><code>/site-check</code> - {t('admin.commandSiteCheck')}</div>
                    <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20"><code>/top-servers</code> - {t('admin.commandTopServers')}</div>
                    <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20"><code>/plans-detail</code> - {t('admin.commandPlansDetail')}</div>
                    <p className="text-xs font-semibold text-orange-500/70 mt-3 mb-1">{t('admin.commandTicketsAdmin')}</p>
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20"><code>/lookup</code> - {t('admin.commandLookup')}</div>
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20"><code>/recent-payments</code> - {t('admin.commandRecentPayments')}</div>
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20"><code>/set-status-channel</code> - {t('admin.commandSetStatusChannel')}</div>
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20"><code>/send-ticket-panel</code> - {t('admin.commandSendTicketPanel')}</div>
                  </div>
                  <div className="space-y-2">
                    <Button className="w-full gradient-bg text-primary-foreground" onClick={async () => {
                      setBotLoading(true);
                      setMissingAccessUrl('');
                      try {
                        const res = await fetch(`${PROXY}/bot/setup`, { ...botHeadersPost, method: 'POST' });
                        const data = await res.json();
                        if (data.error === 'Missing Access') {
                          setMissingAccessUrl(data.invite_url || '');
                          toast.error(data.detail || 'Missing Access — bot needs applications.commands permission', { duration: 8000 });
                        } else if (data.error) {
                          throw new Error(data.error);
                        } else {
                          toast.success(data.message || t('admin.botSetupSuccess'));
                          loadBotInfo();
                        }
                      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t('admin.botSetupFailed')); }
                      setBotLoading(false);
                    }} disabled={botLoading}>
                      {botLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Zap className="w-4 h-4 ml-2" />}
                      {t('admin.autoSetup')}
                    </Button>
                    <Button variant="outline" className="w-full" onClick={registerCommands} disabled={botLoading}>
                      <MessageSquare className="w-4 h-4 ml-2" />
                      {t('admin.registerOnly')}
                    </Button>
                    {missingAccessUrl && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-3">
                        <div className="flex items-center gap-2 text-red-400">
                          <Ban className="w-5 h-5 flex-shrink-0" />
                          <p className="text-sm font-bold">{t('admin.botNeedsReinvite')}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{t('admin.botNeedsReinviteDesc')} <code className="text-red-400">applications.commands</code></p>
                        <a href={missingAccessUrl || botInviteUrl} target="_blank" rel="noopener noreferrer">
                          <Button className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30">
                            <Zap className="w-4 h-4 ml-2" />
                            {t('admin.reinviteBot')}
                          </Button>
                        </a>
                        <p className="text-[10px] text-muted-foreground text-center">{t('admin.afterInvite')}</p>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Quick Actions */}
              {selectedGuild && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5 mb-4">
                  <h3 className="font-bold mb-4 flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> {t('admin.quickActions')}</h3>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)}
                        className="flex-1 h-9 rounded-md border border-border bg-secondary px-3 text-sm">
                        <option value="">{t('admin.selectChannel')}...</option>
                        {guildChannels.map(ch => (
                          <option key={ch.id} value={ch.id}>#{ch.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" disabled={!selectedChannel || botLoading}
                        onClick={async () => {
                          setBotLoading(true);
                          try {
                            const res = await fetch(`${PROXY}/bot/send-prices`, { ...botHeadersPost, method: 'POST', body: JSON.stringify({ channel_id: selectedChannel }) });
                            const data = await res.json();
                            if (data.error) throw new Error(data.error);
                            toast.success(t('admin.pricesSent'));
                          } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t('admin.sendFailed')); }
                          setBotLoading(false);
                        }}>
                        <CreditCard className="w-4 h-4 ml-1" /> {t('admin.sendPrices')}
                      </Button>
                      <Button variant="outline" className="flex-1" disabled={!selectedChannel || botLoading}
                        onClick={async () => {
                          setBotLoading(true);
                          try {
                            const res = await fetch(`${PROXY}/bot/send-ticket-panel`, { ...botHeadersPost, method: 'POST', body: JSON.stringify({ channel_id: selectedChannel }) });
                            const data = await res.json();
                            if (data.error) throw new Error(data.error);
                            toast.success(t('admin.ticketPanelSent'));
                          } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t('admin.sendFailed')); }
                          setBotLoading(false);
                        }}>
                        <Ticket className="w-4 h-4 ml-1" /> {t('admin.sendTicketPanelBtn')}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder={t('admin.announcePlaceholder')} value={announceMsg} onChange={e => setAnnounceMsg(e.target.value)} />
                      <Button className="gradient-bg text-primary-foreground" disabled={!selectedChannel || !announceMsg.trim() || botLoading}
                        onClick={async () => {
                          setBotLoading(true);
                          try {
                            const res = await fetch(`${PROXY}/bot/announce`, { ...botHeadersPost, method: 'POST', body: JSON.stringify({ channel_id: selectedChannel, message: announceMsg }) });
                            const data = await res.json();
                            if (data.error) throw new Error(data.error);
                            toast.success(t('admin.announcementSent'));
                            setAnnounceMsg('');
                          } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t('admin.sendFailed')); }
                          setBotLoading(false);
                        }}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Coupons */}
          {activeTab === 'coupons' && (
            <motion.div key="coupons" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold gradient-text">{t('admin.coupons')}</h2>
                <Button className="gradient-bg text-primary-foreground" onClick={() => setShowCouponForm(true)}>
                  <Plus className="w-4 h-4 ml-2" /> {t('admin.addCode')}
                </Button>
              </div>

              {showCouponForm && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2"><Ticket className="w-4 h-4 text-primary" /> {t('admin.newCoupon')}</h3>
                    <Button size="sm" variant="ghost" onClick={() => setShowCouponForm(false)}><X className="w-4 h-4" /></Button>
                  </div>
                  <div className="space-y-3">
                    <Input placeholder={t('admin.couponCodePlaceholder')} value={couponCode} onChange={e => setCouponCode(e.target.value)} dir="ltr" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select value={couponType} onChange={e => setCouponType(e.target.value as 'percentage' | 'fixed')}
                        className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm">
                        <option value="percentage">{t('admin.percentage')} (%)</option>
                        <option value="fixed">{t('admin.fixed')} ($)</option>
                      </select>
                      <Input type="number" placeholder={couponType === 'percentage' ? t('admin.couponTypePlaceholder') : t('admin.couponFixedPlaceholder')} value={couponValue} onChange={e => setCouponValue(e.target.value)} dir="ltr" />
                    </div>
                    <Input type="number" placeholder={t('admin.maxUsesPlaceholder')} value={couponMaxUses} onChange={e => setCouponMaxUses(e.target.value)} dir="ltr" />
                    <Button className="w-full gradient-bg text-primary-foreground" onClick={handleCreateCoupon}>
                      <Check className="w-4 h-4 ml-2" /> {t('admin.createCode')}
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
                            {t('admin.discount')} {c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`}
                            {' · '}{t('admin.usedTimes', { count: c.current_uses })} {c.max_uses ? t('admin.fromCount', { max: c.max_uses }) : t('admin.unlimited')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={c.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                          {c.is_active ? t('admin.active') : t('admin.inactive')}
                        </Badge>
                        <Switch checked={c.is_active} onCheckedChange={() => handleToggleCoupon(c.id, c.is_active)} />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => handleDeleteCoupon(c.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                  {coupons.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground"><Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>{t('admin.noCoupons')}</p></div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Payments */}
          {activeTab === 'payments' && (
            <motion.div key="payments" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold gradient-text">{t('admin.payments')}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{payments.length} {t('admin.transaction')}</Badge>
                  <Button size="sm" variant="outline" onClick={loadPayments}><Monitor className="w-4 h-4 ml-1" /> {t('admin.update')}</Button>
                </div>
              </div>

              {paymentsLoading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : payments.length > 0 ? (
                <div className="glass rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">#</th>
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">{t('admin.amount')}</th>
                          <th className="px-4 py-3 text-center text-muted-foreground font-semibold">{t('admin.status')}</th>
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">{t('admin.currency')}</th>
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">{t('admin.orderId')}</th>
                          <th className="px-4 py-3 text-right text-muted-foreground font-semibold">{t('admin.date')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p, i) => (
                          <tr key={p.id || i} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-3 font-semibold">${p.amount || p.fiat_amount || '0.00'}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={p.status === 'paid' || p.status === 'completed' ? 'bg-green-500/20 text-green-400' : p.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}>
                                {p.status === 'paid' || p.status === 'completed' ? t('admin.completed') : p.status === 'pending' ? t('admin.pending') : p.status === 'cancelled' ? t('admin.cancelled') : p.status || t('admin.unknown')}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{p.currency || 'USD'}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs font-mono" dir="ltr">{p.order_id || p.token?.substring(0, 12) || '-'}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(p.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t('admin.noPayments')}</p>
                  <p className="text-sm mt-1">{t('admin.paymentsWillAppear')}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <motion.div key="notifications" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold gradient-text">{t('admin.notifAndAnnouncements')}</h2>
                <Button className="gradient-bg text-primary-foreground" onClick={() => setShowNotifForm(true)}>
                  <Plus className="w-4 h-4 ml-2" /> {t('admin.notifNew')}
                </Button>
              </div>

              {showNotifForm && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> {t('admin.notifNew')}</h3>
                    <Button size="sm" variant="ghost" onClick={() => setShowNotifForm(false)}><X className="w-4 h-4" /></Button>
                  </div>
                  <div className="space-y-3">
                    <textarea
                      placeholder={t('admin.notifPlaceholder')}
                      value={notifMessage}
                      onChange={e => setNotifMessage(e.target.value)}
                      className="w-full h-24 rounded-md border border-border bg-secondary px-3 py-2 text-sm resize-none"
                    />
                    <div className="flex gap-2">
                      <select value={notifType} onChange={e => setNotifType(e.target.value as 'info' | 'warning' | 'success')}
                        className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm">
                        <option value="info">{t('admin.info')}</option>
                        <option value="warning">{t('admin.warning')}</option>
                        <option value="success">{t('admin.success')}</option>
                      </select>
                    </div>
                    <Button className="w-full gradient-bg text-primary-foreground" onClick={async () => {
                      if (!notifMessage.trim()) { toast.error(t('admin.enterNotifText')); return; }
                      try {
                        await (supabase as any).from('notifications').insert({
                          message: notifMessage.trim(),
                          type: notifType,
                          active: true,
                        });
                        toast.success(t('admin.notifCreated'));
                        setNotifMessage(''); setShowNotifForm(false);
                        loadNotifications();
                      } catch (e: unknown) {
                        toast.error(t('admin.notifCreateError'));
                      }
                    }}>
                      <Send className="w-4 h-4 ml-2" /> {t('admin.publishNotif')}
                    </Button>
                  </div>
                </motion.div>
              )}

              {notificationsLoading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((n, i) => (
                    <motion.div key={n.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${n.type === 'success' ? 'bg-green-500/10' : n.type === 'warning' ? 'bg-yellow-500/10' : 'bg-blue-500/10'}`}>
                          <MessageSquare className={`w-5 h-5 ${n.type === 'success' ? 'text-green-400' : n.type === 'warning' ? 'text-yellow-400' : 'text-blue-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{n.message}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(n.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={n.type === 'success' ? 'bg-green-500/20 text-green-400' : n.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}>
                          {n.type === 'success' ? t('admin.success') : n.type === 'warning' ? t('admin.warning') : t('admin.info')}
                        </Badge>
                        <Switch checked={n.active} onCheckedChange={async () => {
                          await (supabase as any).from('notifications').update({ active: !n.active }).eq('id', n.id);
                          loadNotifications();
                        }} />
                      </div>
                    </motion.div>
                  ))}
                  {notifications.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>{t('admin.noNotifs')}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Activity Logs */}
          {activeTab === 'logs' && (
            <motion.div key="logs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold gradient-text">{t('admin.logs')}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{logs.length} {t('admin.activity')}</Badge>
                  <Button size="sm" variant="outline" onClick={loadLogs}><Monitor className="w-4 h-4 ml-1" /> {t('admin.update')}</Button>
                </div>
              </div>

              {logsLoading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : logs.length > 0 ? (
                <div className="space-y-2">
                  {logs.map((log, i) => (
                    <motion.div key={log.id || i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      className="glass rounded-lg p-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        log.action_type === 'create' ? 'bg-green-500/10' :
                        log.action_type === 'delete' ? 'bg-red-500/10' :
                        log.action_type === 'update' ? 'bg-blue-500/10' :
                        log.action_type === 'login' ? 'bg-blue-500/10' : 'bg-gray-500/10'
                      }`}>
                        {log.action_type === 'create' ? <Plus className="w-4 h-4 text-green-400" /> :
                         log.action_type === 'delete' ? <Trash2 className="w-4 h-4 text-red-400" /> :
                         log.action_type === 'update' ? <Wrench className="w-4 h-4 text-blue-400" /> :
                         log.action_type === 'login' ? <UserIcon className="w-4 h-4 text-blue-400" /> :
                         <Activity className="w-4 h-4 text-gray-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{log.description || log.action_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.user_email || log.user_id?.substring(0, 8) || t('admin.system')}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(log.created_at)}</span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t('admin.noActivities')}</p>
                  <p className="text-sm mt-1">{t('admin.activitiesWillAppear')}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
