'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, Loader2, RotateCcw,
  Sparkles, Plus, Zap, BarChart2, Shield, Clock,
  Copy, Check, Search, MessageSquare, Trash2,
  LayoutGrid, ChevronDown,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  askAgent, executeAction, clearSession, setSessionId, Widget,
} from '../../services/agentApi';
import { WidgetRenderer } from './widgets/WidgetRenderer';
import { PreviewPanel } from './widgets/PreviewPanel';

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  widgets?: Widget[];
  followUp?: string[];
  runId?: string | null;
  isError?: boolean;
  durationMs?: number;
}

interface LocalSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  backendSessionId: string | null;
}

// ── Brand tokens ─────────────────────────────────────────────────────────────
const CF = {
  navy:    '#262D3E',
  blue:    '#0129AC',
  teal:    '#14CFC3',
  body:    '#2E2E2E',
  muted:   '#707070',
  offwhite:'#F6F6F6',
  lightbg: '#E1ECFF',
  lightbg2:'#C6D5FA',
  border:  '#EBEBEB',
} as const;

// ── Session persistence ───────────────────────────────────────────────────────
const SESSIONS_KEY       = 'cf_chat_sessions';
const ACTIVE_SESSION_KEY = 'cf_active_session';

function loadSessions(): LocalSession[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]'); }
  catch { return []; }
}

function saveSessions(s: LocalSession[]) {
  if (typeof window !== 'undefined') localStorage.setItem(SESSIONS_KEY, JSON.stringify(s));
}

function groupByDate(sessions: LocalSession[]) {
  const todayStart     = new Date(); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const groups: Record<'Today' | 'Yesterday' | 'Earlier', LocalSession[]> = {
    Today: [], Yesterday: [], Earlier: [],
  };
  for (const s of sessions) {
    if      (s.createdAt >= todayStart.getTime())     groups.Today.push(s);
    else if (s.createdAt >= yesterdayStart.getTime()) groups.Yesterday.push(s);
    else                                              groups.Earlier.push(s);
  }
  return groups;
}

// ── Starter prompts ───────────────────────────────────────────────────────────
const STARTERS = [
  { icon: BarChart2, label: 'Portfolio overview',    text: 'Give me an overview of our SaaS portfolio'        },
  { icon: Zap,       label: 'Unused licences',       text: 'Who has unused licences across all apps?'         },
  { icon: Clock,     label: 'Upcoming renewals',     text: 'What contracts renew in the next 60 days?'        },
  { icon: Shield,    label: 'Shadow IT',             text: 'Show me shadow IT apps discovered recently'       },
  { icon: BarChart2, label: 'SaaS spend this month', text: 'What is our total SaaS spend this month?'         },
  { icon: Zap,       label: 'Over-provisioned',      text: "Show me users with access to apps they don't use" },
];

// ── Loading status (CP-04) ───────────────────────────────────────────────────
const LOADING_STEPS = [
  { icon: '🔍', label: 'Classifying your question...',  ms: 0     },
  { icon: '⚡', label: 'Calling GPT-4o...',             ms: 1200  },
  { icon: '🗄️', label: 'Querying your SaaS data...',    ms: 3000  },
  { icon: '📊', label: 'Analyzing results...',           ms: 6000  },
  { icon: '✍️', label: 'Building response...',           ms: 10000 },
];

// ── Preview panel helpers ────────────────────────────────────────────────────
const PREVIEW_WIDGET_TYPES = new Set(['metric_cards', 'bar_chart', 'donut_chart', 'timeline']);

function getPreviewableWidgets(widgets?: Widget[]): Widget[] {
  return widgets?.filter((w) => PREVIEW_WIDGET_TYPES.has(w.type)) ?? [];
}

function getPreviewLabel(widgets?: Widget[]): string {
  const previewable = getPreviewableWidgets(widgets);
  if (previewable.length === 0) return '';
  if (previewable.length === 1) {
    const w = previewable[0];
    if (w.type === 'metric_cards') return `${w.cards?.length ?? 0} Metrics`;
    if (w.type === 'bar_chart') return w.title ?? 'Bar Chart';
    if (w.type === 'donut_chart') return w.title ?? 'Donut Chart';
    if (w.type === 'timeline') return w.title ?? 'Timeline';
  }
  let count = 0;
  for (const w of previewable) {
    if (w.type === 'metric_cards') count += w.cards?.length ?? 0;
    else count++;
  }
  return `${count} Visualizations`;
}

function LoadingStatus() {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    LOADING_STEPS.forEach((step, i) => {
      if (i === 0) return;
      timers.push(setTimeout(() => setStepIdx(i), step.ms));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const step = LOADING_STEPS[stepIdx];

  return (
    <div className="flex flex-col gap-2">
      <motion.div
        key={stepIdx}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center gap-2"
      >
        <span className="text-sm">{step.icon}</span>
        <span className="text-sm font-medium" style={{ color: CF.body }}>{step.label}</span>
        <span className="flex gap-1 ml-0.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1 h-1 rounded-full block"
              style={{ background: CF.teal }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </span>
      </motion.div>
      {stepIdx > 0 && (
        <div className="flex flex-col gap-0.5 pl-0.5">
          {LOADING_STEPS.slice(0, stepIdx).map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[11px]" style={{ color: CF.teal }}>✓</span>
              <span className="text-[11px]" style={{ color: CF.muted }}>{s.label.replace('...', '')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Copy button (CP-08) ───────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  return (
    <button
      onClick={handle}
      title="Copy response"
      className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors"
      style={{ color: copied ? CF.teal : CF.muted }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      <span>{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  );
}

// ── CF avatar ─────────────────────────────────────────────────────────────────
function CFAvatar({ size = 8 }: { size?: number }) {
  const px = size * 4;
  return (
    <div
      className={`w-${size} h-${size} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}
      style={{ background: `linear-gradient(135deg, ${CF.blue} 0%, ${CF.teal} 100%)`, width: px, height: px, minWidth: px }}
    >
      <Sparkles size={Math.round(px * 0.45)} className="text-white" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface ChatPanelProps { token: string }

export function ChatPanel({ token }: ChatPanelProps) {
  const [open,      setOpen]      = useState(false);
  const [sessions,  setSessions]  = useState<LocalSession[]>([]);
  const [activeId,  setActiveId]  = useState<string | null>(null);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');

  // Preview panel state
  const [previewOpen,    setPreviewOpen]    = useState(false);
  const [previewWidgets, setPreviewWidgets] = useState<Widget[]>([]);
  const [previewTitle,   setPreviewTitle]   = useState('');
  const [previewMsgId,   setPreviewMsgId]   = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const messages      = activeSession?.messages ?? [];

  // ── Load sessions from localStorage ──────────────────────────────────────
  useEffect(() => {
    const loaded     = loadSessions();
    const savedActive = localStorage.getItem(ACTIVE_SESSION_KEY);
    setSessions(loaded);
    if (savedActive && loaded.some((s) => s.id === savedActive)) {
      setActiveId(savedActive);
      const sess = loaded.find((s) => s.id === savedActive);
      if (sess?.backendSessionId) setSessionId(sess.backendSessionId);
    }
  }, []);

  // ── Ctrl+K toggle ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Focus on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Textarea auto-resize ──────────────────────────────────────────────────
  const resizeTextarea = () => {
    const t = inputRef.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 200)}px`;
  };

  // ── Session helpers ───────────────────────────────────────────────────────
  const createNewSession = useCallback((): LocalSession => {
    clearSession();
    const s: LocalSession = {
      id: Date.now().toString(),
      title: 'New conversation',
      messages: [],
      createdAt: Date.now(),
      backendSessionId: null,
    };
    setSessions((prev) => {
      const updated = [s, ...prev];
      saveSessions(updated);
      return updated;
    });
    setActiveId(s.id);
    localStorage.setItem(ACTIVE_SESSION_KEY, s.id);
    setInput('');
    return s;
  }, []);

  const switchSession = (sessionId: string) => {
    const sess = sessions.find((s) => s.id === sessionId);
    if (!sess) return;
    setActiveId(sessionId);
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    setSessionId(sess.backendSessionId);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      saveSessions(updated);
      return updated;
    });
    if (activeId === sessionId) {
      const remaining = sessions.filter((s) => s.id !== sessionId);
      if (remaining.length > 0) {
        switchSession(remaining[0].id);
      } else {
        setActiveId(null);
        localStorage.removeItem(ACTIVE_SESSION_KEY);
        clearSession();
      }
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || loading) return;

      // Ensure a session exists
      let sid = activeId;
      let currentSessions = sessions;

      if (!sid || !sessions.find((s) => s.id === sid)) {
        clearSession();
        const newSess: LocalSession = {
          id: Date.now().toString(),
          title: question.trim().slice(0, 42) + (question.trim().length > 42 ? '…' : ''),
          messages: [],
          createdAt: Date.now(),
          backendSessionId: null,
        };
        currentSessions = [newSess, ...sessions];
        saveSessions(currentSessions);
        setSessions(currentSessions);
        setActiveId(newSess.id);
        localStorage.setItem(ACTIVE_SESSION_KEY, newSess.id);
        sid = newSess.id;
      }

      const userMsg: Message = { id: Date.now().toString(), role: 'user', text: question };

      // Auto-title from first user message
      const existing = currentSessions.find((s) => s.id === sid)!;
      const newTitle  = existing.messages.length === 0
        ? question.trim().slice(0, 42) + (question.trim().length > 42 ? '…' : '')
        : existing.title;

      const withUser = currentSessions.map((s) =>
        s.id === sid ? { ...s, title: newTitle, messages: [...s.messages, userMsg] } : s,
      );
      saveSessions(withUser);
      setSessions(withUser);
      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      setLoading(true);

      try {
        const res = await askAgent(question, token);
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: res.text,
          widgets: res.widgets,
          followUp: res.follow_up,
          runId: res.run_id,
          durationMs: res.duration_ms,
        };
        setSessions((prev) => {
          const updated = prev.map((s) =>
            s.id === sid
              ? { ...s, backendSessionId: res.session_id, messages: [...s.messages, assistantMsg] }
              : s,
          );
          saveSessions(updated);
          return updated;
        });

        // Auto-open preview panel for visual widgets
        const previewable = getPreviewableWidgets(res.widgets);
        if (previewable.length > 0) {
          setPreviewWidgets(previewable);
          setPreviewTitle(getPreviewLabel(res.widgets));
          setPreviewMsgId(assistantMsg.id);
          setPreviewOpen(true);
        }
      } catch (err: any) {
        const errMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: '',
          isError: true,
          widgets: [{ type: 'text_block', content: `Error: ${err.message}` }],
        };
        setSessions((prev) => {
          const updated = prev.map((s) =>
            s.id === sid ? { ...s, messages: [...s.messages, errMsg] } : s,
          );
          saveSessions(updated);
          return updated;
        });
      } finally {
        setLoading(false);
      }
    },
    [loading, token, sessions, activeId],
  );

  // CP-03: Enter = send, Shift+Enter = newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Write action handler
  const handleAction = async (action: string, payload: Record<string, any>, runId: string) => {
    try {
      const res = await executeAction(runId, action, payload, token);
      const msg: Message = { id: Date.now().toString(), role: 'assistant', text: '', widgets: res.widgets };
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === activeId ? { ...s, messages: [...s.messages, msg] } : s,
        );
        saveSessions(updated);
        return updated;
      });
    } catch (err: any) {
      const msg: Message = {
        id: Date.now().toString(), role: 'assistant', text: '', isError: true,
        widgets: [{ type: 'text_block', content: `Action failed: ${err.message}` }],
      };
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === activeId ? { ...s, messages: [...s.messages, msg] } : s,
        );
        saveSessions(updated);
        return updated;
      });
    }
  };

  // ── Preview panel toggle ──────────────────────────────────────────────────
  const togglePreview = useCallback((msgId: string, widgets: Widget[]) => {
    if (previewOpen && previewMsgId === msgId) {
      setPreviewOpen(false);
      setPreviewMsgId(null);
      return;
    }
    const previewable = getPreviewableWidgets(widgets);
    if (previewable.length === 0) return;
    setPreviewWidgets(previewable);
    setPreviewTitle(getPreviewLabel(widgets));
    setPreviewMsgId(msgId);
    setPreviewOpen(true);
  }, [previewOpen, previewMsgId]);

  // Filtered + grouped sessions for sidebar
  const filtered = sessions.filter((s) =>
    search ? s.title.toLowerCase().includes(search.toLowerCase()) : true,
  );
  const grouped = groupByDate(filtered);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full px-5 py-3 text-white shadow-xl transition-all hover:opacity-90 active:scale-95"
        style={{ background: `linear-gradient(135deg, ${CF.blue} 0%, ${CF.teal} 100%)`, fontFamily: "'Poppins', sans-serif" }}
        title="Open AI Assistant (Ctrl+K)"
      >
        <Sparkles size={16} />
        <span className="text-sm font-semibold">Ask AI</span>
      </button>

      {/* ── Full-screen overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >

            {/* ══════════════════════ LEFT SIDEBAR ══════════════════════════ */}
            <aside
              className="w-64 flex-shrink-0 flex flex-col overflow-hidden"
              style={{ background: CF.navy }}
            >
              {/* Logo ─────────────────────────────────────────────────────── */}
              <div
                className="flex items-center gap-2.5 px-4 py-4"
                style={{ borderBottom: `1px solid rgba(255,255,255,0.08)` }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${CF.blue}, ${CF.teal})` }}
                >
                  <Sparkles size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-none">CloudFuze AI</p>
                  <p className="text-[10px] mt-0.5 font-medium" style={{ color: CF.teal }}>
                    SaaS Assistant
                  </p>
                </div>
              </div>

              {/* New conversation button ──────────────────────────────────── */}
              <div className="px-3 pt-3 pb-2">
                <button
                  onClick={() => createNewSession()}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: CF.blue }}
                >
                  <Plus size={15} />
                  New conversation
                </button>
              </div>

              {/* Search ───────────────────────────────────────────────────── */}
              <div className="px-3 pb-2">
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <Search size={13} style={{ color: CF.muted }} />
                  <input
                    type="text"
                    placeholder="Search conversations…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-transparent text-xs text-white placeholder:text-gray-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Session list ─────────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-3 py-1 space-y-3">
                {(['Today', 'Yesterday', 'Earlier'] as const).map((group) => {
                  const items = grouped[group];
                  if (!items?.length) return null;
                  return (
                    <div key={group}>
                      <p
                        className="text-[10px] font-semibold uppercase tracking-widest mb-1 px-2"
                        style={{ color: CF.muted }}
                      >
                        {group}
                      </p>
                      <div className="space-y-0.5">
                        {items.map((sess) => {
                          const isActive = activeId === sess.id;
                          return (
                            <button
                              key={sess.id}
                              onClick={() => switchSession(sess.id)}
                              className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all group relative"
                              style={{
                                background:   isActive ? 'rgba(1,41,172,0.28)' : 'transparent',
                                borderLeft:   `2px solid ${isActive ? CF.teal : 'transparent'}`,
                                color:        isActive ? '#fff' : '#9ca3af',
                              }}
                              onMouseEnter={(e) => {
                                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                              }}
                            >
                              <MessageSquare size={12} className="flex-shrink-0 opacity-60" />
                              <span className="flex-1 truncate">{sess.title}</span>
                              <span
                                onClick={(e) => deleteSession(sess.id, e)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-red-400 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={11} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {sessions.length === 0 && (
                  <p className="text-xs text-center mt-10 px-4" style={{ color: CF.muted }}>
                    No conversations yet.
                    <br />
                    Start one below!
                  </p>
                )}
              </div>

              {/* Sidebar footer ───────────────────────────────────────────── */}
              <div
                className="px-4 py-3 text-center"
                style={{ borderTop: `1px solid rgba(255,255,255,0.08)` }}
              >
                <p className="text-[10px]" style={{ color: CF.muted }}>
                  Powered by GPT-4o · Ctrl+K to toggle
                </p>
              </div>
            </aside>

            {/* ═════════════════════ MAIN CONTENT ═══════════════════════════ */}
            <div className="flex-1 flex flex-col overflow-hidden" style={{ background: CF.offwhite }}>

              {/* Top bar ──────────────────────────────────────────────────── */}
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    style={{ color: CF.muted }}
                    title="Back to Dashboard"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <p className="text-sm font-semibold leading-none" style={{ color: CF.body }}>
                      {activeSession?.title ?? 'CloudFuze AI'}
                    </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] px-2 py-1 rounded-full border font-semibold"
                    style={{ color: CF.blue, borderColor: CF.blue, background: CF.lightbg }}
                  >
                    GPT-4o
                  </span>
                  <button
                    onClick={() => createNewSession()}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors font-medium"
                    style={{ color: CF.blue, background: CF.lightbg }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = CF.lightbg2; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = CF.lightbg; }}
                    title="Start a new conversation"
                  >
                    <Plus size={13} />
                    New chat
                  </button>
                </div>
              </div>

              {/* Messages area ────────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-4 py-8">

                  {/* Empty state + starter prompts */}
                  {messages.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col items-center text-center mb-10"
                    >
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${CF.blue} 0%, ${CF.teal} 100%)` }}
                      >
                        <Sparkles size={28} className="text-white" />
                      </div>
                      <h2 className="text-2xl font-semibold mb-2" style={{ color: CF.body }}>
                        How can I help you today?
                      </h2>
                      <p className="text-sm max-w-md" style={{ color: CF.muted }}>
                        Ask me anything about your SaaS portfolio — apps, licences, spend,
                        contracts, users, or shadow IT.
                      </p>

                      <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-xl">
                        {STARTERS.map(({ icon: Icon, label, text }) => (
                          <button
                            key={label}
                            onClick={() => sendMessage(text)}
                            className="flex items-start gap-3 text-left bg-white rounded-xl px-4 py-3.5 transition-all border"
                            style={{ borderColor: CF.lightbg }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.borderColor = CF.blue;
                              (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 10px rgba(1,41,172,0.12)`;
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.borderColor = CF.lightbg;
                              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                            }}
                          >
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ background: CF.lightbg }}
                            >
                              <Icon size={14} style={{ color: CF.blue }} />
                            </div>
                            <span className="text-sm font-medium leading-snug" style={{ color: CF.body }}>
                              {label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* CP-02: Message history */}
                  <div className="space-y-6">
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {msg.role === 'user' ? (
                          /* User bubble */
                          <div className="flex justify-end">
                            <div
                              className="max-w-[75%] text-white text-sm rounded-2xl rounded-br-sm px-5 py-3 leading-relaxed"
                              style={{ background: CF.blue }}
                            >
                              {msg.text}
                            </div>
                          </div>
                        ) : (
                          /* Assistant message */
                          <div className="flex gap-3 items-start group">
                            <CFAvatar size={8} />
                            <div className="flex-1 min-w-0 space-y-3">

                              {/* CP-02: Text summary — rendered as Markdown */}
                              {msg.text && (
                                <div
                                  className={`text-sm leading-relaxed ${msg.isError ? 'text-red-500' : ''}`}
                                  style={msg.isError ? {} : { color: CF.body }}
                                >
                                  <ReactMarkdown
                                    components={{
                                      p:      ({ children }) => <p className="mb-2 last:mb-0" style={{ color: 'inherit' }}>{children}</p>,
                                      strong: ({ children }) => <strong className="font-semibold" style={{ color: CF.body }}>{children}</strong>,
                                      em:     ({ children }) => <em>{children}</em>,
                                      ul:     ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                                      ol:     ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                                      li:     ({ children }) => <li>{children}</li>,
                                      h1:     ({ children }) => <h1 className="text-base font-semibold mb-1" style={{ color: CF.body }}>{children}</h1>,
                                      h2:     ({ children }) => <h2 className="text-sm font-semibold mb-1" style={{ color: CF.body }}>{children}</h2>,
                                      h3:     ({ children }) => <h3 className="text-sm font-medium mb-1" style={{ color: CF.body }}>{children}</h3>,
                                      code:   ({ children }) => <code className="bg-gray-100 text-xs px-1 py-0.5 rounded font-mono">{children}</code>,
                                      a:      ({ href, children }) => <a href={href} className="underline" style={{ color: CF.blue }} target="_blank" rel="noreferrer">{children}</a>,
                                    }}
                                  >
                                    {msg.text}
                                  </ReactMarkdown>
                                </div>
                              )}

                              {/* CP-02: Widgets below text — skip text_block if msg.text already shows it */}
                              {msg.widgets?.filter((w) => !(w.type === 'text_block' && msg.text)).map((w, i) => (
                                <WidgetRenderer
                                  key={i}
                                  widget={w}
                                  runId={msg.runId ?? undefined}
                                  onAction={
                                    msg.runId
                                      ? (action, payload) =>
                                          handleAction(action, payload, msg.runId!)
                                      : undefined
                                  }
                                />
                              ))}

                              {/* CP-05: Follow-up chips */}
                              {msg.followUp?.length ? (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {msg.followUp.map((q) => (
                                    <button
                                      key={q}
                                      onClick={() => sendMessage(q)}
                                      className="text-xs rounded-full px-3 py-1.5 border transition-colors font-medium"
                                      style={{ color: CF.blue, borderColor: CF.blue, background: CF.lightbg }}
                                      onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLElement).style.background = CF.lightbg2;
                                      }}
                                      onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLElement).style.background = CF.lightbg;
                                      }}
                                    >
                                      {q}
                                    </button>
                                  ))}
                                </div>
                              ) : null}

                              {/* Preview panel toggle for visual widgets */}
                              {getPreviewableWidgets(msg.widgets).length > 0 && (
                                <div className="pt-0.5">
                                  <button
                                    onClick={() => togglePreview(msg.id, msg.widgets!)}
                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all font-medium"
                                    style={{
                                      color: previewOpen && previewMsgId === msg.id ? '#fff' : CF.blue,
                                      borderColor: CF.blue,
                                      background: previewOpen && previewMsgId === msg.id ? CF.blue : CF.lightbg,
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!(previewOpen && previewMsgId === msg.id)) {
                                        (e.currentTarget as HTMLElement).style.background = CF.lightbg2;
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!(previewOpen && previewMsgId === msg.id)) {
                                        (e.currentTarget as HTMLElement).style.background = CF.lightbg;
                                      }
                                    }}
                                    title="Toggle visualization preview panel"
                                  >
                                    <LayoutGrid size={12} />
                                    <span>{getPreviewLabel(msg.widgets)}</span>
                                    <ChevronDown
                                      size={10}
                                      className="transition-transform"
                                      style={{
                                        transform: previewOpen && previewMsgId === msg.id ? 'rotate(180deg)' : 'none',
                                      }}
                                    />
                                  </button>
                                </div>
                              )}

                              {/* CP-08: Copy + duration */}
                              <div className="flex items-center gap-3 pt-0.5">
                                {msg.text && <CopyButton text={msg.text} />}
                                {msg.durationMs ? (
                                  <span
                                    className="text-[11px] flex items-center gap-1"
                                    style={{ color: CF.muted }}
                                  >
                                    <RotateCcw size={10} />
                                    {(msg.durationMs / 1000).toFixed(1)}s
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}

                    {/* CP-04: Typing indicator */}
                    {loading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3 items-start"
                      >
                        <CFAvatar size={8} />
                        <LoadingStatus />
                      </motion.div>
                    )}
                  </div>

                  <div ref={bottomRef} className="h-4" />
                </div>
              </div>

              {/* CP-03: Input bar ──────────────────────────────────────────── */}
              <div className="flex-shrink-0 pb-6 pt-2 px-4" style={{ background: CF.offwhite }}>
                <div className="max-w-3xl mx-auto">
                  <div
                    className="flex items-end gap-3 bg-white rounded-2xl shadow-sm px-4 py-3 border transition-all"
                    style={{ borderColor: CF.lightbg }}
                    onFocusCapture={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = CF.blue;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 3px rgba(1,41,172,0.08)`;
                    }}
                    onBlurCapture={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = CF.lightbg;
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about your SaaS portfolio…"
                      rows={1}
                      className="flex-1 resize-none bg-transparent text-sm focus:outline-none leading-relaxed placeholder:text-gray-400"
                      style={{ minHeight: '24px', maxHeight: '200px', color: CF.body }}
                    />
                    <button
                      onClick={() => sendMessage(input)}
                      disabled={!input.trim() || loading}
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95"
                      style={{
                        background: input.trim() && !loading ? CF.blue : '#F1F1F1',
                        color:      input.trim() && !loading ? '#fff'   : CF.muted,
                        cursor:     input.trim() && !loading ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {loading
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Send size={14} />
                      }
                    </button>
                  </div>
                  <p className="text-center text-[11px] mt-2" style={{ color: CF.muted }}>
                    Enter to send · Shift+Enter for new line · Ctrl+K to toggle
                  </p>
                </div>
              </div>

            </div>{/* end main */}

            {/* ═════════════════════ PREVIEW PANEL ═══════════════════════════ */}
            <AnimatePresence>
              {previewOpen && previewWidgets.length > 0 && (
                <PreviewPanel
                  widgets={previewWidgets}
                  title={previewTitle}
                  onClose={() => {
                    setPreviewOpen(false);
                    setPreviewMsgId(null);
                  }}
                />
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
