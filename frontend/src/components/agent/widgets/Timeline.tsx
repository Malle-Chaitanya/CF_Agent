'use client';

interface TimelineItem {
  date: string;
  label: string;
  value?: string;
  risk?: string;
}

const RISK_COLORS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

export function Timeline({ title, items }: { title?: string; items: TimelineItem[] }) {
  if (!items?.length) return null;

  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-semibold text-gray-700">{title}</p>}
      <div className="space-y-2">
        {items.map((item, i) => {
          const dotColor = RISK_COLORS[item.risk?.toLowerCase() ?? ''] ?? 'bg-blue-500';
          return (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className={`w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} />
                {i < items.length - 1 && <div className="w-px h-6 bg-gray-200 mt-1" />}
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800 truncate">{item.label}</span>
                  {item.value && (
                    <span className="text-sm text-gray-600 whitespace-nowrap">{item.value}</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {item.risk && (
                  <span className={`ml-2 text-xs font-medium ${
                    item.risk.toLowerCase() === 'high' ? 'text-red-600' :
                    item.risk.toLowerCase() === 'medium' ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {item.risk} risk
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
