'use client';

import { useMemo } from 'react';
import type { MarketIndex } from '@/types/market';

interface TickerItem {
  symbol: string;
  name: string;
  price: number;
  changeRate: number;
}

interface PriceTickerProps {
  items: TickerItem[];
}

export function PriceTicker({ items }: PriceTickerProps) {
  if (items.length === 0) return null;

  // 포맷 함수들
  const fmtPrice = (p: number): string => {
    if (p >= 1_000_000) {
      return (p / 1_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    }
    if (p >= 1_000) {
      return p.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
    }
    return p.toFixed(2);
  };

  const fmtRate = (r: number): string => `${r >= 0 ? '+' : ''}${r.toFixed(2)}%`;

  // 한국 금융 색상 규칙 적용
  const getRateColor = (changeRate: number): string => {
    if (changeRate > 0) return '#E84040'; // 상승: 빨강
    if (changeRate < 0) return '#2563EB'; // 하락: 파랑
    return '#6B7280'; // 보합: 회색
  };

  // 중복된 아이템 배열 (marquee 효과용)
  const tickerItems = useMemo(() => [...items, ...items], [items]);

  const animationDuration = `${items.length * 4}s`;

  return (
    <div className="overflow-hidden bg-gray-50 border-b border-gray-100 py-1.5">
      <div
        className="flex gap-6 whitespace-nowrap"
        style={{
          animation: `ticker ${animationDuration} linear infinite`,
        }}
      >
        {tickerItems.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-1.5 text-xs flex-shrink-0"
            style={{
              color: '#6B7280',
            }}
          >
            <span className="font-medium text-gray-700">{item.name}</span>
            <span className="text-gray-900 font-medium">{fmtPrice(item.price)}</span>
            <span
              style={{
                color: getRateColor(item.changeRate),
              }}
              className="font-semibold"
            >
              {fmtRate(item.changeRate)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
