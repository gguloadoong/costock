'use client';

import React, { useState, useRef, useEffect } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const THRESHOLD = 60;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps): React.ReactElement {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: TouchEvent) => {
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (refreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setPulling(true);
      setPullDistance(Math.min(delta * 0.5, THRESHOLD + 20));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      await onRefresh();
      setRefreshing(false);
    }
    setPulling(false);
    setPullDistance(0);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshing, pullDistance]);

  return (
    <div
      ref={containerRef}
      style={{ overflowY: 'auto', height: '100%', position: 'relative' }}
    >
      {/* 인디케이터 */}
      {(pulling || refreshing) && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            padding: '8px',
            transform: `translateY(${pullDistance - 40}px)`,
            transition: refreshing ? 'none' : 'transform 0.1s',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '3px solid #E2E8F0',
              borderTopColor: '#0F172A',
              animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
              transform: refreshing ? undefined : `rotate(${pullDistance * 3}deg)`,
            }}
          />
        </div>
      )}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: refreshing ? 'transform 0.3s' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
