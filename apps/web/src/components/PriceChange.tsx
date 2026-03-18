'use client';

import { formatChangeRate, getPriceColor } from '@/lib/formatters';

interface PriceChangeProps {
  rate: number;
  diff?: number;
  size?: 'xs' | 'sm' | 'base';
  showArrow?: boolean;
}

const sizeClass = { xs: 'text-xs', sm: 'text-sm', base: 'text-base' };

export function PriceChange({ rate, diff, size = 'sm', showArrow = true }: PriceChangeProps) {
  const color = getPriceColor(rate);
  const arrow = showArrow ? (rate > 0 ? '▲' : rate < 0 ? '▼' : '–') : '';

  return (
    <span className={`font-medium ${sizeClass[size]}`} style={{ color }}>
      {arrow} {formatChangeRate(rate)}
      {diff !== undefined && (
        <span className="ml-1 opacity-70">
          ({diff >= 0 ? '+' : ''}{diff.toLocaleString()})
        </span>
      )}
    </span>
  );
}
