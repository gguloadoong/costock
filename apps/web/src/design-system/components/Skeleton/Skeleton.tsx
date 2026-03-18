/**
 * Skeleton — loading placeholder with pulse animation.
 *
 * Use in place of content while data is fetching.
 * Matches the shape of the target content via width/height/className.
 */

'use client';

import React from 'react';
import { Box } from '@coinbase/cds-web/layout';

export interface SkeletonProps {
  /** Width (CSS value or number as px) */
  width?: string | number;
  /** Height (CSS value or number as px) */
  height?: string | number;
  /** Border radius variant */
  variant?: 'text' | 'rect' | 'circle';
  /** Additional CSS classes */
  className?: string;
}

const variantRadius: Record<NonNullable<SkeletonProps['variant']>, string> = {
  text: '4px',
  rect: '12px',
  circle: '50%',
};

export function Skeleton({
  width,
  height,
  variant = 'rect',
  className = '',
}: SkeletonProps): React.ReactElement {
  const style: React.CSSProperties = {
    display: 'block',
    background: '#E2E8F0',
    borderRadius: variantRadius[variant],
    animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
  };

  if (width !== undefined) {
    style.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }

  return (
    <span
      style={style}
      className={className}
      aria-hidden="true"
      role="presentation"
    />
  );
}

/** Pre-composed skeleton for a PriceCard while loading */
export function PriceCardSkeleton({
  className = '',
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '16px',
        borderRadius: '12px',
        background: 'white',
        border: '1px solid #E2E8F0',
      }}
      className={className}
      aria-label="가격 카드 로딩 중"
      aria-busy="true"
    >
      {/* Name row */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton variant="text" width={100} height={14} />
        <Skeleton variant="text" width={36} height={14} />
      </div>
      {/* Symbol row */}
      <Skeleton variant="text" width={60} height={12} />
      {/* Price row */}
      <Skeleton variant="text" width={140} height={28} />
      {/* Change row */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Skeleton variant="text" width={80} height={16} />
        <Skeleton variant="text" width={64} height={20} />
      </div>
      {/* Volume row */}
      <Skeleton variant="text" width={120} height={12} />
    </div>
  );
}

export default Skeleton;
