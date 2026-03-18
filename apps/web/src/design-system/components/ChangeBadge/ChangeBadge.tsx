/**
 * ChangeBadge — displays a change rate badge with directional icon.
 *
 * Features:
 *   - Korean color convention: rise=red, fall=blue
 *   - ▲▼ direction icons for accessibility (color is not the only indicator)
 *   - aria-label describes direction in Korean for screen readers
 *   - WCAG 2.1 AA compliant
 */

'use client';

import React from 'react';
import { Tag } from '@coinbase/cds-web/tag';
import { formatRate } from '../../utils/formatRate';
import type { RateDirection } from '../../utils/formatRate';

export interface ChangeBadgeProps {
  /** Change rate as a percentage number (e.g. 1.43 for +1.43%) */
  value: number;
  /** Additional CSS classes */
  className?: string;
}

const directionConfig: Record<
  RateDirection,
  { icon: string; color: string; ariaLabel: string }
> = {
  rise: {
    icon: '▲',
    color: 'var(--kr-rise)',
    ariaLabel: '상승',
  },
  fall: {
    icon: '▼',
    color: 'var(--kr-fall)',
    ariaLabel: '하락',
  },
  flat: {
    icon: '━',
    color: 'var(--kr-flat)',
    ariaLabel: '보합',
  },
};

export function ChangeBadge({
  value,
  className = '',
}: ChangeBadgeProps): React.ReactElement {
  const { display, direction } = formatRate(value);
  const config = directionConfig[direction];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'Menlo, Consolas, monospace',
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        color: config.color,
        background:
          direction === 'rise'
            ? 'rgba(232, 64, 64, 0.1)'
            : direction === 'fall'
            ? 'rgba(37, 99, 235, 0.1)'
            : 'rgba(107, 114, 128, 0.1)',
      }}
      className={className}
      aria-label={`변동률 ${config.ariaLabel} ${display}`}
      role="status"
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{display}</span>
    </span>
  );
}

export default ChangeBadge;
