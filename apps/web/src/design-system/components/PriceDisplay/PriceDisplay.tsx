/**
 * PriceDisplay — renders a formatted KRW price in monospace font.
 *
 * Features:
 *   - Monospace font for tabular alignment
 *   - 300ms flash animation on price change (rise=red, fall=blue)
 *   - Handles invalid price gracefully (shows "---")
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { formatPriceSafe } from '../../utils/formatPrice';
import type { RateDirection } from '../../utils/formatRate';

export interface PriceDisplayProps {
  /** Current price value in KRW */
  price: number;
  /** Number of decimal places (default: 0 for stocks, set 8 for crypto) */
  decimals?: number;
  /** Direction drives flash color: rise=red, fall=blue, flat=none */
  direction?: RateDirection;
  /** Size variant */
  size?: 'xl' | 'lg' | 'md';
  /** Additional CSS classes */
  className?: string;
  /** Accessible label prefix, e.g. "삼성전자 현재가" */
  'aria-label'?: string;
}

const sizeStyles: Record<NonNullable<PriceDisplayProps['size']>, React.CSSProperties> = {
  xl: { fontSize: '24px', fontWeight: 700 },
  lg: { fontSize: '18px', fontWeight: 600 },
  md: { fontSize: '14px', fontWeight: 500 },
};

const flashColors: Record<RateDirection, string | null> = {
  rise: 'var(--kr-rise)',
  fall: 'var(--kr-fall)',
  flat: null,
};

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}

export function PriceDisplay({
  price,
  decimals = 0,
  direction = 'flat',
  size = 'xl',
  className = '',
  'aria-label': ariaLabel,
}: PriceDisplayProps): React.ReactElement {
  const formatted = formatPriceSafe(price, { decimals });
  const displayText = formatted !== null ? `₩ ${formatted}` : '---';

  const prevPrice = usePrevious(price);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    if (prevPrice === undefined || prevPrice === price) return;
    const cls = price > prevPrice ? 'price-flash-rise' : 'price-flash-fall';
    setFlashClass(cls);
    const timer = setTimeout(() => setFlashClass(''), 300);
    return () => clearTimeout(timer);
  }, [price, prevPrice]);

  const flashColor = flashClass ? flashColors[direction] : null;

  return (
    <span
      style={{
        fontFamily: 'Menlo, Consolas, monospace',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.025em',
        color: flashColor ?? '#0F172A',
        transition: 'color 0.3s ease',
        borderRadius: '4px',
        ...sizeStyles[size],
      }}
      className={[flashClass, className].filter(Boolean).join(' ')}
      aria-label={ariaLabel ?? `현재가 ${displayText}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {displayText}
    </span>
  );
}

export default PriceDisplay;
