import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import TerminalPanel from '@/components/TerminalPanel';
import {
  Play, Square, Plus, FileText, Trash2, Save, Upload, Terminal as TerminalIcon, X, Edit3,
  Eye, EyeOff, Copy, Download, RotateCcw,
  AlertCircle, CheckCircle2, Loader2, Code2, Zap, FileCode2, FolderOpen,
  Timer, Activity, Shield, HardDrive, SquareTerminal,
} from 'lucide-react';

const PROXY_URL = 'https://nova-deploy-proxy-production.up.railway.app';

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
  };
};

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

function lineCount(s: string): number {
  return s ? s.split('\n').length : 1;
}

function getCodeMirrorLang(language: string) {
  if (language === 'python') return python();
  return javascript({ jsx: true });
}

// --- CodeMirror Editor Wrapper ---
function CodeEditor({ value, onChange, language, wordWrap }: {
  value: string;
  onChange: (v: string) => void;
  language: string;
  wordWrap: boolean;
}) {
  const extensions = [
    getCodeMirrorLang(language),
    oneDark,
    wordWrap ? EditorView.lineWrapping : [],
  ];

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        foldGutter: true,
        indentOnInput: true,
        tabSize: 2,
      }}
      style={{
        height: '100%',
        fontSize: '13px',
      }}
      className="cm-editor-wrapper"
      editable={true}
      spellCheck={false}
    />
  );
}

interface PlanLimits {
  storage_mb: number;
  max_projects: number;
  plan_name: string;
}

function calculateStorageBytes(fileList: ProjectFile[], currentContent?: string, currentFileId?: string): number {
  let total = 0;
  for (const f of fileList) {
    const content = f.id === currentFileId ? (currentContent ?? f.content ?? '') : (f.content ?? '');
    total += new Blob([content]).size;
  }
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function parseMaxProjects(features: any): number {
  if (Array.isArray(features)) {
    for (const f of features) {
      if (typeof f === 'string') {
        const match = f.match(/(\d+)\s*(مشاريع|مشروع|projects?)/i);
        if (match) return parseInt(match[1]);
        if (f.includes('غير محدودة') || f.includes('unlimited')) return Infinity;
      }
    }
    return 1;
  }
  return 1;
}

export default function ProjectEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [bottomTab, setBottomTab] = useState<'console' | 'terminal'>('console');
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [showMobileFiles, setShowMobileFiles] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployStatus, setDeployStatus] = useState('');
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManualToken, setShowManualToken] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(250);
  const [isDraggingConsole, setIsDraggingConsole] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [planLimits, setPlanLimits] = useState<PlanLimits>({ storage_mb: 512, max_projects: 1, plan_name: '' });
  const terminalPanelRef = useRef<any>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);
  const logIdRef = useRef(0);

  useEffect(() => {
    if (!id || !user) return;
    loadProject();
    loadFiles();
    loadPlanLimits();
  }, [id, user]);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [consoleLogs]);

  const detectedToken = selectedFile ? extractToken(editorContent || '', project?.language || '') : null;

  useEffect(() => {
    if (selectedFile && editorContent !== selectedFile.content) {
      setHasUnsaved(true);
    } else {
      setHasUnsaved(false);
    }
  }, [editorContent, selectedFile]);

  const loadProject = async () => {
    if (!user || !id) return;
    const { data } = await supabase.from('projects').select('*').eq('id', id!).eq('user_id', user.id).single();
    if (data) {
      setProject(data);
      setProjectName(data.name);
    } else {
      // Project not found or doesn't belong to user
      toast.error(t('editor.projectNotFound'));
      navigate('/dashboard');
    }
  };

  const loadPlanLimits = async () => {
    if (!user || !id) return;
    // Load the BEST active subscription's plan limits (highest tier)
    const { data: allSubs } = await supabase
      .from('subscriptions')
      .select('id, plans!inner(id, name, features, storage_mb, sort_order, price)')
      .eq('user_id', user!.id)
      .eq('status', 'active');

    if (allSubs && allSubs.length > 0) {
      // Sort by sort_order desc, then price desc to find the best plan
      const sorted = [...allSubs].sort((a, b) => {
        const planA = (a as any).plans;
        const planB = (b as any).plans;
        if (planB.sort_order !== planA.sort_order) return planB.sort_order - planA.sort_order;
        return planB.price - planA.price;
      });
      const topPlan = (sorted[0] as any).plans;
      if (topPlan) {
        setPlanLimits({
          storage_mb: topPlan.storage_mb,
          max_projects: parseMaxProjects(topPlan.features),
          plan_name: topPlan.name,
        });
      }
    }
  };

  const loadFiles = async () => {
    if (!user || !id) return;
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
    // Check storage limit
    const newSize = new Blob([editorContent]).size;
    const otherFilesSize = calculateStorageBytes(files, undefined, selectedFile.id);
    const totalAfterSave = otherFilesSize + newSize;
    const limitBytes = planLimits.storage_mb * 1024 * 1024;
    if (totalAfterSave > limitBytes) {
      toast.error(t('editor.storageExceeded', { used: formatBytes(totalAfterSave), limit: formatBytes(limitBytes) }));
      return;
    }
    const { error } = await supabase
      .from('project_files')
      .update({ content: editorContent })
      .eq('id', selectedFile.id);
    if (error) toast.error(t('editor.saveError'));
    else {
      toast.success(t('editor.saved'));
      setHasUnsaved(false);
      setFiles(prev => prev.map(f => f.id === selectedFile.id ? { ...f, content: editorContent } : f));
      setSelectedFile(prev => prev ? { ...prev, content: editorContent } : null);
    }
  };

  const addLog = useCallback((type: string, text: string) => {
    logIdRef.current++;
    setConsoleLogs(prev => [...prev, { id: String(logIdRef.current), type, text, time: new Date().toLocaleTimeString('ar-SA') }]);
  }, []);

  const pollDeployStatus = useCallback(async (serviceId: string) => {
    const maxAttempts = 60; // 60 × 8s = 8 minutes max
    let lastStatus = '';
    let initCount = 0;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 8000));
      setDeployProgress(Math.min(95, 30 + ((i + 1) / maxAttempts) * 65));

      try {
        const res = await fetch(`${PROXY_URL}/status?serviceId=${serviceId}`);
        if (!res.ok) continue;
        const data = await res.json();

        if (data.status === 'DELETED') {
          addLog('error', t('editor.serviceDeleted'));
          return 'CRASHED';
        }

        if (data.status === 'SUCCESS') {
          setDeployProgress(100);
          addLog('success', t('editor.deploySuccess'));
          if (data.logs?.length) {
            for (const l of data.logs) {
              if (l.severity === 'error') addLog('error', l.message);
              else addLog('info', l.message);
            }
          }
          addLog('info', t('editor.botReady'));
          return 'SUCCESS';
        }

        if (data.status === 'CRASHED') {
          addLog('error', t('editor.deployFailed'));
          if (data.logs?.length) {
            addLog('info', t('editor.errorDetails'));
            for (const l of data.logs) {
              addLog(l.severity === 'error' ? 'error' : 'warning', `  ${l.message}`);
            }
          }
          return 'CRASHED';
        }

        if (data.status === 'BUILDING' || data.status === 'DEPLOYING') {
          const newStatus = i < 5 ? t('editor.building') : i < 15 ? t('editor.installing') : t('editor.starting');
          if (newStatus !== lastStatus) {
            setDeployStatus(newStatus);
            addLog('info', newStatus);
            lastStatus = newStatus;
          }
          initCount = 0;
        } else if (data.status === 'INITIALIZING' || data.status === 'unknown') {
          initCount++;
          if (initCount === 1) {
            addLog('info', t('editor.creatingEnvironment'));
            setDeployStatus(t('editor.preparing'));
          } else if (initCount === 5) {
            setDeployStatus(t('editor.building'));
            addLog('info', t('editor.railwaySlowBuild'));
          } else if (initCount === 15) {
            setDeployStatus(t('editor.deployTakingLong'));
          } else if (initCount > 30) {
            addLog('warning', t('editor.deployVeryLong'));
          }
        }
      } catch {
        // network error - silent retry
      }
    }
    addLog('warning', t('editor.tookTooLong'));
    return 'TIMEOUT';
  }, [addLog, t]);

  const handleStartBot = async () => {
    if (!project || !user) return;

    const allFilesContent = files.map(f => f.content || '').join('\n');
    const codeToken = extractToken(allFilesContent, project.language);

    if (!codeToken && !manualToken.trim()) {
      setShowTokenDialog(true);
      toast.error(t('editor.noToken'));
      return;
    }

    const botToken = codeToken || manualToken.trim();

    if (botToken.length < 50) {
      setShowTokenDialog(true);
      toast.error(t('editor.invalidToken'));
      return;
    }

    setIsDeploying(true);
    setDeployProgress(0);
    setDeployStatus(t('editor.preparing'));

    addLog('info', t('editor.startingDeploy'));

    if (selectedFile && hasUnsaved) {
      await supabase.from('project_files').update({ content: editorContent }).eq('id', selectedFile.id);
      addLog('info', t('editor.filesSaved'));
    }

    await supabase.from('projects').update({ status: 'deploying' }).eq('id', project.id);
    setProject(prev => prev ? { ...prev, status: 'deploying' } : null);

    try {
      const { data: allFiles } = await supabase
        .from('project_files')
        .select('file_name, content')
        .eq('project_id', id!);

      if (!allFiles || allFiles.length === 0) {
        addLog('error', t('editor.noFiles'));
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
        addLog('error', t('editor.noMainFile'));
        await supabase.from('projects').update({ status: 'error' }).eq('id', project.id);
        setProject(prev => prev ? { ...prev, status: 'error' } : null);
        setIsDeploying(false);
        return;
      }

      const code = mainFile.content || '';

      setDeployProgress(10);
      setDeployStatus(t('editor.connecting'));

      const proxyRes = await fetch(`${PROXY_URL}/deploy`, {
        method: 'POST',
        headers: await getAuthHeaders(),
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
        const errMsg = proxyData.error || t('editor.unknownError');
        addLog('error', t('editor.errorPrefix', { message: errMsg }));

        if (proxyData.code === 'QUOTA_EXCEEDED') {
          toast.error(t('editor.quotaExceeded'), { duration: 8000 });
        } else if (proxyData.code === 'INVALID_TOKEN') {
          toast.error(t('editor.invalidTokenFull'), { duration: 8000 });
        } else if (proxyRes.status === 401) {
          toast.error(t('editor.sessionExpired'), { duration: 5000 });
        } else {
          toast.error(t('editor.deployFailedMsg', { message: errMsg.substring(0, 100) }), { duration: 6000 });
        }

        await supabase.from('projects').update({ status: 'error' }).eq('id', project.id);
        setProject(prev => prev ? { ...prev, status: 'error' } : null);
        setIsDeploying(false);
        return;
      }

      const serviceId = proxyData.serviceId;
      setDeployProgress(30);
      setDeployStatus(t('editor.buildingBot'));

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
      addLog('error', t('editor.errorPrefix', { message: err.message }));
      await supabase.from('projects').update({ status: 'error' }).eq('id', project.id);
      setProject(prev => prev ? { ...prev, status: 'error' } : null);
    }

    setIsDeploying(false);
    setDeployProgress(0);
    setDeployStatus('');
  };

  const handleStopBot = async () => {
    if (!project || !user) return;
    addLog('warning', t('editor.stoppingBot'));
    setIsDeploying(true);

    try {
      if (project.railway_service_id) {
        const proxyRes = await fetch(`${PROXY_URL}/stop`, {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ serviceId: project.railway_service_id }),
          signal: AbortSignal.timeout(15000),
        });

        if (proxyRes.ok) {
          addLog('success', t('editor.botStopped'));
        } else {
          addLog('warning', t('editor.stopError'));
        }
      } else {
        addLog('success', t('editor.botStopped'));
      }

      await supabase.from('projects').update({ status: 'stopped', railway_service_id: null }).eq('id', project.id);
      setProject(prev => prev ? { ...prev, status: 'stopped', railway_service_id: null } : null);
    } catch (err: any) {
      await supabase.from('projects').update({ status: 'stopped', railway_service_id: null }).eq('id', project.id);
      setProject(prev => prev ? { ...prev, status: 'stopped', railway_service_id: null } : null);
      addLog('success', t('editor.botStopped'));
    }
    setIsDeploying(false);
  };

  const handleSaveManualToken = () => {
    if (!manualToken.trim()) {
      toast.error(t('editor.pleaseEnterToken'));
      return;
    }
    if (manualToken.trim().length < 50) {
      toast.error(t('editor.invalidToken'));
      return;
    }
    setShowTokenDialog(false);
    toast.success(t('editor.tokenSaved'));
  };

  const createFile = async () => {
    if (!newFileName.trim() || !id) return;
    // Check storage limit (new empty file has ~0 bytes, but check anyway)
    const currentStorage = calculateStorageBytes(files);
    const limitBytes = planLimits.storage_mb * 1024 * 1024;
    if (currentStorage >= limitBytes) {
      toast.error(t('editor.storageLimitReached', { used: formatBytes(currentStorage), limit: formatBytes(limitBytes) }));
      return;
    }
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
      toast.success(t('editor.fileCreated'));
    }
  };

  const deleteFile = async (fileId: string) => {
    await supabase.from('project_files').delete().eq('id', fileId);
    setFiles(prev => prev.filter(f => f.id !== fileId));
    if (selectedFile?.id === fileId) {
      setSelectedFile(null);
      setEditorContent('');
    }
    toast.success(t('editor.fileDeleted'));
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const importedFiles = e.target.files;
    if (!importedFiles) return;
    const currentStorage = calculateStorageBytes(files);
    const limitBytes = planLimits.storage_mb * 1024 * 1024;
    let importedTotal = 0;
    const fileList = Array.from(importedFiles);
    for (const f of fileList) importedTotal += f.size;
    if (currentStorage + importedTotal > limitBytes) {
      toast.error(t('editor.filesExceedLimit', { used: formatBytes(currentStorage + importedTotal), limit: formatBytes(limitBytes) }));
      e.target.value = '';
      return;
    }
    fileList.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const content = ev.target?.result as string;
        // Re-check storage before each insert (in case multiple files)
        const latestStorage = calculateStorageBytes(files);
        if (latestStorage + new Blob([content]).size > limitBytes) {
          toast.error(t('editor.storageExceededImport'));
          return;
        }
        const { data } = await supabase
          .from('project_files')
          .insert({ project_id: id!, file_name: file.name, file_path: '/', content })
          .select()
          .single();
        if (data) {
          setFiles(prev => [...prev, data]);
          toast.success(t('editor.imported', { name: file.name }));
        }
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  const updateProjectName = async () => {
    if (!project || !projectName.trim()) return;
    await supabase.from('projects').update({ name: projectName.trim() }).eq('id', project.id);
    setProject({ ...project, name: projectName.trim() });
    setEditingName(false);
    toast.success(t('editor.nameUpdated'));
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(editorContent);
    toast.success(t('editor.codeCopied'));
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
      const content = allFiles.map(f => `===== ${f.file_name} =====\n${f.content || ''}`).join('\n\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name || 'project'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast.success(t('editor.projectDownloaded'));
  };

  const handleFormatCode = () => {
    const formatted = editorContent
      .split('\n')
      .map(l => l.trimEnd())
      .join('\n')
      .replace(/\n{4,}/g, '\n\n\n');
    setEditorContent(formatted);
    toast.success(t('editor.codeFormatted'));
  };

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

  const logIcons: Record<string, typeof TerminalIcon> = {
    info: TerminalIcon,
    success: CheckCircle2,
    warning: AlertCircle,
    error: AlertCircle,
  };

  const statusBadge = (() => {
    if (isDeploying) return { color: 'text-yellow-400 bg-yellow-400/10', label: deployStatus || t('editor.deployingStatus') };
    if (project?.status === 'running') return { color: 'text-green-400 bg-green-400/10', label: t('dashboard.running') };
    if (project?.status === 'error') return { color: 'text-red-400 bg-red-400/10', label: t('dashboard.error') };
    return { color: 'text-gray-400 bg-gray-400/10', label: t('dashboard.stopped') };
  })();

  if (!project) return <div className="min-h-screen flex items-center justify-center pt-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-screen pt-16 flex flex-col" dir="rtl">
      {/* Top Toolbar */}
      <div className="glass border-b border-border/30 px-3 py-2 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-3 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input value={projectName} onChange={e => setProjectName(e.target.value)} className="h-8 w-36 sm:w-48 bg-secondary" onKeyDown={e => e.key === 'Enter' && updateProjectName()} />
              <Button size="sm" variant="ghost" onClick={updateProjectName}><Save className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
              <h2 className="font-bold truncate">{project.name}</h2>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(true)}><Edit3 className="w-3 h-3" /></Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {detectedToken ? (
            <Button size="sm" variant="ghost" className="text-green-400 hover:text-green-300 text-xs gap-1 hidden sm:inline-flex" title={t('editor.tokenFoundInCode')}>
              <Shield className="w-3.5 h-3.5" />
              {t('editor.tokenAvailable')}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="text-orange-400 hover:text-orange-300 text-xs gap-1 hidden sm:inline-flex" onClick={() => setShowTokenDialog(true)} title={t('editor.enterTokenManually')}>
              <Shield className="w-3.5 h-3.5" />
              {t('editor.enterToken')}
            </Button>
          )}

          <Separator orientation="vertical" className="h-6 mx-0.5 sm:mx-1" />

          {/* Mobile Files Button */}
          <Button size="sm" variant="ghost" className="md:hidden h-8 w-8 p-0" onClick={() => setShowMobileFiles(true)} title={t('editor.files')}>
            <FolderOpen className="w-4 h-4" />
          </Button>
          {/* Mobile Import Button */}
          <Button size="sm" variant="ghost" className="md:hidden h-8 w-8 p-0" onClick={() => mobileFileInputRef.current?.click()} title={t('editor.importFile')}>
            <Upload className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className={`h-8 w-8 p-0 ${showBottomPanel && bottomTab === 'console' ? 'text-primary' : ''}`} onClick={() => { setShowBottomPanel(true); setBottomTab('console'); }} title="Console">
            <TerminalIcon className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className={`h-8 w-8 p-0 ${showBottomPanel && bottomTab === 'terminal' ? 'text-primary' : ''}`} onClick={() => { setShowBottomPanel(true); setBottomTab('terminal'); }} title="Terminal">
            <SquareTerminal className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className={`h-8 w-8 p-0 ${!showBottomPanel ? 'text-muted-foreground' : ''}`} onClick={() => setShowBottomPanel(!showBottomPanel)} title={showBottomPanel ? t('editor.hide') : t('editor.show')}>
            <X className="w-3 h-3" />
          </Button>

          {project.status === 'running' || isDeploying ? (
            <Button size="sm" variant="destructive" onClick={handleStopBot} disabled={isDeploying} className="gap-1 text-xs sm:text-sm">
              <Square className="w-4 h-4" /> <span className="hidden sm:inline">{t('editor.stopBot')}</span>
            </Button>
          ) : (
            <Button size="sm" className="gradient-bg text-primary-foreground gap-1 text-xs sm:text-sm" onClick={handleStartBot}>
              <Play className="w-4 h-4" /> <span className="hidden sm:inline">{t('editor.startBot')}</span>
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
        {/* File Explorer - hidden on mobile, shown on md+ */}
        <div className="hidden md:flex w-56 glass border-l border-border/30 flex-col">
          <div className="p-3 border-b border-border/30 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('editor.files')}</span>
            <div className="flex gap-0.5">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowNewFile(true)} title={t('editor.newFile')}>
                <Plus className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => fileInputRef.current?.click()} title={t('editor.importFile')}>
                <Upload className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleDownloadProject} title={t('editor.downloadProject')}>
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
                placeholder={t('editor.fileName') + '.js'}
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
                {t('editor.noFiles')}
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

          {/* Storage usage & Stats footer */}
          <div className="p-2 border-t border-border/30 text-xs text-muted-foreground space-y-1.5">
            {/* Storage bar */}
            {(() => {
              const currentStorage = calculateStorageBytes(files, editorContent, selectedFile?.id);
              const limitBytes = planLimits.storage_mb * 1024 * 1024;
              const pct = Math.min(100, (currentStorage / limitBytes) * 100);
              const isNearLimit = pct > 85;
              const isOverLimit = currentStorage > limitBytes;
              return (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <HardDrive className={`w-3 h-3 ${isOverLimit ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-primary'}`} />
                      <span className={isOverLimit ? 'text-red-400 font-medium' : isNearLimit ? 'text-yellow-400' : ''}>
                        {formatBytes(currentStorage)} / {formatBytes(limitBytes)}
                      </span>
                    </div>
                    <span className={isOverLimit ? 'text-red-400' : ''}>{Math.round(pct)}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isOverLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-primary'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
            <div className="flex justify-between">
              <span>{t('editor.fileCount', { count: files.length })}</span>
              <span>{t('editor.lineCount', { count: selectedFile ? lineCount(editorContent) : 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('editor.charCount', { count: editorContent.length })}</span>
              {hasUnsaved && <span className="text-yellow-400">● {t('editor.unsaved')}</span>}
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
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={() => setWordWrap(!wordWrap)} title={t('editor.textWrap')}>
                      <RotateCcw className="w-3 h-3" />
                      {wordWrap ? t('editor.wrap') : t('editor.normal')}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={handleFormatCode} title={t('editor.formatCode')}>
                      <Code2 className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={handleCopyCode} title={t('editor.copy')}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={handleDownloadFile} title={t('editor.download')}>
                      <Download className="w-3 h-3" />
                    </Button>
                    <Separator orientation="vertical" className="h-4" />
                    <Button size="sm" onClick={saveFile} className="gradient-bg text-primary-foreground h-6 text-xs px-3 gap-1">
                      <Save className="w-3 h-3" /> {t('editor.save')}
                    </Button>
                    <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Ctrl+S</span>
                  </div>
                </div>

                {/* CodeMirror Editor */}
                <div className="w-full h-full bg-[#0d0d0d] pt-10 flex flex-col overflow-hidden" dir="ltr" style={{ '--cm-bg': '#0d0d0d' } as React.CSSProperties}>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <CodeEditor
                      value={editorContent}
                      onChange={setEditorContent}
                      language={project?.language || 'javascript'}
                      wordWrap={wordWrap}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-3">
                <FileCode2 className="w-12 h-12 opacity-30" />
                <span>{t('editor.selectFileToEdit')}</span>
                <Button size="sm" variant="outline" onClick={() => { setShowNewFile(true); setShowMobileFiles(true); }} className="gap-1">
                  <Plus className="w-4 h-4" /> {t('editor.createFile')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowMobileFiles(true)} className="gap-1">
                  <FileCode2 className="w-4 h-4" /> {t('editor.viewFiles')}
                </Button>
              </div>
            )}
          </div>

          {/* Bottom Panel resize handle */}
          <div
            className="h-1 cursor-ns-resize hover:bg-primary/50 transition-colors flex-shrink-0"
            onMouseDown={handleConsoleDragStart}
          />

          {/* Bottom Panel - Console & Terminal */}
          {showBottomPanel && (
            <div className="border-t border-border/30 flex flex-col flex-shrink-0" style={{ height: Math.min(consoleHeight, window.innerWidth < 640 ? 200 : 500) }}>
              {/* Tab bar */}
              <div className="flex items-center justify-between px-1 border-b border-border/30 flex-shrink-0 bg-card/80">
                <div className="flex items-center">
                  <button
                    onClick={() => setBottomTab('console')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                      bottomTab === 'console'
                        ? 'text-primary border-primary bg-primary/5'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <TerminalIcon className="w-3 h-3" />
                    Console
                    {consoleLogs.length > 0 && (
                      <Badge variant="secondary" className="h-3.5 text-[9px] px-1 ml-1">{consoleLogs.length}</Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setBottomTab('terminal')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                      bottomTab === 'terminal'
                        ? 'text-primary border-primary bg-primary/5'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <SquareTerminal className="w-3 h-3" />
                    Terminal
                  </button>
                </div>
                <div className="flex gap-0.5 px-1">
                  {bottomTab === 'console' && (
                    <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => setConsoleLogs([])}>{t('editor.clear')}</Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setShowBottomPanel(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Console Tab */}
              {bottomTab === 'console' && (
                <div className="flex-1 overflow-hidden bg-[#0d1117]">
                  <div ref={consoleRef} className="h-full overflow-y-auto p-2 font-mono text-xs space-y-0.5" dir="ltr">
                    {consoleLogs.length === 0 ? (
                      <div className="text-muted-foreground/50 flex items-center gap-2 h-full">
                        <Activity className="w-3 h-3" />
                        Console output will appear here...
                      </div>
                    ) : (
                      consoleLogs.map((log) => {
                        const Icon = logIcons[log.type] || TerminalIcon;
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

              {/* Terminal Tab */}
              {bottomTab === 'terminal' && (
                <div className="flex-1 overflow-hidden bg-[#0a0a0f]">
                  <TerminalPanel
                    ref={terminalPanelRef}
                    serviceId={project?.railway_service_id || null}
                    projectName={project?.name || ''}
                    botLanguage={project?.language || 'javascript'}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Files Sheet - visible on mobile only */}
      <Sheet open={showMobileFiles} onOpenChange={setShowMobileFiles}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl p-0" dir="rtl">
          <SheetHeader className="px-4 pt-3 pb-2 border-b border-border/30">
            <SheetTitle className="text-right flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold">{t('editor.files')}</span>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-8 px-3 gap-1" onClick={() => setShowNewFile(true)}>
                  <Plus className="w-4 h-4" /> <span className="text-xs">{t('editor.newFile')}</span>
                </Button>
                <Button size="sm" variant="outline" className="h-8 px-3 gap-1" onClick={() => mobileFileInputRef.current?.click()}>
                  <Upload className="w-4 h-4" /> <span className="text-xs">{t('editor.import')}</span>
                </Button>
              </div>
            </SheetTitle>
          </SheetHeader>

          {showNewFile && (
            <div className="p-3 border-b border-border/30 flex gap-2">
              <Input
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                placeholder={t('editor.fileName') + '.js'}
                className="h-10 text-sm bg-secondary"
                onKeyDown={e => e.key === 'Enter' && createFile()}
                autoFocus
              />
              <Button size="sm" className="h-10 px-3" onClick={createFile}>{t('editor.create')}</Button>
              <Button size="sm" variant="ghost" className="h-10 px-2" onClick={() => { setShowNewFile(false); setNewFileName(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2">
            {files.length === 0 ? (
              <div className="p-8 text-center">
                <FileCode2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">{t('editor.noFiles')}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t('editor.noFilesHint')}</p>
              </div>
            ) : (
              files.map(file => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-colors mb-1 ${
                    selectedFile?.id === file.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary/50'
                  }`}
                  onClick={() => {
                    setSelectedFile(file);
                    setEditorContent(file.content || '');
                    setShowMobileFiles(false);
                  }}
                >
                  <div className="flex items-center gap-2.5 truncate min-w-0">
                    <FileText className={`w-4 h-4 flex-shrink-0 ${getFileIcon(file.file_name)}`} />
                    <span className="text-sm truncate">{file.file_name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 flex-shrink-0 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border/30 p-3 space-y-2">
            {(() => {
              const currentStorage = calculateStorageBytes(files, editorContent, selectedFile?.id);
              const limitBytes = planLimits.storage_mb * 1024 * 1024;
              const pct = Math.min(100, (currentStorage / limitBytes) * 100);
              const isNearLimit = pct > 85;
              const isOverLimit = currentStorage > limitBytes;
              return (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className={isOverLimit ? 'text-red-400 font-medium' : isNearLimit ? 'text-yellow-400' : ''}>
                    {formatBytes(currentStorage)} / {formatBytes(limitBytes)}
                  </span>
                  <span className={isOverLimit ? 'text-red-400' : ''}>{Math.round(pct)}%</span>
                </div>
              );
            })()}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('editor.fileCount', { count: files.length })}</span>
              {hasUnsaved && <span className="text-yellow-400">{t('editor.unsaved')}</span>}
            </div>
          </div>

          <input ref={mobileFileInputRef} type="file" multiple className="hidden" onChange={(e) => { handleFileImport(e); setShowMobileFiles(false); }} />
        </SheetContent>
      </Sheet>

      {/* Token Dialog */}
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
              <h2 className="text-lg font-bold">{t('editor.tokenDialog')}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {detectedToken
                  ? t('editor.tokenFoundSkip')
                  : t('editor.tokenDialogDesc')}
              </p>
            </div>

            <div className="relative mb-4">
              <Input
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                type={showManualToken ? 'text' : 'password'}
                placeholder={t('editor.tokenPlaceholder')}
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
                {t('editor.tokenFoundAuto')}
              </div>
            )}

            <div className="text-xs text-muted-foreground mb-4 space-y-0.5">
              <p>{t('editor.howToGetToken')}</p>
              <p className="mr-4">1. {t('editor.goToDevPortal')} <a href="https://discord.com/developers/applications" target="_blank" className="text-primary hover:underline">Discord Developer Portal</a></p>
              <p className="mr-4">2. {t('editor.selectAppBotCopy')}</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowTokenDialog(false); if (detectedToken) handleStartBot(); }}>
                {t('editor.cancel')}
              </Button>
              <Button className="flex-1 gradient-bg text-primary-foreground" onClick={() => { handleSaveManualToken(); }}>
                <Save className="w-4 h-4 ml-1" /> {t('editor.save')}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
