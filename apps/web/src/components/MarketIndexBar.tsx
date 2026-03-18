/**
 * MarketIndexBar — 시장 지수 가로 스크롤 바
 *
 * 코스피 / 코스닥 / BTC / ETH 등 주요 지수를 한 줄에 표시.
 * 장 마감 시 [마감] 배지 표시.
 * 모바일 375px 기준 — 가로 스크롤 지원.
 */

'use client';

import React from 'react';
import { Box } from '@coinbase/cds-web/layout';
import { ChangeBadge, LiveIndicator } from '@/design-system';
import { formatPriceSafe } from '@/design-system';
import type { LiveStatus } from '@/design-system';
import type { MarketIndex } from '@/types/market';

// ─── 스켈레톤 ─────────────────────────────────────────────────────────────────

function MarketIndexItemSkeleton(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '8px 16px',
        flexShrink: 0,
        minWidth: '100px',
      }}
    >
      <div style={{ height: '12px', width: '64px', borderRadius: '4px', background: '#E2E8F0', animation: 'pulse 2s infinite' }} />
      <div style={{ height: '16px', width: '80px', borderRadius: '4px', background: '#E2E8F0', animation: 'pulse 2s infinite' }} />
      <div style={{ height: '16px', width: '56px', borderRadius: '4px', background: '#E2E8F0', animation: 'pulse 2s infinite' }} />
    </div>
  );
}

// ─── 단일 지수 아이템 ─────────────────────────────────────────────────────────

interface MarketIndexItemProps {
  index: MarketIndex;
}

function MarketIndexItem({ index }: MarketIndexItemProps): React.ReactElement {
  const { name, value, changeRate, status, type } = index;

  const decimals = type === 'coin' ? 0 : 2;
  const displayValue = formatPriceSafe(value, { decimals });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '8px 16px',
        flexShrink: 0,
        minWidth: '108px',
        borderRight: '1px solid #E2E8F0',
      }}
      role="group"
      aria-label={`${name} 지수`}
    >
      {/* 지수명 + 마감 배지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#64748B',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
        {status === 'closed' && (
          <span
            style={{
              flexShrink: 0,
              padding: '1px 4px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 500,
              background: '#F3F4F6',
              color: '#6B7280',
            }}
            aria-label="장 마감"
          >
            마감
          </span>
        )}
      </div>

      {/* 현재값 */}
      <span
        style={{
          fontSize: '14px',
          fontFamily: 'Menlo, Consolas, monospace',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: '#0F172A',
        }}
      >
        {displayValue ?? '---'}
      </span>

      {/* 변동률 */}
      <ChangeBadge value={changeRate} />
    </div>
  );
}

// ─── MarketIndexBar ───────────────────────────────────────────────────────────

export interface MarketIndexBarProps {
  indices: MarketIndex[];
  isLoading?: boolean;
  liveStatus: LiveStatus;
}

const SKELETON_COUNT = 4;

export function MarketIndexBar({
  indices,
  isLoading = false,
  liveStatus,
}: MarketIndexBarProps): React.ReactElement {
  return (
    <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0' }}>
      {/* 상태 행 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px 4px',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}>시장 지수</span>
        <LiveIndicator status={liveStatus} />
      </div>

      {/* 가로 스크롤 지수 목록 */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          paddingBottom: '8px',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        } as React.CSSProperties}
        role="list"
        aria-label="시장 지수 목록"
        aria-busy={isLoading}
      >
        {isLoading
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <MarketIndexItemSkeleton key={i} />
            ))
          : indices.map((idx) => (
              <div key={idx.id} role="listitem">
                <MarketIndexItem index={idx} />
              </div>
            ))}
      </div>
    </div>
  );
}

export default MarketIndexBar;
