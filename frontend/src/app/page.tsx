'use client';
import { useState } from 'react';
import { ChatPanel } from '../components/agent/ChatPanel';
import {
  LayoutDashboard, AppWindow, Users, KeyRound, DollarSign,
  FileText, Shield, Settings, ChevronRight, ChevronLeft,
  TrendingUp, TrendingDown, Bell, Search, AlertTriangle,
  Calendar, Zap, RefreshCw, CheckCircle2, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from 'recharts';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const CF = {
  navy:   '#262D3E',
  blue:   '#0129AC',
  teal:   '#14CFC3',
  body:   '#2E2E2E',
  muted:  '#707070',
  offwhite: '#F1F3F8',
  border: '#EBEBEB',
  lightbg:'#E1ECFF',
};

// ── Sidebar nav ───────────────────────────────────────────────────────────────
const NAV_MAIN = [
  { icon: LayoutDashboard, label: 'Dashboard',    active: true },
  { icon: AppWindow,       label: 'Applications'              },
  { icon: Users,           label: 'Users'                     },
  { icon: KeyRound,        label: 'Licenses'                  },
  { icon: DollarSign,      label: 'Spend'                     },
  { icon: FileText,        label: 'Contracts'                 },
];
const NAV_MGMT = [
  { icon: Shield,   label: 'Shadow IT', badge: 4 },
  { icon: Settings, label: 'Settings'            },
];

// ── Alert strip ───────────────────────────────────────────────────────────────
const ALERTS = [
  { icon: AlertTriangle, title: '4 Shadow IT Apps',  sub: 'Unapproved apps detected', color: '#F0114B', gradient: 'linear-gradient(135deg, #FFF0F3 0%, #FFE4EA 100%)', border: '#FFCCD6', cta: 'Review →' },
  { icon: Calendar,      title: '3 Renewals Due',    sub: 'Contracts in next 30 days', color: '#F59E0B', gradient: 'linear-gradient(135deg, #FFFBEB 0%, #FFF3CC 100%)', border: '#FDE68A', cta: 'View →'   },
  { icon: CheckCircle2,  title: '$963 Savings Found',sub: 'From 12 unused licences',   color: '#0ED380', gradient: 'linear-gradient(135deg, #EFFDF7 0%, #D6FAF0 100%)', border: '#A7F3D0', cta: 'Reclaim →'},
];

// ── KPI cards ─────────────────────────────────────────────────────────────────
const KPIS = [
  { icon: AppWindow,  label: 'Total Applications', value: '181',     sub: 'In portfolio',         trend: '+12 this month',     up: true,  iconColor: '#14CFC3', iconBg: '#E0FBF9' },
  { icon: Users,      label: 'Active Users',        value: '29,402', sub: 'Across all apps',      trend: '+340 this week',     up: true,  iconColor: '#0129AC', iconBg: '#E1ECFF' },
  { icon: DollarSign, label: 'Monthly Spend',        value: '$14.4K', sub: 'Total SaaS spend',     trend: '−$1.2K vs last mo.', up: false, iconColor: '#4A75E3', iconBg: '#EEF1FF' },
  { icon: Zap,        label: 'Potential Savings',    value: '$963',   sub: 'Recoverable spend',    trend: '12 unused seats',    up: true,  iconColor: '#0ED380', iconBg: '#EFFDF7' },
];

// ── Spend trend (6 months) ────────────────────────────────────────────────────
const SPEND_TREND = [
  { month: 'Oct', spend: 13200, budget: 15000 },
  { month: 'Nov', spend: 13800, budget: 15000 },
  { month: 'Dec', spend: 15600, budget: 15000 },
  { month: 'Jan', spend: 13600, budget: 15000 },
  { month: 'Feb', spend: 15200, budget: 15000 },
  { month: 'Mar', spend: 14400, budget: 15000 },
];

// ── Category donut ────────────────────────────────────────────────────────────
const CATEGORY_DATA = [
  { name: 'Communication',        value: 32, color: '#0129AC' },
  { name: 'Productivity',         value: 28, color: '#14CFC3' },
  { name: 'HR & Recruiting',      value: 18, color: '#4A75E3' },
  { name: 'Marketing & Sales',    value: 22, color: '#809EFC' },
  { name: 'Engineering',          value: 15, color: '#254FC8' },
  { name: 'Finance',              value: 12, color: '#8FBCF7' },
  { name: 'Other',                value: 54, color: '#ADCEFA' },
];

// ── Top spend apps ────────────────────────────────────────────────────────────
const SPEND_DATA_ALL = [
  { name: 'Salesforce', spend: 4200 },
  { name: 'Zoom',       spend: 3100 },
  { name: 'Slack',      spend: 2800 },
  { name: 'GitHub',     spend: 2400 },
  { name: 'Figma',      spend: 2100 },
  { name: 'Jira',       spend: 1900 },
  { name: 'Notion',     spend: 1600 },
  { name: 'HubSpot',    spend: 1400 },
  { name: 'Okta',       spend: 1200 },
  { name: 'Workday',    spend: 1100 },
];

// ── User activity ─────────────────────────────────────────────────────────────
const USERS_DATA = [
  { name: 'Salesforce', active: 320, inactive: 48  },
  { name: 'Slack',      active: 890, inactive: 102 },
  { name: 'Zoom',       active: 740, inactive: 88  },
  { name: 'GitHub',     active: 210, inactive: 34  },
  { name: 'Figma',      active: 145, inactive: 52  },
  { name: 'Jira',       active: 280, inactive: 61  },
  { name: 'Notion',     active: 195, inactive: 29  },
  { name: 'Okta',       active: 410, inactive: 15  },
];

// ── Custom tooltip ────────────────────────────────────────────────────────────
function SpendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #EBEBEB', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <p style={{ fontWeight: 600, color: CF.body, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: ${p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const devToken = process.env.NEXT_PUBLIC_DEV_TOKEN ?? 'dev';
  const [spendFilter,  setSpendFilter]  = useState<'top5' | 'all'>('top5');
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const spendData = spendFilter === 'top5' ? SPEND_DATA_ALL.slice(0, 5) : SPEND_DATA_ALL;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: CF.offwhite, fontFamily: "'Poppins', sans-serif" }}
    >

      {/* ══════════════════════════ SIDEBAR ════════════════════════════════ */}
      <aside
        className="flex-shrink-0 flex flex-col transition-all duration-300"
        style={{ background: CF.navy, width: sidebarOpen ? 220 : 64 }}
      >

        {/* Logo + collapse toggle */}
        <div
          className="flex items-center px-4 py-[18px]"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', gap: sidebarOpen ? 10 : 0 }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${CF.blue}, ${CF.teal})` }}
          >
            <Shield size={14} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-white leading-none">CloudFuze</p>
              <p className="text-[10px] font-medium" style={{ color: CF.teal }}>Manage</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex-shrink-0 p-1 rounded-md transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.45)', marginLeft: sidebarOpen ? 0 : 'auto' }}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
        </div>

        {/* Nav — Main */}
        <nav className="flex-1 py-4 overflow-y-auto" style={{ padding: sidebarOpen ? '16px 12px' : '16px 8px' }}>
          {sidebarOpen && (
            <p className="text-[9px] font-semibold uppercase tracking-widest px-3 mb-2"
              style={{ color: 'rgba(255,255,255,0.28)' }}>
              Main
            </p>
          )}
          <div className="space-y-0.5">
            {NAV_MAIN.map(({ icon: Icon, label, active }) => (
              <button
                key={label}
                title={!sidebarOpen ? label : undefined}
                className="w-full flex items-center rounded-lg text-sm transition-all"
                style={{
                  background: active ? CF.blue : 'transparent',
                  color:      active ? '#fff' : 'rgba(255,255,255,0.5)',
                  fontWeight: active ? 600 : 400,
                  gap:        sidebarOpen ? 12 : 0,
                  padding:    sidebarOpen ? '10px 12px' : '10px 0',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Icon size={16} className="flex-shrink-0" />
                {sidebarOpen && <span className="flex-1 text-left">{label}</span>}
                {sidebarOpen && active && <ChevronRight size={12} />}
              </button>
            ))}
          </div>

          {/* Nav — Management */}
          {sidebarOpen && (
            <p className="text-[9px] font-semibold uppercase tracking-widest px-3 mt-5 mb-2"
              style={{ color: 'rgba(255,255,255,0.28)' }}>
              Management
            </p>
          )}
          {!sidebarOpen && <div className="my-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />}
          <div className="space-y-0.5">
            {NAV_MGMT.map(({ icon: Icon, label, badge }) => (
              <button
                key={label}
                title={!sidebarOpen ? label : undefined}
                className="w-full flex items-center rounded-lg text-sm transition-all relative"
                style={{
                  background: 'transparent',
                  color:      'rgba(255,255,255,0.5)',
                  gap:        sidebarOpen ? 12 : 0,
                  padding:    sidebarOpen ? '10px 12px' : '10px 0',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Icon size={16} className="flex-shrink-0" />
                {sidebarOpen && <span className="flex-1 text-left">{label}</span>}
                {badge && sidebarOpen && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#FF1F1F', color: '#fff' }}>
                    {badge}
                  </span>
                )}
                {badge && !sidebarOpen && (
                  <span
                    className="absolute top-1 right-1 w-2 h-2 rounded-full"
                    style={{ background: '#FF1F1F' }}
                  />
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Org / user footer */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center" style={{ gap: sidebarOpen ? 10 : 0, justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${CF.blue}, ${CF.teal})` }}
            >
              A
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-white truncate">sacontain</p>
                <p className="text-[10px]" style={{ color: CF.teal }}>Admin</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ══════════════════════ MAIN CONTENT ═══════════════════════════════ */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header className="flex-shrink-0 bg-white flex items-center justify-between px-8 py-4"
          style={{ borderBottom: `1px solid ${CF.border}` }}>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: CF.body }}>Dashboard</h1>
            <p className="text-[11px]" style={{ color: CF.muted }}>Good morning, Admin · March 24, 2026</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: '#FAFAFA', border: `1px solid ${CF.border}`, color: CF.muted, width: 210 }}
            >
              <Search size={13} />
              <span>Search apps, users…</span>
            </div>

            {/* Notification bell */}
            <button
              className="relative p-2 rounded-lg transition-colors hover:bg-gray-50"
              style={{ color: CF.muted }}
            >
              <Bell size={17} />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: '#FF1F1F' }}
              />
            </button>

            {/* Refresh */}
            <button
              className="p-2 rounded-lg transition-colors hover:bg-gray-50"
              style={{ color: CF.muted }}
            >
              <RefreshCw size={15} />
            </button>

            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: `linear-gradient(135deg, ${CF.blue}, ${CF.teal})` }}
            >
              A
            </div>
          </div>
        </header>

        {/* ── Scrollable body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-8 py-5 space-y-5">

          {/* ── Alert strip ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            {ALERTS.map(({ icon: Icon, title, sub, color, gradient, border, cta }) => (
              <div
                key={title}
                className="flex items-center gap-3 rounded-xl px-4 py-3.5 border cursor-pointer transition-all hover:shadow-md"
                style={{ background: gradient, borderColor: border }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: color + '22' }}
                >
                  <Icon size={16} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: CF.body }}>{title}</p>
                  <p className="text-[11px]" style={{ color: CF.muted }}>{sub}</p>
                </div>
                <span className="text-xs font-semibold flex-shrink-0" style={{ color }}>{cta}</span>
              </div>
            ))}
          </div>

          {/* ── KPI Cards ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4">
            {KPIS.map(({ icon: Icon, label, value, sub, trend, up, iconColor, iconBg }) => (
              <div
                key={label}
                className="bg-white rounded-xl border p-5 transition-shadow hover:shadow-md"
                style={{ borderColor: CF.border }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: iconBg }}
                  >
                    <Icon size={18} style={{ color: iconColor }} />
                  </div>
                  <span
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color:      up ? '#0ED380' : '#FF5CCE',
                      background: up ? '#EFFDF7' : '#FFF0FB',
                    }}
                  >
                    {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                    {trend.split(' ')[0]}
                  </span>
                </div>
                <p className="text-2xl font-bold mb-0.5" style={{ color: CF.body }}>{value}</p>
                <p className="text-xs font-medium" style={{ color: CF.body }}>{label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: CF.muted }}>{sub}</p>
              </div>
            ))}
          </div>

          {/* ── Row 1: Spend Trend + Category Donut ──────────────────────── */}
          <div className="grid grid-cols-5 gap-4">

            {/* Area chart — monthly spend vs budget */}
            <div className="col-span-3 bg-white rounded-xl border p-5" style={{ borderColor: CF.border }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: CF.body }}>Monthly Spend Trend</p>
                  <p className="text-[11px]" style={{ color: CF.muted }}>Last 6 months vs. $15K budget</p>
                </div>
                <div className="flex items-center gap-5 text-[11px]" style={{ color: CF.muted }}>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-6 h-0.5 rounded" style={{ background: CF.blue }} />
                    Actual
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-6 h-0.5 rounded border-t border-dashed" style={{ borderColor: CF.muted }} />
                    Budget
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={SPEND_TREND} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={CF.blue} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={CF.blue} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: CF.muted }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: CF.muted }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<SpendTooltip />} />
                  <Area
                    type="monotone" dataKey="budget" name="Budget"
                    stroke={CF.border} strokeWidth={1.5} strokeDasharray="5 4" fill="none"
                  />
                  <Area
                    type="monotone" dataKey="spend" name="Actual"
                    stroke={CF.blue} strokeWidth={2.5} fill="url(#spendGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Donut — apps by category */}
            <div className="col-span-2 bg-white rounded-xl border p-5" style={{ borderColor: CF.border }}>
              <div className="mb-3">
                <p className="text-sm font-semibold" style={{ color: CF.body }}>Apps by Category</p>
                <p className="text-[11px]" style={{ color: CF.muted }}>181 total apps</p>
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={CATEGORY_DATA} cx="50%" cy="44%"
                    innerRadius={52} outerRadius={78}
                    paddingAngle={2} dataKey="value"
                  >
                    {CATEGORY_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => [`${v} apps`, '']}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 9 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Row 2: Top Spend + User Activity ─────────────────────────── */}
          <div className="grid grid-cols-5 gap-4">

            {/* Bar — top spend apps */}
            <div className="col-span-2 bg-white rounded-xl border p-5" style={{ borderColor: CF.border }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: CF.body }}>Top Spend Apps</p>
                  <p className="text-[11px]" style={{ color: CF.muted }}>This month</p>
                </div>
                <div className="flex gap-1">
                  {(['top5', 'all'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setSpendFilter(f)}
                      className="text-xs px-2.5 py-1 rounded font-medium transition-colors"
                      style={{
                        background: spendFilter === f ? CF.blue : '#F1F1F1',
                        color:      spendFilter === f ? '#fff'  : CF.muted,
                      }}
                    >
                      {f === 'top5' ? 'Top 5' : 'All'}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={spendData} margin={{ top: 0, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: CF.muted }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 9, fill: CF.muted }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: any) => [`$${v.toLocaleString()}`, 'Spend']}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Bar dataKey="spend" fill={CF.blue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Horizontal bar — active vs inactive */}
            <div className="col-span-3 bg-white rounded-xl border p-5" style={{ borderColor: CF.border }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: CF.body }}>User Activity by App</p>
                  <p className="text-[11px]" style={{ color: CF.muted }}>Active vs. inactive users</p>
                </div>
                <div className="flex items-center gap-4 text-[11px]" style={{ color: CF.muted }}>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ background: CF.blue }} />
                    Active
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#FF5CCE' }} />
                    Inactive
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={USERS_DATA} layout="vertical"
                  margin={{ top: 0, right: 20, left: 55, bottom: 0 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: CF.muted }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="name" type="category"
                    tick={{ fontSize: 9, fill: CF.muted }}
                    axisLine={false} tickLine={false} width={52}
                  />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="active"   name="Active"   fill={CF.blue}   radius={[0, 3, 3, 0]} />
                  <Bar dataKey="inactive" name="Inactive" fill="#FF5CCE"   radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>{/* end scrollable */}
      </main>

      {/* ── Floating AI panel ─────────────────────────────────────────────────── */}
      <ChatPanel token={devToken} />
    </div>
  );
}
