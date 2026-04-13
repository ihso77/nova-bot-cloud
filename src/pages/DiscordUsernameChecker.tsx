import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Play, Square, Copy, RotateCcw, Trash2, UserCheck, UserX,
  Activity, Clock, Hash, Zap, Shield, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

const PROXY_URL = 'https://proxy-production-a7b5.up.railway.app';
const CHECK_INTERVAL = 3000; // 3 seconds
const MAX_SESSION_HOURS = 12;
const STORAGE_KEY = 'nova_discord_checker';

interface SessionState {
  available: string[];
  unavailable: string[];
  logs: string[];
  totalChecked: number;
  startedAt: number | null;
  length: number;
}

// Characters used for generating usernames
const CHARSET_ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const CHARSET_ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';
const RESERVED_NAMES = ['admin', 'everyone', 'here', 'discord', 'test', 'info', 'help', 'news'];

// Track already checked usernames to avoid duplicates
const checkedSet = new Set<string>();

function isValidDiscordUsername(name: string): boolean {
  if (name.length < 2 || name.length > 32) return false;
  if (/^[_.]/.test(name)) return false;
  if (/[_.]$/.test(name)) return false;
  if (/[_.]{2}/.test(name)) return false;
  if (!/^[a-zA-Z0-9_.]+$/.test(name)) return false;
  if (RESERVED_NAMES.includes(name.toLowerCase())) return false;
  return true;
}

// Systematic generator: produces all combos for given length
function generateUsername(length: number): string {
  // Try up to 50 times to get a unique username
  for (let attempt = 0; attempt < 50; attempt++) {
    let username = '';
    // First char: letter only
    username += CHARSET_ALPHA[Math.floor(Math.random() * CHARSET_ALPHA.length)];

    // Middle chars: allow letters, digits (no special chars for short usernames to increase availability)
    for (let i = 1; i < length - 1; i++) {
      username += CHARSET_ALNUM[Math.floor(Math.random() * CHARSET_ALNUM.length)];
    }

    // Last char: letter or digit
    if (length > 1) {
      username += CHARSET_ALNUM[Math.floor(Math.random() * CHARSET_ALNUM.length)];
    }

    if (isValidDiscordUsername(username) && !checkedSet.has(username)) {
      checkedSet.add(username);
      return username;
    }
  }
  // Fallback: just random
  let fallback = '';
  for (let i = 0; i < length; i++) {
    fallback += CHARSET_ALPHA[Math.floor(Math.random() * CHARSET_ALPHA.length)];
  }
  checkedSet.add(fallback);
  return fallback;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}س ${m}د ${s}ث`;
  if (m > 0) return `${m}د ${s}ث`;
  return `${s}ث`;
}

export default function DiscordUsernameChecker() {
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const [length, setLength] = useState(4);
  const [available, setAvailable] = useState<string[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [totalChecked, setTotalChecked] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [errorCount, setErrorCount] = useState(0);
  const errorCountRef = useRef(0);
  const [activeTab, setActiveTab] = useState('available');

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const lengthRef = useRef(4);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state: SessionState = JSON.parse(saved);
        setAvailable(state.available || []);
        setUnavailable(state.unavailable || []);
        setLogs(state.logs || []);
        setTotalChecked(state.totalChecked || 0);
        setLength(state.length || 4);

        // If session was running and not expired, resume it
        if (state.startedAt) {
          const elapsed = Date.now() - state.startedAt;
          if (elapsed < MAX_SESSION_HOURS * 60 * 60 * 1000) {
            setStartedAt(state.startedAt);
            setElapsedTime(elapsed);
            setIsRunning(true);
          } else {
            // Session expired (12+ hours)
            addLog('الجلسة السابقة انتهت (أكثر من 12 ساعة)');
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load saved state:', e);
    }
  }, []);

  // Save state to localStorage whenever it changes
  const saveState = useCallback(() => {
    try {
      const state: SessionState = {
        available,
        unavailable,
        logs: logs.slice(-200), // Keep last 200 logs
        totalChecked,
        startedAt,
        length,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }, [available, unavailable, logs, totalChecked, startedAt, length]);

  useEffect(() => {
    saveState();
  }, [saveState]);

  // Timer for elapsed time and 12-hour auto-stop
  useEffect(() => {
    if (isRunning && startedAt) {
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        setElapsedTime(elapsed);

        if (elapsed >= MAX_SESSION_HOURS * 60 * 60 * 1000) {
          stopChecking();
          addLog('تم الإيقاف تلقائياً - تجاوزت 12 ساعة من الفحص المستمر');
          toast.warning('تم إيقاف الفحص تلقائياً (12 ساعة)');
        }
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [isRunning, startedAt]);

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, `[${time}] ${message}`]);
  }, []);

  // Main checking logic - use refs to avoid dependency issues
  const checkUsername = useCallback(async () => {
    if (!isRunningRef.current) return;

    const username = generateUsername(lengthRef.current);
    setCurrentUsername(username);

    try {
      const res = await fetch(`${PROXY_URL}/discord-check?username=${encodeURIComponent(username)}`);

      if (!res.ok) {
        errorCountRef.current += 1;
        setErrorCount(errorCountRef.current);
        addLog(`خطأ في الاتصال: ${username}`);
        return;
      }

      const data = await res.json();

      if (data.available) {
        setAvailable(prev => [username, ...prev]);
        addLog(`✅ ${username} - متاح!`);
        toast.success(`${username} متاح!`, { duration: 5000 });
      } else {
        setUnavailable(prev => {
          const newList = [username, ...prev];
          return newList.slice(0, 500);
        });
        addLog(`❌ ${username} - غير متاح`);
      }

      setTotalChecked(prev => prev + 1);
      errorCountRef.current = 0;
      setErrorCount(0);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
      errorCountRef.current += 1;
      setErrorCount(errorCountRef.current);
      addLog(`فشل الاتصال: ${msg}`);

      if (errorCountRef.current >= 5) {
        stopChecking();
        addLog('تم الإيقاف بسبب أخطاء متتالية في الاتصال');
        toast.error('تم الإيقاف بسبب مشاكل في الاتصال');
      }
    }
  }, [addLog]);

  // Auto-check interval - only depends on isRunning, not checkUsername
  useEffect(() => {
    if (isRunning) {
      isRunningRef.current = true;
      checkUsername();
      intervalRef.current = setInterval(checkUsername, CHECK_INTERVAL);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      isRunningRef.current = false;
    }
  }, [isRunning, checkUsername]);

  const startChecking = () => {
    if (isRunning) return;

    const now = Date.now();
    isRunningRef.current = true;
    errorCountRef.current = 0;
    setIsRunning(true);
    setStartedAt(now);
    setElapsedTime(0);
    setErrorCount(0);
    addLog(`بدء الفحص - طول اليوزر: ${length} حروف`);
    toast.success('بدأ الفحص!');
  };

  const stopChecking = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCurrentUsername('');
  };

  const resetAll = () => {
    stopChecking();
    setAvailable([]);
    setUnavailable([]);
    setLogs([]);
    setTotalChecked(0);
    setStartedAt(null);
    setElapsedTime(0);
    setErrorCount(0);
    setCurrentUsername('');
    localStorage.removeItem(STORAGE_KEY);
    toast.success('تم إعادة تعيين كل شيء');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('تم النسخ!');
  };

  const copyAvailableList = () => {
    if (available.length === 0) {
      toast.error('لا يوجد يوزرات متاحة للنسخ');
      return;
    }
    copyToClipboard(available.join('\n'));
  };

  const copyAllUnavailable = () => {
    if (unavailable.length === 0) {
      toast.error('لا يوجد يوزرات للنسخ');
      return;
    }
    copyToClipboard(unavailable.join('\n'));
  };

  // Auto-scroll logs
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs]);

  const lengthOptions = [3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-3 sm:px-4" dir="rtl">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-6 sm:mb-10"
        >
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black">
              <span className="gradient-text">فاحص يوزرات ديسكورد</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-lg">
            أداة مجانية للبحث عن يوزرات ديسكورد غير مستخدمة
          </p>
        </motion.div>

        {/* Controls Panel */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass p-4 sm:p-6 mb-4 sm:mb-6">
            {/* Length Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-3 text-muted-foreground">
                عدد حروف اليوزر المطلوب
              </label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {lengthOptions.map(len => (
                  <Button
                    key={len}
                    variant={length === len ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (isRunning) {
                        toast.error('أوقف الفحص أولاً قبل تغيير الطول');
                        return;
                      }
                      setLength(len);
                    }}
                    className={length === len ? 'gradient-bg text-primary-foreground min-w-[50px]' : 'min-w-[50px]'}
                  >
                    {len}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="my-4" />

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="flex items-center gap-2 text-sm">
                <Hash className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">إجمالي الفحص:</span>
                <span className="font-bold">{totalChecked.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-muted-foreground">متاح:</span>
                <span className="font-bold text-green-500">{available.length}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <UserX className="w-4 h-4 text-red-400" />
                <span className="text-muted-foreground">غير متاح:</span>
                <span className="font-bold text-red-400">{unavailable.length}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-muted-foreground">المدة:</span>
                <span className="font-bold">{formatTime(elapsedTime)}</span>
              </div>
            </div>

            {/* Current checking status */}
            {isRunning && currentUsername && (
              <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-muted-foreground">جاري الفحص:</span>
                  <span className="font-mono font-bold text-primary">{currentUsername}</span>
                </div>
              </div>
            )}

            {!isRunning && startedAt && (
              <div className="mb-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-yellow-600">
                    الفحص متوقف - اضغط تشغيل للاستمرار
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {!isRunning ? (
                <Button
                  onClick={startChecking}
                  className="gradient-bg text-primary-foreground gap-2 px-6"
                >
                  <Play className="w-4 h-4" />
                  تشغيل
                </Button>
              ) : (
                <Button
                  onClick={stopChecking}
                  variant="destructive"
                  className="gap-2 px-6"
                >
                  <Square className="w-4 h-4" />
                  إيقاف
                </Button>
              )}

              <Button
                onClick={resetAll}
                variant="outline"
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                إعادة تعيين
              </Button>

              <div className="flex-1" />

              <Button
                onClick={copyAvailableList}
                variant="outline"
                className="gap-2"
                disabled={available.length === 0}
              >
                <Copy className="w-4 h-4" />
                نسخ المتاح ({available.length})
              </Button>
              <Button
                onClick={copyAllUnavailable}
                variant="outline"
                className="gap-2"
                disabled={unavailable.length === 0}
              >
                <Copy className="w-4 h-4" />
                نسخ غير المتاح
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Results Tabs */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="glass w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="available" className="gap-2">
                <UserCheck className="w-4 h-4" />
                متاح
                {available.length > 0 && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    {available.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unavailable" className="gap-2">
                <UserX className="w-4 h-4" />
                غير متاح
                {unavailable.length > 0 && (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    {unavailable.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-2">
                <Activity className="w-4 h-4" />
                السجل
                {logs.length > 0 && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {logs.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Available Tab */}
            <TabsContent value="available">
              <Card className="glass p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    اليوزرات المتاحة
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAvailable([]);
                      toast.success('تم مسح قائمة المتاح');
                    }}
                    className="text-red-400 hover:text-red-300 gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    مسح
                  </Button>
                </div>

                {available.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>لم يتم العثور على يوزرات متاحة بعد</p>
                    <p className="text-sm mt-1">شغّل الفحص للبدء</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px] sm:h-[400px]">
                    <div className="space-y-1.5">
                      {available.map((username, i) => (
                        <motion.div
                          key={`${username}-${i}`}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-green-500/5 border border-green-500/10 hover:bg-green-500/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="font-mono font-semibold text-green-400">{username}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(Date.now() - (available.length - i) * CHECK_INTERVAL).toLocaleTimeString('ar-SA')}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(username)}
                              className="h-7 w-7 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </Card>
            </TabsContent>

            {/* Unavailable Tab */}
            <TabsContent value="unavailable">
              <Card className="glass p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <UserX className="w-5 h-5 text-red-400" />
                    اليوزرات غير المتاحة
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUnavailable([]);
                      toast.success('تم مسح قائمة غير المتاح');
                    }}
                    className="text-red-400 hover:text-red-300 gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    مسح
                  </Button>
                </div>

                {unavailable.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <UserX className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>لا يوجد يوزرات في القائمة</p>
                    <p className="text-sm mt-1">اليوزرات المستخدمة ستظهر هنا</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px] sm:h-[400px]">
                    <div className="space-y-1">
                      {unavailable.map((username, i) => (
                        <div
                          key={`${username}-${i}`}
                          className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/5 text-sm"
                        >
                          <span className="font-mono text-muted-foreground">{username}</span>
                          <span className="text-xs text-red-400/60">مستخدم</span>
                        </div>
                      ))}
                    </div>
                    {unavailable.length >= 500 && (
                      <p className="text-center text-xs text-muted-foreground mt-2">
                        يظهر آخر 500 يوزر فقط
                      </p>
                    )}
                  </ScrollArea>
                )}
              </Card>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs">
              <Card className="glass p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    سجل العمليات
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLogs([]);
                      toast.success('تم مسح السجل');
                    }}
                    className="text-red-400 hover:text-red-300 gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    مسح
                  </Button>
                </div>

                <div
                  ref={logScrollRef}
                  className="h-[400px] overflow-y-auto font-mono text-sm space-y-0.5 bg-black/20 rounded-lg p-3"
                >
                  {logs.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground font-sans">
                      <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>لا يوجد سجلات بعد</p>
                      <p className="text-sm mt-1">العمليات ستُسجّل هنا تلقائياً</p>
                    </div>
                  ) : (
                    logs.map((log, i) => (
                      <div
                        key={i}
                        className={`text-xs leading-relaxed ${
                          log.includes('✅')
                            ? 'text-green-400'
                            : log.includes('❌')
                            ? 'text-red-400/70'
                            : log.includes('خطأ') || log.includes('فشل') || log.includes('إيقاف')
                            ? 'text-yellow-500'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Info Section */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <Card className="glass p-4 sm:p-6">
            <h3 className="font-bold mb-3 sm:mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              كيف تعمل الأداة؟
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <p className="mb-2">
                  تقوم الأداة بتوليد يوزرات ديسكورد عشوائية بطول محدد ثم تفحصها عبر
                  API ديسكورد الرسمي لمعرفة إن كانت متاحة أو لا.
                </p>
                <p className="mb-2">
                  اليوزرات المتاحة (غير مستخدمة) تظهر في قائمة المتاح مباشرة، و
                  اليوزرات المستخدمة تروح لقائمة غير المتاح.
                </p>
              </div>
              <div>
                <p className="mb-2">
                  الفحص يستمر شغال حتى لو طلعت من الصفحة و ترجع، والبيانات محفوظة
                  في المتصفح. يتوقف تلقائياً بعد 12 ساعة متواصلة.
                </p>
                <p>
                  الأداة تولّد يوزرات تحتوي على حروف، أرقام، شرطات سفلية (_)، ونقاط (.)
                  مع الالتزام بقوانين ديسكورد لليوزرات.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
