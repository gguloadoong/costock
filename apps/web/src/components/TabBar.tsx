'use client';

import React from 'react';
import type { HomeTab } from '@/types/market';
import { HOME_TAB_LABELS } from '@/types/market';

const TAB_ORDER: HomeTab[] = ['watchlist', 'stock', 'coin'];

export interface TabBarProps {
  activeTab: HomeTab;
  onChange: (tab: HomeTab) => void;
}

export function TabBar({ activeTab, onChange }: TabBarProps): React.ReactElement {
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
            }}
            onClick={() => onChange(tab)}
          >
            {HOME_TAB_LABELS[tab]}
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
