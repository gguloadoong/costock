/**
 * PriceCard — instrument summary card with embedded asset type badge.
 *
 * Layout:
 *   ┌─────────────────────────────┐
 *   │ 삼성전자           005930   │
 *   │ ₩ 85,400          KOSPI    │
 *   │ +1,200 (+1.43%)  ▲         │  ← red (rise)
 *   │ 거래량: 12,345,678          │
 *   └─────────────────────────────┘
 *
 * Accessibility: touch target ≥ 44×44px (WCAG 2.1 AA)
 */

'use client';

import React from 'react';
import { Box } from '@coinbase/cds-web/layout';
import { Text } from '@coinbase/cds-web/typography';
import { ChangeBadge } from '../ChangeBadge/ChangeBadge';
import { PriceDisplay } from '../PriceDisplay/PriceDisplay';
import { Sparkline } from '../Sparkline/Sparkline';
import { formatPrice } from '../../utils/formatPrice';
import { getAssetBadgeStyle, getAssetBadgeLabel } from '../../utils/assetBadge';
import type { AssetType } from '../../utils/assetBadge';

export type { AssetType };

export interface PriceCardProps {
  /** Instrument symbol, e.g. "005930" or "BTC-KRW" */
  symbol: string;
  /** Display name, e.g. "삼성전자" or "비트코인" */
  name: string;
  /** Current price in KRW */
  price: number;
  /** Change amount (absolute, signed) */
  change: number;
  /** Change rate as percentage number, e.g. 1.43 for +1.43% */
  changeRate: number;
  /** Trading volume */
  volume: number;
  /** Exchange name, e.g. "KOSPI", "KOSDAQ", "UPBIT" */
  exchange: string;
  /** Asset type determines badge style */
  type: AssetType;
  /** Decimal places for price display (default: 0 stock, 0 coin KRW) */
  decimals?: number;
  /** Click handler (card tap → detail page) */
  onClick?: () => void;
  /** Watchlist toggle handler (star button) */
  onWatchlistToggle?: () => void;
  /** Whether this instrument is in the watchlist */
  isWatchlisted?: boolean;
  /** Sparkline data points for mini chart (7 points recommended) */
  sparklineData?: number[];
  /** Additional CSS classes */
  className?: string;
}

function getDirection(changeRate: number) {
  if (changeRate > 0) return 'rise' as const;
  if (changeRate < 0) return 'fall' as const;
  return 'flat' as const;
}

export function PriceCard({
  symbol,
  name,
  price,
  change,
  changeRate,
  volume,
  exchange,
  type,
  decimals = 0,
  onClick,
  onWatchlistToggle,
  isWatchlisted = false,
  sparklineData,
  className = '',
}: PriceCardProps): React.ReactElement {
  const direction = getDirection(changeRate);
  const badgeStyle = getAssetBadgeStyle(type);
  const badgeLabel = getAssetBadgeLabel(type);

  const changeSign = change > 0 ? '+' : '';
  const changeFormatted = (() => {
    try {
      return `${changeSign}${change < 0 ? '-' : ''}${formatPrice(Math.abs(change))}`;
    } catch {
      return '---';
    }
  })();

  const volumeFormatted = (() => {
    try {
      return formatPrice(volume);
    } catch {
      return '---';
    }
  })();

  const changeColor =
    direction === 'rise'
      ? 'var(--kr-rise)'
      : direction === 'fall'
      ? 'var(--kr-fall)'
      : 'var(--kr-flat)';

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '16px',
        paddingRight: onWatchlistToggle ? '52px' : '16px',
        borderRadius: '12px',
        background: 'white',
        border: '1px solid #E2E8F0',
        minHeight: '44px',
        minWidth: '44px',
        width: '100%',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : undefined,
        transition: onClick ? 'transform 0.1s' : undefined,
      }}
      className={className}
      onClick={onClick}
      aria-label={
        onClick
          ? `${name} (${symbol}) 현재가 ₩${price.toLocaleString('ko-KR')} 상세 보기`
          : undefined
      }
    >
      {/* Watchlist 별표 버튼 */}
      {onWatchlistToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onWatchlistToggle();
          }}
          aria-label={isWatchlisted ? `${name} 관심종목 제거` : `${name} 관심종목 추가`}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontSize: '20px',
            color: isWatchlisted ? '#F59E0B' : '#CBD5E1',
            zIndex: 1,
          }}
        >
          {isWatchlisted ? '\u2605' : '\u2606'}
        </button>
      )}
      {/* Header row: name + type badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#0F172A',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
        <span
          style={{
            flexShrink: 0,
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            ...badgeStyle,
          }}
          aria-label={`자산 유형: ${badgeLabel}`}
        >
          [{badgeLabel}]
        </span>
      </div>

      {/* Symbol + Exchange row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748B' }}>
        <span style={{ fontFamily: 'Menlo, Consolas, monospace' }}>{symbol}</span>
        <span>{exchange}</span>
      </div>

      {/* Price row with optional sparkline */}
      <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <PriceDisplay
          price={price}
          decimals={decimals}
          direction={direction}
          size="xl"
          aria-label={`${name} 현재가`}
        />
        {sparklineData && sparklineData.length >= 2 && (
          <Sparkline
            data={sparklineData}
            width={64}
            height={24}
            ariaLabel={`${name} 가격 추이`}
          />
        )}
      </div>

      {/* Change row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            fontSize: '14px',
            fontFamily: 'Menlo, Consolas, monospace',
            fontVariantNumeric: 'tabular-nums',
            color: changeColor,
          }}
          aria-label={`변동액 ${changeFormatted}`}
        >
          {changeFormatted}
        </span>
        <ChangeBadge value={changeRate} />
      </div>

      {/* Volume row */}
      <div style={{ fontSize: '12px', color: '#6B7280' }}>
        <span>거래량: </span>
        <span style={{ fontFamily: 'Menlo, Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>
          {volumeFormatted}
        </span>
      </div>
    </Tag>
  );
}

export default PriceCard;
