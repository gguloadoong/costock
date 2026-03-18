/**
 * BottomNavigation — 하단 탭 네비게이션
 *
 * 탭: 홈 / 탐색 / 시장 / MY
 * 모바일 375px 기준, safe-area-inset-bottom 대응.
 * WCAG 2.1 AA: 터치 타겟 44×44px 이상.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ─── 탭 정의 ──────────────────────────────────────────────────────────────────

interface NavTab {
  id: string;
  label: string;
  href: string;
  icon: (active: boolean) => React.ReactElement;
}

const NAV_TABS: NavTab[] = [
  {
    id: 'home',
    label: '홈',
    href: '/',
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"
          stroke={active ? '#0F172A' : '#94A3B8'}
          strokeWidth="1.75"
          strokeLinejoin="round"
          fill={active ? '#0F172A' : 'none'}
          fillOpacity={active ? 0.08 : 0}
        />
      </svg>
    ),
  },
  {
    id: 'explore',
    label: '탐색',
    href: '/explore',
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle
          cx="11"
          cy="11"
          r="7.5"
          stroke={active ? '#0F172A' : '#94A3B8'}
          strokeWidth="1.75"
        />
        <path
          d="M16.5 16.5L21 21"
          stroke={active ? '#0F172A' : '#94A3B8'}
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'market',
    label: '시장',
    href: '/market',
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <polyline
          points="3,17 8,12 12,14 17,7 21,9"
          stroke={active ? '#0F172A' : '#94A3B8'}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <line
          x1="3"
          y1="21"
          x2="21"
          y2="21"
          stroke={active ? '#0F172A' : '#94A3B8'}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'my',
    label: 'MY',
    href: '/my',
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle
          cx="12"
          cy="8"
          r="3.5"
          stroke={active ? '#0F172A' : '#94A3B8'}
          strokeWidth="1.75"
        />
        <path
          d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20"
          stroke={active ? '#0F172A' : '#94A3B8'}
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

// ─── BottomNavigation ─────────────────────────────────────────────────────────

export function BottomNavigation(): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: 'white',
        borderTop: '1px solid #E2E8F0',
        paddingBottom: 'env(safe-area-inset-bottom)',
        maxWidth: '430px',
        margin: '0 auto',
      }}
      aria-label="하단 탭 메뉴"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          height: '56px',
        }}
      >
        {NAV_TABS.map((tab) => {
          const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.id}
              href={tab.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                minWidth: '44px',
                minHeight: '44px',
                padding: '0 12px',
                textDecoration: 'none',
              }}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.icon(isActive)}
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  color: isActive ? '#0F172A' : '#94A3B8',
                }}
                aria-hidden="true"
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNavigation;
