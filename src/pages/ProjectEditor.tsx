import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Play, Square, Plus, FileText, Trash2, Save, Upload, Terminal, X, Edit3, Key, Eye, EyeOff,
} from 'lucide-react';

const PROXY_URL = 'https://proxy-production-46a1.up.railway.app';

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

export default function ProjectEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [showConsole, setShowConsole] = useState(true);
  const [consoleLogs, setConsoleLogs] = useState<{ type: string; text: string; time: string }[]>([]);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      const savedToken = localStorage.getItem(`bot_token_${id}`);
      if (savedToken) setBotToken(savedToken);
    }
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    loadProject();
    loadFiles();
  }, [id, user]);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [consoleLogs]);

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
    else toast.success('تم الحفظ');
  };

  const addLog = (type: string, text: string) => {
    setConsoleLogs(prev => [...prev, { type, text, time: new Date().toLocaleTimeString('ar-SA') }]);
  };

  const handleStartBot = async () => {
    if (!project || !user) return;

    if (!botToken.trim()) {
      setShowTokenDialog(true);
      toast.error('يجب إدخال توكن Discord البوت أولاً');
      return;
    }

    if (botToken.trim() === 'YOUR_TOKEN' || botToken.trim().length < 50) {
      setShowTokenDialog(true);
      toast.error('توكن Discord غير صالح');
      return;
    }

    setIsDeploying(true);
    addLog('info', '🚀 جاري تشغيل البوت...');

    // Save current file
    if (selectedFile) {
      await supabase
        .from('project_files')
        .update({ content: editorContent })
        .eq('id', selectedFile.id);
    }
    addLog('info', '💾 تم حفظ الملفات');

    // Update status
    await supabase.from('projects').update({ status: 'deploying' }).eq('id', project.id);
    setProject(prev => prev ? { ...prev, status: 'deploying' } : null);
    addLog('info', '📦 جاري النشر على Railway...');

    try {
      // Load all project files
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

      // Get the main file
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

      // Replace YOUR_TOKEN with real token
      const code = mainFile.content ? mainFile.content.replace(/['"]YOUR_TOKEN['"]|YOUR_TOKEN/g, botToken.trim()) : '';

      addLog('info', '📡 جاري إنشاء خدمة على Railway...');

      // Call the proxy to deploy
      const proxyRes = await fetch(`${PROXY_URL}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botName: project.name,
          botToken: botToken.trim(),
          language: project.language,
          code,
        }),
      });

      const proxyData = await proxyRes.json();

      if (!proxyRes.ok || proxyData.error) {
        addLog('error', `❌ خطأ في النشر: ${proxyData.error || 'خطأ غير معروف'}`);
        await supabase.from('projects').update({ status: 'error' }).eq('id', project.id);
        setProject(prev => prev ? { ...prev, status: 'error' } : null);
      } else {
        // Save the railway service ID
        const serviceId = proxyData.serviceId;
        if (serviceId) {
          await supabase.from('projects').update({
            status: 'running',
            railway_service_id: serviceId,
          }).eq('id', project.id);
          setProject(prev => prev ? { ...prev, status: 'running', railway_service_id: serviceId } : null);
        } else {
          await supabase.from('projects').update({ status: 'running' }).eq('id', project.id);
          setProject(prev => prev ? { ...prev, status: 'running' } : null);
        }

        addLog('success', '✅ البوت يعمل الآن على Railway!');
        addLog('info', `📡 اللغة: ${project.language}`);
        addLog('info', `🚂 Service ID: ${serviceId || 'N/A'}`);
        addLog('info', '🤖 يمكنك اختبار البوت في سيرفر Discord');
      }
    } catch (err: any) {
      addLog('error', `❌ خطأ في الاتصال: ${err.message}`);
      await supabase.from('projects').update({ status: 'error' }).eq('id', project.id);
      setProject(prev => prev ? { ...prev, status: 'error' } : null);
    }

    setIsDeploying(false);
  };

  const handleStopBot = async () => {
    if (!project || !user) return;
    addLog('warning', '⏹️ جاري إيقاف البوت...');

    try {
      if (project.railway_service_id) {
        addLog('info', '📡 جاري إيقاف الخدمة على Railway...');
        const proxyRes = await fetch(`${PROXY_URL}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId: project.railway_service_id }),
        });

        if (proxyRes.ok) {
          addLog('success', '✅ تم إيقاف البوت على Railway');
        } else {
          addLog('warning', '⚠️ حدث خطأ أثناء الإيقاف');
        }
      }

      await supabase.from('projects').update({ status: 'stopped', railway_service_id: null }).eq('id', project.id);
      setProject(prev => prev ? { ...prev, status: 'stopped', railway_service_id: null } : null);
      addLog('success', '✅ تم إيقاف البوت بنجاح');
    } catch (err: any) {
      await supabase.from('projects').update({ status: 'stopped' }).eq('id', project.id);
      setProject(prev => prev ? { ...prev, status: 'stopped' } : null);
      addLog('warning', '⚠️ تم الإيقاف محلياً');
    }
  };

  const handleSaveToken = () => {
    if (!botToken.trim()) {
      toast.error('الرجاء إدخال التوكن');
      return;
    }
    if (botToken.trim().length < 50) {
      toast.error('توكن Discord غير صالح');
      return;
    }
    localStorage.setItem(`bot_token_${id}`, botToken.trim());
    setShowTokenDialog(false);
    toast.success('تم حفظ التوكن بأمان');
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

  const logColors: Record<string, string> = {
    info: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };

  if (!project) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-screen pt-16 flex flex-col" dir="rtl">
      {/* Toolbar */}
      <div className="glass border-b border-border/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input value={projectName} onChange={e => setProjectName(e.target.value)} className="h-8 w-48 bg-secondary" />
              <Button size="sm" variant="ghost" onClick={updateProjectName}><Save className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-bold">{project.name}</h2>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(true)}><Edit3 className="w-3 h-3" /></Button>
            </div>
          )}
          <Badge variant="secondary">{project.language}</Badge>
          <div className={`w-2 h-2 rounded-full ${
            project.status === 'running' ? 'bg-success animate-pulse' :
            project.status === 'deploying' ? 'bg-warning animate-pulse' :
            project.status === 'error' ? 'bg-destructive' : 'bg-muted-foreground'
          }`} />
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowTokenDialog(true)} className={botToken ? 'text-success' : 'text-destructive'}>
            <Key className="w-4 h-4 ml-1" />
            {botToken ? 'توكن محفوظ ✓' : 'أدخل التوكن'}
          </Button>

          <Button size="sm" variant="ghost" onClick={() => setShowConsole(!showConsole)}>
            <Terminal className="w-4 h-4" />
          </Button>
          {project.status === 'running' ? (
            <Button size="sm" variant="destructive" onClick={handleStopBot}>
              <Square className="w-4 h-4 ml-1" /> إيقاف
            </Button>
          ) : (
            <Button size="sm" className="gradient-bg text-primary-foreground" onClick={handleStartBot} disabled={project.status === 'deploying' || isDeploying}>
              {isDeploying ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4 ml-1" />
              )}
              {project.status === 'deploying' || isDeploying ? 'جاري النشر...' : 'تشغيل'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer */}
        <div className="w-56 glass border-l border-border/30 flex flex-col">
          <div className="p-3 border-b border-border/30 flex items-center justify-between">
            <span className="text-sm font-semibold">الملفات</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowNewFile(true)}>
                <Plus className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-3 h-3" />
              </Button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileImport} />
            </div>
          </div>

          {showNewFile && (
            <div className="p-2 border-b border-border/30 flex gap-1">
              <Input
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                placeholder="اسم الملف"
                className="h-7 text-xs bg-secondary"
                onKeyDown={e => e.key === 'Enter' && createFile()}
              />
              <Button size="sm" className="h-7 px-2" onClick={createFile}>+</Button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {files.map(file => (
              <div
                key={file.id}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-secondary/50 transition-colors group ${
                  selectedFile?.id === file.id ? 'bg-primary/10 border-r-2 border-primary' : ''
                }`}
                onClick={() => { setSelectedFile(file); setEditorContent(file.content || ''); }}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate">{file.file_name}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Editor + Console */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            {selectedFile ? (
              <>
                <div className="absolute top-2 left-2 z-10">
                  <Button size="sm" onClick={saveFile} className="gradient-bg text-primary-foreground h-7 text-xs">
                    <Save className="w-3 h-3 ml-1" /> حفظ
                  </Button>
                </div>
                <textarea
                  value={editorContent}
                  onChange={e => setEditorContent(e.target.value)}
                  className="w-full h-full bg-background p-4 pt-12 font-mono text-sm resize-none focus:outline-none text-foreground leading-relaxed"
                  dir="ltr"
                  spellCheck={false}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                اختر ملف للتعديل
              </div>
            )}
          </div>

          {showConsole && (
            <div className="h-48 border-t border-border/30 bg-background">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Console</span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setConsoleLogs([])}>مسح</Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowConsole(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div ref={consoleRef} className="h-[calc(100%-36px)] overflow-y-auto p-3 font-mono text-xs space-y-1" dir="ltr">
                {consoleLogs.length === 0 ? (
                  <span className="text-muted-foreground">Console output will appear here...</span>
                ) : (
                  consoleLogs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-muted-foreground flex-shrink-0">[{log.time}]</span>
                      <span className={logColors[log.type] || 'text-foreground'}>{log.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bot Token Dialog */}
      {showTokenDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md glass rounded-2xl p-8 mx-4"
            dir="rtl"
          >
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center mx-auto mb-4">
                <Key className="w-7 h-7 text-primary-foreground" />
              </div>
              <h2 className="text-xl font-bold gradient-text">توكن Discord Bot</h2>
              <p className="text-sm text-muted-foreground mt-2">
                أدخل توكن البوت الخاص بك. التوكن يُحفظ في هذا الجهاز فقط ولا يُرسل لأي خادم.
              </p>
            </div>

            <div className="relative mb-6">
              <Input
                value={botToken}
                onChange={e => setBotToken(e.target.value)}
                type={showToken ? 'text' : 'password'}
                placeholder="الصق التوكن هنا..."
                className="bg-secondary border-border/50 text-left font-mono text-sm pl-12"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="text-xs text-muted-foreground mb-6 space-y-1">
              <p>📌 للحصول على توكن بوت:</p>
              <p className="mr-4">1. اذهب إلى <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Discord Developer Portal</a></p>
              <p className="mr-4">2. أنشئ تطبيق جديد أو اختر تطبيق موجود</p>
              <p className="mr-4">3. اذهب إلى Bot → Copy Token</p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowTokenDialog(false)}
              >
                إلغاء
              </Button>
              <Button
                className="flex-1 gradient-bg text-primary-foreground"
                onClick={handleSaveToken}
              >
                <Save className="w-4 h-4 ml-1" /> حفظ
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
