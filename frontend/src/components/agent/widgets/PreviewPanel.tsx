'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, LayoutGrid } from 'lucide-react';
import { Widget } from '../../../services/agentApi';
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

// ── Brand tokens (from CF Brand Guidelines) ─────────────────────────────────
const CF = {
  blue:    '#0129AC',
  teal:    '#14CFC3',
  body:    '#2E2E2E',
  muted:   '#707070',
  offwhite:'#F6F6F6',
  lightbg: '#E1ECFF',
  border:  '#EBEBEB',
} as const;

const BRAND_COLORS = [
  '#0129AC', '#14CFC3', '#0ED380', '#0065FF', '#FF5CCE',
  '#FE5833', '#A100FF', '#3FD6F1', '#FFE836', '#F0114B',
  '#20CC83', '#B70945',
];

const CARD_PALETTES = [
  { bg: '#E1ECFF', text: '#0129AC', label: '#4A75E3' },
  { bg: '#E0FAF8', text: '#0B8C83', label: '#14CFC3' },
  { bg: '#E8FAF0', text: '#0A7B4D', label: '#0ED380' },
  { bg: '#FFE5EB', text: '#B70945', label: '#F0114B' },
  { bg: '#FFF5E0', text: '#B8860B', label: '#FE5833' },
  { bg: '#F3E8FF', text: '#7B00CC', label: '#A100FF' },
];

const RISK_COLORS: Record<string, string> = {
  high: '#F0114B', medium: '#FE5833', low: '#0ED380',
};

// ── PreviewPanel ─────────────────────────────────────────────────────────────

interface PreviewPanelProps {
  widgets: Widget[];
  title: string;
  onClose: () => void;
}

export function PreviewPanel({ widgets, title, onClose }: PreviewPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 380, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="flex-shrink-0 flex flex-col overflow-hidden bg-white border-l"
      style={{ borderColor: CF.border }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: CF.border }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: CF.lightbg }}
          >
            <LayoutGrid size={14} style={{ color: CF.blue }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: CF.body }}>
            {title}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: CF.muted }}
          title="Close preview (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {widgets.map((w, i) => (
          <PreviewWidget key={i} widget={w} />
        ))}
      </div>
    </motion.aside>
  );
}

// ── Internal widget dispatcher ───────────────────────────────────────────────

function PreviewWidget({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case 'metric_cards':
      return <PrevMetricCards cards={widget.cards ?? []} />;
    case 'bar_chart':
      return <PrevBarChart title={widget.title} data={widget.data ?? []} />;
    case 'donut_chart':
      return <PrevDonutChart title={widget.title} data={widget.data ?? []} />;
    case 'timeline':
      return <PrevTimeline title={widget.title} items={widget.items ?? []} />;
    default:
      return null;
  }
}

// ── Brand-colored metric cards ───────────────────────────────────────────────

function PrevMetricCards({ cards }: { cards: any[] }) {
  if (!cards?.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card: any, i: number) => {
        const palette = CARD_PALETTES[i % CARD_PALETTES.length];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.04 }}
            className="rounded-xl p-4"
            style={{ background: palette.bg }}
          >
            <p className="text-xs font-medium truncate" style={{ color: palette.label }}>
              {card.label}
            </p>
            <p className="mt-1.5 text-2xl font-bold" style={{ color: palette.text }}>
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </p>
            {card.delta && (
              <p className="mt-1 text-[11px] font-medium" style={{ color: palette.label }}>
                {card.delta}
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Brand-colored bar chart ──────────────────────────────────────────────────

function PrevBarChart({ title, data }: { title?: string; data: any[] }) {
  if (!data?.length) return null;
  return (
    <div className="space-y-3">
      {title && (
        <p className="text-sm font-semibold" style={{ color: CF.body }}>{title}</p>
      )}
      <div className="rounded-xl p-4" style={{ background: CF.offwhite }}>
        <ResponsiveContainer width="100%" height={220}>
          <ReBarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CF.muted }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CF.muted }}
              tickLine={false}
              axisLine={false}
              width={50}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: `1px solid ${CF.border}`,
                fontFamily: 'Poppins, sans-serif',
              }}
              formatter={(v: any) => [Number(v).toLocaleString(), 'Value']}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((_: any, i: number) => (
                <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
              ))}
            </Bar>
          </ReBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Brand-colored donut chart ────────────────────────────────────────────────

function PrevDonutChart({ title, data }: { title?: string; data: any[] }) {
  if (!data?.length) return null;
  const total = data.reduce((s: number, d: any) => s + d.value, 0);

  return (
    <div className="space-y-3">
      {title && (
        <p className="text-sm font-semibold" style={{ color: CF.body }}>{title}</p>
      )}
      <div className="rounded-xl p-4" style={{ background: CF.offwhite }}>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
            >
              {data.map((entry: any, i: number) => (
                <Cell key={i} fill={entry.color ?? BRAND_COLORS[i % BRAND_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                fontFamily: 'Poppins, sans-serif',
              }}
              formatter={(v: any) => [
                `${Number(v).toLocaleString()} (${total > 0 ? ((Number(v) / total) * 100).toFixed(1) : 0}%)`,
                '',
              ]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => (
                <span style={{ fontSize: 11, color: CF.body }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Brand-colored timeline ───────────────────────────────────────────────────

function PrevTimeline({ title, items }: { title?: string; items: any[] }) {
  if (!items?.length) return null;

  return (
    <div className="space-y-3">
      {title && (
        <p className="text-sm font-semibold" style={{ color: CF.body }}>{title}</p>
      )}
      <div className="space-y-0">
        {items.map((item: any, i: number) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className="w-3 h-3 rounded-full border-2 mt-1.5 flex-shrink-0"
                style={{
                  borderColor: RISK_COLORS[item.risk?.toLowerCase()] ?? CF.blue,
                  background: 'white',
                }}
              />
              {i < items.length - 1 && (
                <div className="w-px flex-1 my-1" style={{ background: CF.border }} />
              )}
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: CF.body }}>
                {item.label}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {item.date && (
                  <span className="text-xs" style={{ color: CF.muted }}>{item.date}</span>
                )}
                {item.value && (
                  <span className="text-xs font-semibold" style={{ color: CF.blue }}>
                    {item.value}
                  </span>
                )}
                {item.risk && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide"
                    style={{
                      color: RISK_COLORS[item.risk.toLowerCase()] ?? CF.muted,
                      background: `${RISK_COLORS[item.risk.toLowerCase()] ?? CF.muted}18`,
                    }}
                  >
                    {item.risk}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
