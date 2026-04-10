import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Play, Square, Plus, FileText, Trash2, Save, Upload, Terminal, X, Edit3,
  Eye, EyeOff, Copy, Download, RotateCcw, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Loader2, Code2, Zap, FileCode2, FolderOpen,
  Timer, Activity, Shield,
} from 'lucide-react';

const PROXY_URL = 'https://proxy-production-a7b5.up.railway.app';

interface ProjectFile {
  id: string;
  file_name: string;
  file_path: string;
  content: string;
}

interface Project {
  id: string;
  name: string;
  language: string;
  status: string;
  railway_service_id: string | null;
}

interface ConsoleLog {
  id: string;
  type: string;
  text: string;
  time: string;
}

function extractToken(code: string, language: string): string | null {
  if (language === 'python') {
    const m = code.match(/bot\.run\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
    if (m) return m[1];
    const m2 = code.match(/['"`]([^'"`]{50,})['"`]/);
    return m2 ? m2[1] : null;
  }
  // JS/TS - look for client.login, bot.login
  const patterns = [
    /\.login\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/,
    /\.login\s*\(\s*(['"`])([^'"`]+)\1\s*\)/,
    /token\s*[:=]\s*['"`]([^'"`]{50,})['"`]/,
    /TOKEN\s*[:=]\s*['"`]([^'"`]{50,})['"`]/,
    /['"`]([A-Za-z0-9._-]{50,}\.[A-Za-z0-9_-]{20,})['"`]/,
  ];
  for (const p of patterns) {
    const m = code.match(p);
    if (m) return m[1];
  }
  return null;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  const colors: Record<string, string> = {
    js: 'text-yellow-400', ts: 'text-blue-400', py: 'text-green-400',
    json: 'text-yellow-500', md: 'text-gray-400', txt: 'text-gray-300',
    env: 'text-orange-400', yml: 'text-pink-400', yaml: 'text-pink-400',
  };
  return colors[ext || ''] || 'text-gray-400';
}

function getSyntaxLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: 'javascript', ts: 'typescript', py: 'python', json: 'json',
    yml: 'yaml', yaml: 'yaml', md: 'markdown', txt: 'text', env: 'bash',
    sh: 'bash', html: 'html', css: 'css',
  };
  return map[ext || ''] || 'text';
}

function lineCount(s: string): number {
  return s ? s.split('\n').length : 1;
}

export default function ProjectEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [showConsole, setShowConsole] = useState(true);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployStatus, setDeployStatus] = useState('');
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManualToken, setShowManualToken] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(200);
  const [isDraggingConsole, setIsDraggingConsole] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);
  const logIdRef = useRef(0);

  useEffect(() => {
    if (!id || !user) return;
    loadProject();
    loadFiles();
  }, [id, user]);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [consoleLogs]);

  // Detect token from code
  const detectedToken = selectedFile ? extractToken(editorContent || '', project?.language || '') : null;

  // Auto-save indicator
  useEffect(() => {
    if (selectedFile && editorContent !== selectedFile.content) {
      setHasUnsaved(true);
    } else {
      setHasUnsaved(false);
    }
  }, [editorContent, selectedFile]);

  const loadProject = async () => {
    const { data } = await supabase.from('projects').select('*').eq('id', id!).single();
    if (data) {
      setProject(data);
      setProjectName(data.name);
    }
  };

  const loadFiles = async () => {
    const { data } = await supabase.from('project_files').select('*').eq('project_id', id!).order('file_name');
    if (data) {
      setFiles(data);
      if (data.length > 0 && !selectedFile) {
        setSelectedFile(data[0]);
        setEditorContent(data[0].content || '');
      }
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    const { error } = await supabase
      .from('project_files')
      .update({ content: editorContent })
      .eq('id', selectedFile.id);
    if (error) toast.error('خطأ في الحفظ');
    else {
      toast.success('تم الحفظ');
      setHasUnsaved(false);
      setSelectedFile(prev => prev ? { ...prev, content: editorContent } : null);
    }
  };

  const addLog = useCallback((type: string, text: string) => {
    logIdRef.current++;
    setConsoleLogs(prev => [...prev, { id: String(logIdRef.current), type, text, time: new Date().toLocaleTimeString('ar-SA') }]);
  }, []);

  const pollDeployStatus = useCallback(async (serviceId: string) => {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      setDeployProgress(Math.min(90, ((i + 1) / maxAttempts) * 100));

      try {
        const res = await fetch(`${PROXY_URL}/status?serviceId=${serviceId}`);
        const data = await res.json();

        if (data.status === 'SUCCESS') {
          setDeployProgress(100);
          addLog('success', '✅ تم تشغيل البوت بنجاح!');
          if (data.logs?.length) {
            for (const l of data.logs) {
              if (l.severity === 'error') addLog('error', l.message);
              else addLog('info', l.message);
            }
          }
          addLog('info', '🤖 البوت جاهز للاستخدام في Discord');
          return 'SUCCESS';
        }

        if (data.status === 'CRASHED') {
          addLog('error', '❌ فشل تشغيل البوت');
          if (data.logs?.length) {
            addLog('info', '📋 تفاصيل الخطأ:');
            for (const l of data.logs) {
              addLog(l.severity === 'error' ? 'error' : 'warning', `  ${l.message}`);
            }
          }
          return 'CRASHED';
        }

        if (data.status === 'BUILDING' || data.status === 'DEPLOYING') {
          setDeployStatus(i < 3 ? 'جاري بناء الصورة...' : i < 6 ? 'جاري تثبيت الحزم...' : 'جاري تشغيل البوت...');
        }
      } catch {
        // network error - continue polling
      }
    }
    addLog('warning', '⏰ استغرقت العملية وقتاً طويلاً، تحقق من حالة البوت لاحقاً');
    return 'TIMEOUT';
  }, [addLog]);

  const handleStartBot = async () => {
    if (!project || !user) return;

    // Try to get token from code first
    const allFilesContent = files.map(f => f.content || '').join('\n');
    const codeToken = extractToken(allFilesContent, project.language);

    if (!codeToken && !manualToken.trim()) {
      setShowTokenDialog(true);
      toast.error('لم يتم العثور على توكن في الكود، أدخل التوكن يدوياً');
      return;
    }

    const botToken = codeToken || manualToken.trim();

    if (botToken.length < 50) {
      setShowTokenDialog(true);
      toast.error('توكن Discord غير صالح');
      return;
    }

    setIsDeploying(true);
    setDeployProgress(0);
    setDeployStatus('جاري التحضير...');

    addLog('info', '🚀 جاري بدء النشر...');

    // Auto-save current file
    if (selectedFile && hasUnsaved) {
      await supabase.from('project_files').update({ content: editorContent }).eq('id', selectedFile.id);
      addLog('info', '💾 تم حفظ الملفات تلقائياً');
    }

    await supabase.from('projects').update({ status: 'deploying' }).eq('id', project.id);
    setProject(prev => prev ? { ...prev, status: 'deploying' } : null);

    try {
      // Reload all files from DB to get latest
      const { data: allFiles } = await supabase
        .from('project_files')
        .select('file_name, content')
        .eq('project_id', id!);

      if (!allFiles || allFiles.length === 0) {
        addLog('error', '❌ لا توجد ملفات في المشروع');
        await supabase.from('projects').update({ status: 'error' }).eq('id', project.id);
        setProject(prev => prev ? { ...prev, status: 'error' } : null);
        setIsDeploying(false);
        return;
      }

      const mainFile = allFiles.find(f =>
        f.file_name === 'index.js' || f.file_name === 'index.ts' ||
        f.file_name === 'bot.py' || f.file_name === 'main.py' ||
        f.file_name === 'main.js' || f.file_name === 'main.ts'
      );

      if (!mainFile) {
        addLog('error', '❌ لا يوجد ملف رئيسي (index.js أو bot.py)');
        await supabase.from('projects').update({ status: 'error' }).eq('id', project.id);
        setProject(prev => prev ? { ...prev, status: 'error' } : null);
        setIsDeploying(false);
        return;
      }

      const code = mainFile.content || '';

      setDeployProgress(10);
      setDeployStatus('جاري الاتصال بالخادم...');

      const proxyRes = await fetch(`${PROXY_URL}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botName: project.name,
          botToken,
          language: project.language,
          code,
        }),
        signal: AbortSignal.timeout(30000),
      });

      const proxyData = await proxyRes.json();

      if (!proxyRes.ok || proxyData.error) {
        addLog('error', `❌ خطأ: ${proxyData.error || 'خطأ غير معروف'}`);
        await supabase.from('projects').update({ status: 'error' }).eq('id', project.id);
        setProject(prev => prev ? { ...prev, status: 'error' } : null);
        setIsDeploying(false);
        return;
      }

      const serviceId = proxyData.serviceId;
      setDeployProgress(30);
      setDeployStatus('جاري بناء البوت...');

      if (serviceId) {
        await supabase.from('projects').update({ railway_service_id: serviceId }).eq('id', project.id);
        setProject(prev => prev ? { ...prev, railway_service_id: serviceId } : null);

        const result = await pollDeployStatus(serviceId);

        if (result === 'SUCCESS') {
          await supabase.from('projects').update({ status: 'running' }).eq('id', project.id);
          setProject(prev => prev ? { ...prev, status: 'running' } : null);
        } else {
          await supabase.from('projects').update({ status: 'error' }).eq('id', project.id);
          setProject(prev => prev ? { ...prev, status: 'error' } : null);
        }
      }
    } catch (err: any) {
      addLog('error', `❌ خطأ: ${err.message}`);
      await supabase.from('projects').update({ status: 'error' }).eq('id', project.id);
      setProject(prev => prev ? { ...prev, status: 'error' } : null);
    }

    setIsDeploying(false);
    setDeployProgress(0);
    setDeployStatus('');
  };

  const handleStopBot = async () => {
    if (!project || !user) return;
    addLog('warning', '⏹️ جاري إيقاف البوت...');
    setIsDeploying(true);

    try {
      if (project.railway_service_id) {
        const proxyRes = await fetch(`${PROXY_URL}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId: project.railway_service_id }),
          signal: AbortSignal.timeout(15000),
        });

        if (proxyRes.ok) {
          addLog('success', '✅ تم إيقاف البوت');
        } else {
          addLog('warning', '⚠️ حدث خطأ أثناء الإيقاف');
        }
      } else {
        addLog('success', '✅ تم إيقاف البوت');
      }

      await supabase.from('projects').update({ status: 'stopped', railway_service_id: null }).eq('id', project.id);
      setProject(prev => prev ? { ...prev, status: 'stopped', railway_service_id: null } : null);
    } catch (err: any) {
      await supabase.from('projects').update({ status: 'stopped', railway_service_id: null }).eq('id', project.id);
      setProject(prev => prev ? { ...prev, status: 'stopped', railway_service_id: null } : null);
      addLog('success', '✅ تم إيقاف البوت');
    }
    setIsDeploying(false);
  };

  const handleSaveManualToken = () => {
    if (!manualToken.trim()) {
      toast.error('الرجاء إدخال التوكن');
      return;
    }
    if (manualToken.trim().length < 50) {
      toast.error('توكن Discord غير صالح');
      return;
    }
    setShowTokenDialog(false);
    toast.success('تم حفظ التوكن');
  };

  const createFile = async () => {
    if (!newFileName.trim() || !id) return;
    const { data, error } = await supabase
      .from('project_files')
      .insert({ project_id: id, file_name: newFileName.trim(), file_path: '/', content: '' })
      .select()
      .single();
    if (data) {
      setFiles(prev => [...prev, data]);
      setSelectedFile(data);
      setEditorContent('');
      setNewFileName('');
      setShowNewFile(false);
      toast.success('تم إنشاء الملف');
    }
  };

  const deleteFile = async (fileId: string) => {
    await supabase.from('project_files').delete().eq('id', fileId);
    setFiles(prev => prev.filter(f => f.id !== fileId));
    if (selectedFile?.id === fileId) {
      setSelectedFile(null);
      setEditorContent('');
    }
    toast.success('تم حذف الملف');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const importedFiles = e.target.files;
    if (!importedFiles) return;
    Array.from(importedFiles).forEach(file => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const content = ev.target?.result as string;
        const { data } = await supabase
          .from('project_files')
          .insert({ project_id: id!, file_name: file.name, file_path: '/', content })
          .select()
          .single();
        if (data) {
          setFiles(prev => [...prev, data]);
          toast.success(`تم استيراد ${file.name}`);
        }
      };
      reader.readAsText(file);
    });
  };

  const updateProjectName = async () => {
    if (!project || !projectName.trim()) return;
    await supabase.from('projects').update({ name: projectName.trim() }).eq('id', project.id);
    setProject({ ...project, name: projectName.trim() });
    setEditingName(false);
    toast.success('تم تحديث الاسم');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(editorContent);
    toast.success('تم نسخ الكود');
  };

  const handleDownloadFile = () => {
    if (!selectedFile) return;
    const blob = new Blob([editorContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadProject = async () => {
    const { data: allFiles } = await supabase.from('project_files').select('file_name, content').eq('project_id', id!);
    if (!allFiles?.length) return;

    if (allFiles.length === 1) {
      const blob = new Blob([allFiles[0].content || ''], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = allFiles[0].file_name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Create simple zip-like text
      const content = allFiles.map(f => `===== ${f.file_name} =====\n${f.content || ''}`).join('\n\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name || 'project'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast.success('تم تحميل المشروع');
  };

  const handleFormatCode = () => {
    // Basic JS/Python formatting (trim trailing spaces, normalize line endings)
    const formatted = editorContent
      .split('\n')
      .map(l => l.trimEnd())
      .join('\n')
      .replace(/\n{4,}/g, '\n\n\n');
    setEditorContent(formatted);
    toast.success('تم تنسيق الكود');
  };

  // Console resize
  const handleConsoleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingConsole(true);
    dragStartY.current = e.clientY;
    dragStartH.current = consoleHeight;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingConsole) return;
      const diff = dragStartY.current - e.clientY;
      const newH = Math.max(100, Math.min(500, dragStartH.current + diff));
      setConsoleHeight(newH);
    };
    const onUp = () => setIsDraggingConsole(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDraggingConsole]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedFile, editorContent]);

  const logColors: Record<string, string> = {
    info: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };

  const logIcons: Record<string, typeof Terminal> = {
    info: Terminal,
    success: CheckCircle2,
    warning: AlertCircle,
    error: AlertCircle,
  };

  const statusBadge = (() => {
    if (isDeploying) return { color: 'text-yellow-400 bg-yellow-400/10', label: deployStatus || 'جاري النشر...' };
    if (project?.status === 'running') return { color: 'text-green-400 bg-green-400/10', label: 'يعمل' };
    if (project?.status === 'error') return { color: 'text-red-400 bg-red-400/10', label: 'خطأ' };
    return { color: 'text-gray-400 bg-gray-400/10', label: 'متوقف' };
  })();

  if (!project) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-screen pt-16 flex flex-col" dir="rtl">
      {/* Top Toolbar */}
      <div className="glass border-b border-border/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input value={projectName} onChange={e => setProjectName(e.target.value)} className="h-8 w-48 bg-secondary" onKeyDown={e => e.key === 'Enter' && updateProjectName()} />
              <Button size="sm" variant="ghost" onClick={updateProjectName}><Save className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              <h2 className="font-bold">{project.name}</h2>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(true)}><Edit3 className="w-3 h-3" /></Button>
            </div>
          )}
          <Badge variant="secondary" className="gap-1">
            <Code2 className="w-3 h-3" />
            {project.language}
          </Badge>
          <Badge variant="outline" className={statusBadge.color}>
            <span className={`w-1.5 h-1.5 rounded-full ${isDeploying ? 'bg-yellow-400 animate-pulse' : project.status === 'running' ? 'bg-green-400' : project.status === 'error' ? 'bg-red-400' : 'bg-gray-400'}`} />
            {statusBadge.label}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Token indicator */}
          {detectedToken ? (
            <Button size="sm" variant="ghost" className="text-green-400 hover:text-green-300 text-xs gap-1" title="تم العثور على التوكن في الكود">
              <Shield className="w-3.5 h-3.5" />
              توكن متوفر
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="text-orange-400 hover:text-orange-300 text-xs gap-1" onClick={() => setShowTokenDialog(true)} title="أدخل التوكن يدوياً">
              <Shield className="w-3.5 h-3.5" />
              أدخل التوكن
            </Button>
          )}

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowConsole(!showConsole)} title={showConsole ? 'إخفاء الكونسول' : 'عرض الكونسول'}>
            <Terminal className="w-4 h-4" />
          </Button>

          {project.status === 'running' || isDeploying ? (
            <Button size="sm" variant="destructive" onClick={handleStopBot} disabled={isDeploying} className="gap-1">
              <Square className="w-4 h-4" /> إيقاف
            </Button>
          ) : (
            <Button size="sm" className="gradient-bg text-primary-foreground gap-1" onClick={handleStartBot}>
              <Play className="w-4 h-4" /> تشغيل
            </Button>
          )}
        </div>
      </div>

      {/* Deploy Progress Bar */}
      <AnimatePresence>
        {isDeploying && deployProgress > 0 && (
          <motion.div initial={{ height: 0 }} animate={{ height: 32 }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 h-8 bg-secondary/30 border-b border-border/30">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">{deployStatus}</span>
              <div className="flex-1 max-w-xs">
                <Progress value={deployProgress} className="h-1.5" />
              </div>
              <span className="text-xs text-muted-foreground">{Math.round(deployProgress)}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer */}
        <div className="w-56 glass border-l border-border/30 flex flex-col">
          <div className="p-3 border-b border-border/30 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">الملفات</span>
            <div className="flex gap-0.5">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowNewFile(true)} title="ملف جديد">
                <Plus className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => fileInputRef.current?.click()} title="استيراد ملف">
                <Upload className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleDownloadProject} title="تحميل المشروع">
                <Download className="w-3 h-3" />
              </Button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileImport} />
            </div>
          </div>

          {showNewFile && (
            <div className="p-2 border-b border-border/30 flex gap-1">
              <Input
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                placeholder="اسم الملف.js"
                className="h-7 text-xs bg-secondary"
                onKeyDown={e => e.key === 'Enter' && createFile()}
                autoFocus
              />
              <Button size="sm" className="h-7 px-2" onClick={createFile}>+</Button>
              <Button size="sm" variant="ghost" className="h-7 px-1" onClick={() => { setShowNewFile(false); setNewFileName(''); }}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {files.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                <FileCode2 className="w-6 h-6 mx-auto mb-2 opacity-50" />
                لا توجد ملفات
              </div>
            ) : (
              files.map(file => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors group ${
                    selectedFile?.id === file.id ? 'bg-primary/10 border-r-2 border-primary' : 'hover:bg-secondary/50'
                  }`}
                  onClick={() => { setSelectedFile(file); setEditorContent(file.content || ''); }}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${getFileIcon(file.file_name)}`} />
                    <span className="text-sm truncate">{file.file_name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Stats footer */}
          <div className="p-2 border-t border-border/30 text-xs text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>{files.length} ملف</span>
              <span>{selectedFile ? lineCount(editorContent) : 0} سطر</span>
            </div>
            <div className="flex justify-between">
              <span>{editorContent.length} حرف</span>
              {hasUnsaved && <span className="text-yellow-400">● غير محفوظ</span>}
            </div>
          </div>
        </div>

        {/* Editor + Console */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor */}
          <div className="flex-1 relative min-h-0">
            {selectedFile ? (
              <>
                {/* Editor toolbar */}
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-1.5 bg-background/80 backdrop-blur-sm border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <FileText className={`w-3.5 h-3.5 ${getFileIcon(selectedFile.file_name)}`} />
                    <span className="text-xs font-medium">{selectedFile.file_name}</span>
                    {hasUnsaved && <span className="text-yellow-400 text-xs">●</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={() => setWordWrap(!wordWrap)} title="التفاف النص">
                      <RotateCcw className="w-3 h-3" />
                      {wordWrap ? 'لف' : 'عادي'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={handleFormatCode} title="تنسيق الكود">
                      <Code2 className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={handleCopyCode} title="نسخ">
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={handleDownloadFile} title="تحميل">
                      <Download className="w-3 h-3" />
                    </Button>
                    <Separator orientation="vertical" className="h-4" />
                    <Button size="sm" onClick={saveFile} className="gradient-bg text-primary-foreground h-6 text-xs px-3 gap-1">
                      <Save className="w-3 h-3" /> حفظ
                    </Button>
                    <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Ctrl+S</span>
                  </div>
                </div>

                {/* Code display with syntax highlighting overlay */}
                <div className="w-full h-full bg-[#1e1e2e] pt-10" dir="ltr">
                  <div className="flex h-full">
                    {/* Line numbers */}
                    <div className="select-none text-right pr-4 pl-2 py-2 text-muted-foreground/40 text-sm font-mono leading-relaxed border-l border-border/20 min-w-[3rem]">
                      {Array.from({ length: lineCount(editorContent) }, (_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                    {/* Editor area */}
                    <div className="flex-1 relative min-w-0">
                      {/* Syntax highlighted background */}
                      <div className="absolute inset-0 overflow-auto pointer-events-none" style={{ whiteSpace: wordWrap ? 'pre-wrap' : 'pre' }}>
                        <pre className="p-2 text-sm leading-relaxed font-mono">
                          <SyntaxHighlighter
                            language={getSyntaxLang(selectedFile.file_name)}
                            style={oneDark}
                            customStyle={{ background: 'transparent', padding: 0, margin: 0, fontSize: '0.875rem', lineHeight: '1.625rem', whiteSpace: wordWrap ? 'pre-wrap' : 'pre' }}
                            showLineNumbers={false}
                          >
                            {editorContent || ' '}
                          </SyntaxHighlighter>
                        </pre>
                      </div>
                      {/* Actual editable textarea (transparent) */}
                      <textarea
                        value={editorContent}
                        onChange={e => setEditorContent(e.target.value)}
                        className="w-full h-full bg-transparent p-2 font-mono text-sm resize-none focus:outline-none text-transparent caret-foreground leading-relaxed"
                        dir="ltr"
                        spellCheck={false}
                        style={{ whiteSpace: wordWrap ? 'pre-wrap' : 'pre', wordBreak: 'break-all' }}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-3">
                <FileCode2 className="w-12 h-12 opacity-30" />
                <span>اختر ملف للتعديل</span>
                <Button size="sm" variant="outline" onClick={() => setShowNewFile(true)} className="gap-1">
                  <Plus className="w-4 h-4" /> إنشاء ملف جديد
                </Button>
              </div>
            )}
          </div>

          {/* Console resize handle */}
          <div
            className="h-1 cursor-ns-resize hover:bg-primary/50 transition-colors flex-shrink-0"
            onMouseDown={handleConsoleDragStart}
          />

          {/* Console */}
          {showConsole && (
            <div className="border-t border-border/30 bg-[#0d1117] flex flex-col flex-shrink-0" style={{ height: consoleHeight }}>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold">Console</span>
                  {consoleLogs.length > 0 && (
                    <Badge variant="secondary" className="h-4 text-[10px] px-1.5">
                      {consoleLogs.length}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-0.5">
                  <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => setConsoleLogs([])}>مسح</Button>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setShowConsole(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div ref={consoleRef} className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-0.5 min-h-0" dir="ltr">
                {consoleLogs.length === 0 ? (
                  <div className="text-muted-foreground/50 flex items-center gap-2">
                    <Activity className="w-3 h-3" />
                    Console output will appear here...
                  </div>
                ) : (
                  consoleLogs.map((log) => {
                    const Icon = logIcons[log.type] || Terminal;
                    return (
                      <div key={log.id} className="flex gap-2 items-start hover:bg-white/5 px-1 rounded transition-colors">
                        <Icon className={`w-3 h-3 mt-0.5 flex-shrink-0 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : 'text-muted-foreground/50'}`} />
                        <span className="text-muted-foreground/40 flex-shrink-0">{log.time}</span>
                        <span className={`${logColors[log.type] || 'text-foreground/80'} break-all`}>{log.text}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Token Dialog (manual override) */}
      {showTokenDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md glass rounded-2xl p-6 mx-4"
            dir="rtl"
          >
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
              <h2 className="text-lg font-bold">توكن Discord</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {detectedToken
                  ? 'تم العثور على توكن في الكود. يمكنك تجاوز هذا إذا أردت.'
                  : 'لم يتم العثور على توكن في الكود. أدخله يدوياً.'}
              </p>
            </div>

            <div className="relative mb-4">
              <Input
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                type={showManualToken ? 'text' : 'password'}
                placeholder="الصق التوكن هنا..."
                className="bg-secondary border-border/50 text-left font-mono text-sm pl-12"
                dir="ltr"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowManualToken(!showManualToken)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showManualToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {detectedToken && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 mb-4 text-xs text-green-400">
                تم العثور على توكن في الكود تلقائياً
              </div>
            )}

            <div className="text-xs text-muted-foreground mb-4 space-y-0.5">
              <p>📌 للحصول على توكن:</p>
              <p className="mr-4">1. اذهب إلى <a href="https://discord.com/developers/applications" target="_blank" className="text-primary hover:underline">Discord Developer Portal</a></p>
              <p className="mr-4">2. اختر تطبيق → Bot → Copy Token</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowTokenDialog(false); if (detectedToken) handleStartBot(); }}>
                إلغاء
              </Button>
              <Button className="flex-1 gradient-bg text-primary-foreground" onClick={() => { handleSaveManualToken(); }}>
                <Save className="w-4 h-4 ml-1" /> حفظ
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
