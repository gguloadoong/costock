'use client';

import { useMemo } from 'react';

interface TickerItem {
  symbol: string;
  name: string;
  price: number;
  changeRate: number;
  isPct?: boolean; // true이면 price를 숫자%로 표시
}

interface PriceTickerProps {
  items: TickerItem[];
}

// BTC 도미넌스처럼 이름이 긴 항목을 줄여서 표시
const NAME_SHORT: Record<string, string> = {
  'BTC 도미넌스': 'BTC%',
  'BTC도미넌스': 'BTC%',
};

// 포맷 함수 (컴포넌트 외부 — 렌더마다 재생성 방지)
function fmtPrice(p: number, isPct?: boolean): string {
  if (isPct) return `${p.toFixed(2)}%`;
  if (p >= 1_000_000) {
    return (p / 1_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  }
  if (p >= 1_000) {
    return p.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  }
  return p.toFixed(2);
}

function fmtRate(r: number): string {
  return `${r >= 0 ? '+' : ''}${r.toFixed(2)}%`;
}

// 한국 금융 색상 규칙 (상승=빨강, 하락=파랑, 보합=회색)
function getRateColor(changeRate: number): string {
  if (changeRate > 0) return '#E84040';
  if (changeRate < 0) return '#2563EB';
  return '#6B7280';
}

export function PriceTicker({ items }: PriceTickerProps) {
  // Hook은 조건문 이전에 호출 (React Hook 규칙 준수)
  // 중복된 아이템 배열 (marquee 효과용 — 아이템 2배 복제로 끊김 없는 루프 구현)
  const tickerItems = useMemo(() => [...items, ...items], [items]);

  // 아이템 수에 비례한 애니메이션 속도 (아이템 1개당 4초, 최소 8초)
  const animationDuration = `${Math.max(items.length * 4, 8)}s`;

  if (items.length === 0) return null;

  return (
    <div style={{ overflow: 'hidden', background: '#F9FAFB', borderBottom: '1px solid #F1F5F9', height: '32px', display: 'flex', alignItems: 'center' }}>
      <div
        className="animate-ticker"
        style={{ animationDuration, display: 'flex', whiteSpace: 'nowrap', flexShrink: 0, alignItems: 'center' }}
      >
        {tickerItems.map((item, i) => (
          <span
            key={i}
            className="flex items-center text-xs flex-shrink-0"
            style={{ color: '#6B7280' }}
          >
            {/* 구분자: 첫 번째 항목 앞에도 표시 (루프 연결용) */}
            <span style={{ color: '#D1D5DB', margin: '0 10px' }}>│</span>
            <span className="font-medium text-gray-700">
              {NAME_SHORT[item.name] ?? item.name}
            </span>
            <span className="text-gray-900 font-medium" style={{ marginLeft: '4px' }}>
              {fmtPrice(item.price, item.isPct)}
            </span>
            <span
              style={{
                color: getRateColor(item.changeRate),
                marginLeft: '3px',
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
