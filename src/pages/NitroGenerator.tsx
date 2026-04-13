import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Play, Square, Copy, RotateCcw, Zap, Gift, Clock, Hash,
  CheckCircle2, XCircle, Activity, Shield
} from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'nova_nitro_gen';
const CHECK_INTERVAL = 4000;

interface SessionState {
  valid: string[];
  invalid: string[];
  logs: string[];
  totalChecked: number;
  startedAt: number | null;
}

function generateNitroCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  // Discord Nitro gift codes are typically 16 or 24 characters
  const length = Math.random() > 0.5 ? 16 : 24;
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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

const checkedCodes = new Set<string>();

export default function NitroGenerator() {
  const [isRunning, setIsRunning] = useState(false);
  const [valid, setValid] = useState<string[]>([]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [totalChecked, setTotalChecked] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentCode, setCurrentCode] = useState('');
  const [activeTab, setActiveTab] = useState('valid');
  const isRunningRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state: SessionState = JSON.parse(saved);
        setValid(state.valid || []);
        setInvalid(state.invalid || []);
        setLogs(state.logs || []);
        setTotalChecked(state.totalChecked || 0);
      }
    } catch {}
  }, []);

  const saveState = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        valid, invalid, logs: logs.slice(-200), totalChecked, startedAt,
      }));
    } catch {}
  }, [valid, invalid, logs, totalChecked, startedAt]);

  useEffect(() => { saveState(); }, [saveState]);

  useEffect(() => {
    if (isRunning && startedAt) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startedAt);
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [isRunning, startedAt]);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
  }, []);

  const checkCode = useCallback(async () => {
    if (!isRunningRef.current) return;

    let code = generateNitroCode();
    while (checkedCodes.has(code)) {
      code = generateNitroCode();
    }
    checkedCodes.add(code);
    setCurrentCode(code);

    const url = `https://discord.com/api/v10/entitlements/gift-codes/${code}`;

    try {
      const res = await fetch(url, { method: 'GET' });

      if (res.status === 200) {
        // Valid code found!
        const fullLink = `https://discord.gift/${code}`;
        setValid(prev => [fullLink, ...prev]);
        addLog(`🎉 كود صالح! ${fullLink}`);
        toast.success(`تم العثور على كود نيترو صالح!`, { duration: 10000 });
      } else if (res.status === 404) {
        // Invalid/used code
        setInvalid(prev => {
          const newList = [`discord.gift/${code}`, ...prev];
          return newList.slice(0, 500);
        });
        addLog(`❌ ${code.substring(0, 8)}... - غير صالح`);
      } else if (res.status === 429) {
        // Rate limited
        addLog(`⏳ Rate limited - انتظر...`);
        await new Promise(r => setTimeout(r, 5000));
      } else {
        addLog(`⚠️ خطأ ${res.status} - ${code.substring(0, 8)}...`);
      }

      setTotalChecked(prev => prev + 1);
    } catch (err) {
      addLog(`🔴 فشل الاتصال - جاري المحاولة مرة أخرى...`);
    }
  }, [addLog]);

  useEffect(() => {
    if (isRunning) {
      isRunningRef.current = true;
      checkCode();
      intervalRef.current = setInterval(checkCode, CHECK_INTERVAL);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      isRunningRef.current = false;
    }
  }, [isRunning, checkCode]);

  const startChecking = () => {
    if (isRunning) return;
    setIsRunning(true);
    setStartedAt(Date.now());
    setElapsedTime(0);
    addLog('🚀 بدأ البحث عن أكواد نيترو...');
    toast.success('بدأ البحث!');
  };

  const stopChecking = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCurrentCode('');
    addLog('⏹️ تم إيقاف البحث');
  };

  const resetAll = () => {
    stopChecking();
    setValid([]); setInvalid([]); setLogs([]); setTotalChecked(0);
    setStartedAt(null); setElapsedTime(0); setCurrentCode('');
    checkedCodes.clear();
    localStorage.removeItem(STORAGE_KEY);
    toast.success('تم إعادة تعيين كل شيء');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('تم النسخ!');
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-3 sm:px-4" dir="rtl">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-6 sm:mb-10">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black">
              <span className="gradient-text">مولد نيترو ديسكورد</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-lg">
            أداة مجانية لتوليد وفحص أكواد نيترو ديسكورد
          </p>
          <Badge className="mt-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            ⚠️ للاستخدام التعليمي فقط
          </Badge>
        </motion.div>

        {/* Controls */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <Card className="glass p-4 sm:p-6 mb-4 sm:mb-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="flex items-center gap-2 text-sm">
                <Hash className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">فحص:</span>
                <span className="font-bold">{totalChecked.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-muted-foreground">صالح:</span>
                <span className="font-bold text-green-500">{valid.length}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-muted-foreground">غير صالح:</span>
                <span className="font-bold text-red-400">{invalid.length}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-muted-foreground">المدة:</span>
                <span className="font-bold">{formatTime(elapsedTime)}</span>
              </div>
            </div>

            {/* Current status */}
            {isRunning && currentCode && (
              <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-muted-foreground">جاري الفحص:</span>
                  <span className="font-mono font-bold text-primary text-xs">{currentCode}</span>
                </div>
              </div>
            )}

            <Separator className="my-4" />

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {!isRunning ? (
                <Button onClick={startChecking} className="gradient-bg text-primary-foreground gap-2 px-6">
                  <Play className="w-4 h-4" /> تشغيل
                </Button>
              ) : (
                <Button onClick={stopChecking} variant="destructive" className="gap-2 px-6">
                  <Square className="w-4 h-4" /> إيقاف
                </Button>
              )}
              <Button onClick={resetAll} variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" /> إعادة تعيين
              </Button>
              <div className="flex-1" />
              <Button onClick={() => valid.length > 0 ? copyToClipboard(valid.join('\n')) : toast.error('لا يوجد أكواد صالحة')}
                variant="outline" className="gap-2" disabled={valid.length === 0}>
                <Copy className="w-4 h-4" /> نسخ الصالحة ({valid.length})
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Results */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="glass w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="valid" className="gap-2">
                <Gift className="w-4 h-4" /> صالحة
                {valid.length > 0 && <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{valid.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="invalid" className="gap-2">
                <XCircle className="w-4 h-4" /> غير صالحة
                {invalid.length > 0 && <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{invalid.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-2">
                <Activity className="w-4 h-4" /> السجل
              </TabsTrigger>
            </TabsList>

            <TabsContent value="valid">
              <Card className="glass p-4">
                {valid.length > 0 ? (
                  <div className="space-y-2">
                    {valid.map((code, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                        <div className="flex items-center gap-2">
                          <Gift className="w-4 h-4 text-green-400" />
                          <span className="font-mono text-sm text-green-400" dir="ltr">{code}</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(code)}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>لم يتم العثور على أكواد صالحة بعد</p>
                    <p className="text-xs mt-1">شغّل المولد وانتظر...</p>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="invalid">
              <Card className="glass p-4 max-h-[400px] overflow-y-auto">
                {invalid.length > 0 ? (
                  <div className="space-y-1">
                    {invalid.map((code, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded text-xs text-muted-foreground font-mono" dir="ltr">
                        <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                        {code}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <XCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>لا يوجد أكواد مفحوصة</p>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="logs">
              <Card className="glass p-4 max-h-[400px] overflow-y-auto font-mono text-xs">
                {logs.length > 0 ? (
                  <div className="space-y-1">
                    {logs.map((log, i) => (
                      <div key={i} className="text-muted-foreground">{log}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>لا يوجد سجلات</p>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
