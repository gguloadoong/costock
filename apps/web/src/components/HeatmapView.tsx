'use client';

interface HeatmapItem {
  symbol: string;
  name: string;
  changeRate: number;
  price: number;
  type: 'stock' | 'coin';
}

interface HeatmapViewProps {
  items: HeatmapItem[];
  onSelect: (symbol: string, type: 'stock' | 'coin') => void;
}

// 변동률 → 배경색 (한국: 상승=빨강, 하락=파랑)
function getTileColor(rate: number): string {
  if (rate >= 3) return 'bg-[#B91C1C]';      // 강한 상승
  if (rate >= 1.5) return 'bg-[#DC2626]';    // 상승
  if (rate >= 0.5) return 'bg-[#EF4444]';    // 약한 상승
  if (rate > -0.5) return 'bg-gray-400';      // 보합
  if (rate > -1.5) return 'bg-[#3B82F6]';    // 약한 하락
  if (rate > -3) return 'bg-[#2563EB]';      // 하락
  return 'bg-[#1D4ED8]';                      // 강한 하락
}

export function HeatmapView({ items, onSelect }: HeatmapViewProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-400">
        데이터 없음
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-3 gap-1.5">
        {items.map(item => (
          <button
            key={item.symbol}
            onClick={() => onSelect(item.symbol, item.type)}
            className={`${getTileColor(item.changeRate)} rounded-xl p-2.5 text-left active:opacity-80 transition-opacity`}
          >
            <div className="text-white text-xs font-bold truncate mb-0.5">
              {item.name.length > 6 ? item.name.slice(0, 6) : item.name}
            </div>
            <div className="text-white/90 text-xs font-medium">
              {item.changeRate >= 0 ? '+' : ''}{item.changeRate.toFixed(2)}%
            </div>
          </button>
        ))}
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-3 mt-3 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#EF4444]" />
          <span>상승</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-gray-400" />
          <span>보합</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[#3B82F6]" />
          <span>하락</span>
        </div>
      </div>
    </div>
  );
}
