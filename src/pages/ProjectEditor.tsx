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
  Play, Square, Plus, FileText, Trash2, Save, Upload, Terminal, X, Edit3,
} from 'lucide-react';

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
  const consoleRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (data) { setProject(data); setProjectName(data.name); }
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
    if (!project) return;
    addLog('info', '🚀 جاري تشغيل البوت...');
    
    // Save all files first
    await saveFile();
    addLog('info', '💾 تم حفظ الملفات');

    // Update status
    await supabase.from('projects').update({ status: 'deploying' }).eq('id', project.id);
    setProject({ ...project, status: 'deploying' });
    addLog('info', '📦 جاري النشر على Railway...');

    // Simulate deployment (in real implementation, call edge function to deploy to Railway)
    setTimeout(() => {
      setProject(prev => prev ? { ...prev, status: 'running' } : null);
      supabase.from('projects').update({ status: 'running' }).eq('id', project.id);
      addLog('success', '✅ البوت يعمل الآن!');
      addLog('info', `📡 اللغة: ${project.language}`);
    }, 3000);
  };

  const handleStopBot = async () => {
    if (!project) return;
    await supabase.from('projects').update({ status: 'stopped' }).eq('id', project.id);
    setProject({ ...project, status: 'stopped' });
    addLog('warning', '⏹️ تم إيقاف البوت');
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
          <div className={`w-2 h-2 rounded-full ${project.status === 'running' ? 'bg-success' : project.status === 'deploying' ? 'bg-warning animate-pulse' : 'bg-muted-foreground'}`} />
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowConsole(!showConsole)}>
            <Terminal className="w-4 h-4" />
          </Button>
          {project.status === 'running' ? (
            <Button size="sm" variant="destructive" onClick={handleStopBot}>
              <Square className="w-4 h-4 ml-1" /> إيقاف
            </Button>
          ) : (
            <Button size="sm" className="gradient-bg text-primary-foreground" onClick={handleStartBot} disabled={project.status === 'deploying'}>
              <Play className="w-4 h-4 ml-1" /> تشغيل
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
          {/* Editor */}
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

          {/* Console */}
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
    </div>
  );
}
