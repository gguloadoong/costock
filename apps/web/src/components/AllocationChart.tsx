'use client';

interface AllocationItem {
  label: string;
  value: number;
  color: string;
}

interface AllocationChartProps {
  items: AllocationItem[];
  totalLabel?: string;
}

export function AllocationChart({ items, totalLabel }: AllocationChartProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;

  const SIZE = 100;
  const RADIUS = 35;
  const STROKE = 12;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  let offset = 0;
  const arcs = items.map(item => {
    const percent = item.value / total;
    const dashArray = percent * CIRCUMFERENCE;
    const dashOffset = -offset * CIRCUMFERENCE;
    offset += percent;
    return { ...item, percent, dashArray, dashOffset };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={arc.color}
            strokeWidth={STROKE}
            strokeDasharray={`${arc.dashArray} ${CIRCUMFERENCE}`}
            strokeDashoffset={arc.dashOffset}
          />
        ))}
      </svg>
      <div className="flex-1 space-y-1.5">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: arc.color }} />
              <span className="text-xs text-gray-600">{arc.label}</span>
            </div>
            <span className="text-xs font-medium text-gray-800">
              {(arc.percent * 100).toFixed(1)}%
            </span>
          </div>
        ))}
        {totalLabel && (
          <div className="pt-1 border-t border-gray-100 text-xs text-gray-400">
            총 {totalLabel}
          </div>
        )}
      </div>
    </div>
  );
}
