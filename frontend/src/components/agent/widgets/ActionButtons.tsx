'use client';
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface ActionItem {
  label: string;
  action: string;
  payload: Record<string, any>;
  style?: 'primary' | 'danger' | 'secondary';
  description?: string;
}

interface ActionButtonsProps {
  title?: string;
  items: ActionItem[];
  runId: string;
  onAction: (action: string, payload: Record<string, any>) => Promise<void>;
}

export function ActionButtons({ title, items, runId, onAction }: ActionButtonsProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  if (!items?.length) return null;

  const handleClick = (item: ActionItem) => {
    setConfirming(item.action);
  };

  const handleConfirm = async (item: ActionItem) => {
    setConfirming(null);
    setLoading(item.action);
    try {
      await onAction(item.action, item.payload);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-semibold text-gray-700">{title}</p>}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isPrimary = item.style === 'primary' || !item.style;
          const isDanger = item.style === 'danger';
          const isLoading = loading === item.action;
          const isConfirming = confirming === item.action;

          return (
            <div key={item.action}>
              {isConfirming ? (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2">
                  <AlertCircle size={14} className="text-yellow-600 flex-shrink-0" />
                  <span className="text-xs text-yellow-800">
                    Confirm: <strong>{item.label}</strong>?
                  </span>
                  <button
                    onClick={() => handleConfirm(item)}
                    className="text-xs px-2 py-0.5 rounded bg-yellow-600 text-white hover:bg-yellow-700 font-medium"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleClick(item)}
                  disabled={isLoading || !!loading}
                  className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    isDanger
                      ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                      : isPrimary
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  {isLoading ? 'Running...' : item.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
