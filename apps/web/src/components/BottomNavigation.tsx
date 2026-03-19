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
    label: 'AI 트레이더',
    href: '/',
    icon: (active) => (
      // 로봇/AI 아이콘: 사각형 헤드 + 안테나 + 눈 두 개
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect
          x="4"
          y="8"
          width="16"
          height="12"
          rx="3"
          stroke={active ? '#0F172A' : '#94A3B8'}
          strokeWidth="1.75"
          fill={active ? '#0F172A' : 'none'}
          fillOpacity={active ? 0.07 : 0}
        />
        <line
          x1="12"
          y1="4"
          x2="12"
          y2="8"
          stroke={active ? '#0F172A' : '#94A3B8'}
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <circle cx="12" cy="3.5" r="1" fill={active ? '#0F172A' : '#94A3B8'} />
        <circle cx="9" cy="14" r="1.25" fill={active ? '#0F172A' : '#94A3B8'} />
        <circle cx="15" cy="14" r="1.25" fill={active ? '#0F172A' : '#94A3B8'} />
        <line
          x1="8"
          y1="17.5"
          x2="16"
          y2="17.5"
          stroke={active ? '#0F172A' : '#94A3B8'}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'explore',
    label: '종목 검색',
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
    id: 'my',
    label: '설정',
    href: '/my',
    icon: (active) => (
      // 톱니바퀴 아이콘
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="3"
          stroke={active ? '#0F172A' : '#94A3B8'}
          strokeWidth="1.75"
        />
        <path
          d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
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
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        background: 'white',
        borderTop: '1px solid #E2E8F0',
        paddingBottom: 'env(safe-area-inset-bottom)',
        width: '100%',
        maxWidth: '430px',
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
