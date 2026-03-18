/**
 * Toast — 하단 고정 토스트 알림
 *
 * - BottomNavigation(56px) 위 8px 위치
 * - 3000ms 자동 소멸 + 300ms fade-out
 * - 동시 최대 1개 (새 것으로 교체)
 * - role="status", aria-live="polite"
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface ToastMessage {
  text: string;
  subtext?: string;
  type?: 'success' | 'warning' | 'error';
}

// ─── 전역 트리거 ──────────────────────────────────────────────────────────────

type ToastListener = (msg: ToastMessage) => void;
let _listener: ToastListener | null = null;

export function showToast(msg: ToastMessage): void {
  _listener?.(msg);
}

// ─── Toast 컴포넌트 ───────────────────────────────────────────────────────────

export function Toast(): React.ReactElement {
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
  }, []);

  const trigger = useCallback(
    (msg: ToastMessage) => {
      clearTimers();

      setCurrent(msg);
      setVisible(true);

      // 3000ms 후 fade-out 시작
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
        // 300ms fade-out 완료 후 DOM에서 제거
        fadeTimerRef.current = setTimeout(() => {
          setCurrent(null);
        }, 300);
      }, 3000);
    },
    [clearTimers]
  );

  // 전역 리스너 등록
  useEffect(() => {
    _listener = trigger;
    return () => {
      _listener = null;
      clearTimers();
    };
  }, [trigger, clearTimers]);

  if (!current) return <></>;

  const typeColor: Record<NonNullable<ToastMessage['type']>, string> = {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
  };

  const accentColor = current.type ? typeColor[current.type] : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        bottom: 'calc(56px + env(safe-area-inset-bottom) + 8px)',
        left: '16px',
        right: '16px',
        zIndex: 60,
        background: '#0F172A',
        color: 'white',
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease',
        pointerEvents: visible ? 'auto' : 'none',
        // 최대 너비 맞추기 (BottomNavigation과 동일)
        maxWidth: 'calc(430px - 32px)',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: accentColor ?? 'white',
          lineHeight: 1.4,
        }}
      >
        {current.text}
      </span>
      {current.subtext && (
        <span
          style={{
            fontSize: '12px',
            color: '#94A3B8',
            lineHeight: 1.4,
          }}
        >
          {current.subtext}
        </span>
      )}
    </div>
  );
}

export default Toast;
