'use client';

interface Card {
  label: string;
  value: string | number;
  delta?: string;
  color?: string;
}

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  default: 'bg-gray-50 border-gray-200 text-gray-700',
};

export function MetricCards({ cards }: { cards: Card[] }) {
  if (!cards?.length) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((card, i) => {
        const colorClass = COLOR_MAP[card.color ?? 'default'] ?? COLOR_MAP.default;
        return (
          <div key={i} className={`rounded-lg border p-3 ${colorClass}`}>
            <p className="text-xs font-medium opacity-75 truncate">{card.label}</p>
            <p className="mt-1 text-2xl font-bold">
              {typeof card.value === 'number'
                ? card.value.toLocaleString()
                : card.value}
            </p>
            {card.delta && (
              <p className="mt-0.5 text-xs opacity-70">{card.delta}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
