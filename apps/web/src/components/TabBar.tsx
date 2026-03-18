'use client';

import React from 'react';
import type { HomeTab } from '@/types/market';
import { HOME_TAB_LABELS } from '@/types/market';

const TAB_ORDER: HomeTab[] = ['watchlist', 'stock', 'coin'];

export interface TabBarProps {
  activeTab: HomeTab;
  onChange: (tab: HomeTab) => void;
  watchlistCount?: number;
  exploreStats?: { gainers: number; losers: number };
}

export function TabBar({ activeTab, onChange, watchlistCount, exploreStats }: TabBarProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid #E2E8F0',
        background: 'white',
        padding: '0 16px',
      }}
      role="tablist"
      aria-label="종목 카테고리"
    >
      {TAB_ORDER.map((tab) => {
        const isActive = activeTab === tab;
        const label = tab === 'watchlist' && watchlistCount !== undefined && watchlistCount > 0
          ? `${HOME_TAB_LABELS[tab]} ${watchlistCount}`
          : HOME_TAB_LABELS[tab];
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab}`}
            style={{
              position: 'relative',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: 500,
              minHeight: '44px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? '#0F172A' : '#94A3B8',
              transform: isActive ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.15s ease',
            }}
            onClick={() => onChange(tab)}
          >
            {label}
            {/* 탐색 탭 실시간 상승/하락 표시 */}
            {tab === 'stock' && !isActive && exploreStats && (
              <span
                style={{
                  display: 'block',
                  fontSize: '10px',
                  lineHeight: 1,
                  marginTop: '2px',
                  letterSpacing: '-0.02em',
                }}
              >
                <span style={{ color: 'var(--kr-rise, #E84040)' }}>▲{exploreStats.gainers}</span>
                {' '}
                <span style={{ color: 'var(--kr-fall, #2563EB)' }}>▼{exploreStats.losers}</span>
              </span>
            )}
            {/* 활성 탭 인디케이터 */}
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: '#0F172A',
                  borderRadius: '2px 2px 0 0',
                }}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
