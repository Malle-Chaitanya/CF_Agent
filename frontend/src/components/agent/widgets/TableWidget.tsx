'use client';
import { useState } from 'react';
import { ChevronUp, ChevronDown, Download } from 'lucide-react';

interface ActionDef {
  label: string;
  action: string;
  payloadKey: string;
  style?: string;
}

interface TableWidgetProps {
  title?: string;
  columns: string[];
  rows: Record<string, any>[];
  actions?: ActionDef[];
  onAction?: (action: string, payload: Record<string, any>) => void;
}

export function TableWidget({ title, columns, rows, actions, onAction }: TableWidgetProps) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  if (!columns?.length || !rows?.length) return null;

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sorted = [...rows].sort((a, b) => {
    if (!sortCol) return 0;
    const va = a[sortCol] ?? '';
    const vb = b[sortCol] ?? '';
    const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleExportCSV = () => {
    const header = columns.join(',');
    const body = rows.map((row) =>
      columns.map((col) => {
        const val = row[col] ?? '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ).join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title ?? 'export').replace(/\s+/g, '_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        {title ? (
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        ) : (
          <span />
        )}
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50"
          title="Export as CSV"
        >
          <Download size={12} />
          <span>CSV</span>
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {columns.map((col) => (
              <th
                key={col}
                onClick={() => handleSort(col)}
                className="cursor-pointer px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide select-none whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-1">
                  {col.replace(/_/g, ' ')}
                  {sortCol === col ? (
                    sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  ) : null}
                </span>
              </th>
            ))}
            {actions?.length ? <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-gray-700 max-w-[200px] truncate">
                  {formatCell(row[col])}
                </td>
              ))}
              {actions?.length && onAction ? (
                <td className="px-3 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {actions.map((act) => (
                      <button
                        key={act.action}
                        onClick={() => onAction(act.action, { [act.payloadKey]: row[act.payloadKey] })}
                        className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                          act.style === 'danger'
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') return val.toLocaleString();
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}
