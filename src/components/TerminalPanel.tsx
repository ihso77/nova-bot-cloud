import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RotateCcw, Maximize2, Minimize2, X } from 'lucide-react';

// Import xterm CSS
import '@xterm/xterm/css/xterm.css';

const PROXY_WS_URL = 'wss://mmvdflwchecvzxzsumlm.supabase.co/functions/v1/nova-api';

export interface TerminalPanelHandle {
  reconnect: () => void;
}

interface TerminalPanelProps {
  serviceId: string | null;
  projectName: string;
  botLanguage: string;
}

const TerminalPanel = forwardRef<TerminalPanelHandle, TerminalPanelProps>(({ serviceId, projectName, botLanguage }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useImperativeHandle(ref, () => ({
    reconnect: connectWebSocket,
  }));

  const writeLine = (text: string, color?: string) => {
    if (!xtermRef.current) return;
    const colorCode = color ? `\x1b[${color}m` : '\x1b[0m';
    xtermRef.current.writeln(`${colorCode}${text}\x1b[0m`);
  };

  const showWelcome = () => {
    if (!xtermRef.current) return;
    xtermRef.current.writeln('\x1b[1;35m╔══════════════════════════════════════╗\x1b[0m');
    xtermRef.current.writeln('\x1b[1;35m║        \x1b[1;36mNova VPS Terminal\x1b[1;35m            ║\x1b[0m');
    xtermRef.current.writeln('\x1b[1;35m╚══════════════════════════════════════╝\x1b[0m');
    xtermRef.current.writeln('');
    xtermRef.current.writeln(`\x1b[90m مشروع: \x1b[97m${projectName}\x1b[0m`);
    xtermRef.current.writeln(`\x1b[90m اللغة:  \x1b[97m${botLanguage}\x1b[0m`);
    xtermRef.current.writeln(`\x1b[90m الحالة: \x1b[33mبانتظار الاتصال...\x1b[0m`);
    xtermRef.current.writeln('');
  };

  const connectWebSocket = () => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      try { wsRef.current.close(); } catch {}
    }

    if (!serviceId) {
      setStatus('disconnected');
      if (xtermRef.current) {
        xtermRef.current.clear();
        showWelcome();
        writeLine('\x1b[33m⚠ البوت غير مشغل. شغّل البوت أولاً للوصول للطرفية.\x1b[0m');
        writeLine('');
        writeLine('\x1b[90mاضغط على زر "تشغيل" أعلاه لبدء البوت ثم أعد محاولة الاتصال.\x1b[0m');
      }
      return;
    }

    setStatus('connecting');
    if (xtermRef.current) {
      xtermRef.current.clear();
      showWelcome();
      writeLine('\x1b[33mجاري الاتصال بالخادم...\x1b[0m');
    }

    try {
      const ws = new WebSocket(`${PROXY_WS_URL}/terminal?serviceId=${encodeURIComponent(serviceId)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        if (xtermRef.current) {
          xtermRef.current.clear();
          showWelcome();
          writeLine('\x1b[32m✓ تم الاتصال بنجاح!\x1b[0m');
          writeLine('\x1b[90mاكتب الأوامر واضغط Enter\x1b[0m');
          writeLine('\x1b[90m────────────────────────────────────\x1b[0m');
          writeLine('');
        }
      };

      ws.onmessage = (event) => {
        if (!xtermRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'output' || data.type === 'stdout') {
            xtermRef.current.write(data.data);
          } else if (data.type === 'stderr') {
            xtermRef.current.write(`\x1b[31m${data.data}\x1b[0m`);
          } else if (data.type === 'exit') {
            writeLine(`\x1b[33mتم إنهاء العملية (رمز الخروج: ${data.code || 0})\x1b[0m`);
          } else if (data.type === 'error') {
            writeLine(`\x1b[31mخطأ: ${data.message}\x1b[0m`);
          }
        } catch {
          // Raw text output
          xtermRef.current.write(event.data);
        }
      };

      ws.onclose = (event) => {
        setStatus('disconnected');
        if (xtermRef.current && event.code !== 1000) {
          writeLine('');
          writeLine('\x1b[33m⚠ تم قطع الاتصال\x1b[0m');
          writeLine('\x1b[90mسيتم محاولة إعادة الاتصال تلقائياً...\x1b[0m');
          // Auto reconnect after 5 seconds
          reconnectTimerRef.current = setTimeout(() => {
            connectWebSocket();
          }, 5000);
        }
      };

      ws.onerror = () => {
        setStatus('error');
        if (xtermRef.current) {
          writeLine('');
          writeLine('\x1b[31m✗ فشل الاتصال بالخادم\x1b[0m');
          writeLine('\x1b[90mتأكد أن البوت يعمل وحاول مرة أخرى.\x1b[0m');
          writeLine('');
          writeLine('\x1b[90mملاحظة: يجب أن يدعم الخادم بروتوكول الطرفية (WebSocket).\x1b[0m');
        }
      };
    } catch (err) {
      setStatus('error');
      writeLine('\x1b[31mخطأ في إنشاء الاتصال\x1b[0m');
    }
  };

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: '#0a0a0f',
        foreground: '#e4e4e7',
        cursor: '#60a5fa',
        cursorAccent: '#0a0a0f',
        selectionBackground: 'rgba(96, 165, 250, 0.3)',
        selectionForeground: '#ffffff',
        black: '#1a1a2e',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e4e4e7',
        brightBlack: '#525270',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
      allowTransparency: true,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Handle terminal input
    xterm.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      } else if (status === 'disconnected' || status === 'error') {
        // If not connected, write locally and show message
        if (data === '\r' || data === '\n') {
          xterm.writeln('');
        } else {
          xterm.write(data);
        }
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch {}
      // Notify server about resize
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'resize',
          cols: xterm.cols,
          rows: xterm.rows,
        }));
      }
    });
    resizeObserver.observe(terminalRef.current);

    showWelcome();

    return () => {
      resizeObserver.disconnect();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        try { wsRef.current.close(); } catch {}
      }
      xterm.dispose();
      xtermRef.current = null;
    };
  }, []);

  // Connect when serviceId changes
  useEffect(() => {
    if (serviceId) {
      connectWebSocket();
    } else {
      setStatus('disconnected');
      if (xtermRef.current) {
        xtermRef.current.clear();
        showWelcome();
        writeLine('\x1b[33m⚠ البوت غير مشغل. شغّل البوت أولاً للوصول للطرفية.\x1b[0m');
        writeLine('');
        writeLine('\x1b[90mاضغط على زر "تشغيل" أعلاه لبدء البوت ثم أعد محاولة الاتصال.\x1b[0m');
      }
    }
  }, [serviceId]);

  // Re-fit on fullscreen toggle
  useEffect(() => {
    setTimeout(() => {
      try { fitAddonRef.current?.fit(); } catch {}
    }, 100);
  }, [isFullscreen]);

  const handleReconnect = () => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    connectWebSocket();
  };

  const statusConfig = {
    connected: { color: 'bg-green-500/20 text-green-400', label: 'متصل', Icon: Wifi },
    connecting: { color: 'bg-yellow-500/20 text-yellow-400', label: 'جاري الاتصال...', Icon: Wifi },
    disconnected: { color: 'bg-gray-500/20 text-gray-400', label: 'غير متصل', Icon: WifiOff },
    error: { color: 'bg-red-500/20 text-red-400', label: 'خطأ في الاتصال', Icon: WifiOff },
  };

  const { color, label, Icon } = statusConfig[status];

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0a0a0f] flex flex-col" dir="ltr">
        <div className="flex items-center justify-between px-4 py-2 bg-[#12121a] border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 cursor-pointer" onClick={() => setIsFullscreen(false)} />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-gray-400 ml-4 font-mono">nova-bot:~$</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-[10px] ${color}`}>
              <Icon className="w-3 h-3 ml-1" />
              {label}
            </Badge>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-white" onClick={() => setIsFullscreen(false)}>
              <Minimize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div ref={terminalRef} className="flex-1 p-2" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" dir="ltr">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 flex-shrink-0" dir="rtl">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs font-semibold font-mono">Terminal</span>
          <Badge className={`h-4 text-[10px] px-1.5 ${color}`}>
            <Icon className="w-3 h-3 ml-1" />
            {label}
          </Badge>
        </div>
        <div className="flex gap-0.5">
          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px] text-gray-400" onClick={handleReconnect} title="إعادة الاتصال">
            <RotateCcw className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-gray-400" onClick={() => setIsFullscreen(true)} title="ملء الشاشة">
            <Maximize2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {/* Terminal Body */}
      <div ref={terminalRef} className="flex-1 min-h-0 p-1" />
    </div>
  );
});

TerminalPanel.displayName = 'TerminalPanel';

export default TerminalPanel;
