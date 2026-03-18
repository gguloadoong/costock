'use client';

import React from 'react';
import { PriceCard, PriceCardSkeleton } from '@/design-system';
import type { HomeTab, InstrumentWithPrice } from '@/types/market';
import { SwipeableItem } from '@/components/SwipeableItem';
import { usePriceFlash } from '@/lib/usePriceFlash';

/**
 * Mock 스파크라인 데이터 생성
 * 랜덤 워크(random walk) 패턴으로 7개 포인트를 생성하고,
 * 마지막 포인트를 changeRate 방향으로 맞춤.
 */
function generateMockSparkline(changeRate: number, seed: number): number[] {
  const base = 100;
  const points = [base];

  for (let i = 1; i < 7; i++) {
    const prev = points[i - 1];
    // seed를 이용한 결정적 랜덤값 생성
    const randomWalk = (((seed * i * 1234567) % 100) / 100 - 0.5) * 2;
    points.push(prev + randomWalk);
  }

  // 마지막 포인트를 changeRate 방향으로 맞춤
  points[6] = base + (changeRate > 0 ? Math.abs(changeRate) : -Math.abs(changeRate)) * 0.5;

  return points;
}

export interface InstrumentListProps {
  instruments: InstrumentWithPrice[];
  liveData: Map<string, { price: number; change: number; changeRate: number }>;
  isLoading: boolean;
  tabId: HomeTab;
  onSelect: (symbol: string) => void;
  watchlistIds?: Set<string>;
  onWatchlistToggle?: (item: InstrumentWithPrice) => void;
  showSwipeDelete?: boolean;
}

const SKELETON_COUNT = 5;

interface InstrumentItemProps {
  item: InstrumentWithPrice;
  liveData: Map<string, { price: number; change: number; changeRate: number }>;
  onSelect: (symbol: string) => void;
  watchlistIds?: Set<string>;
  onWatchlistToggle?: (item: InstrumentWithPrice) => void;
  showSwipeDelete?: boolean;
}

function InstrumentItem({
  item,
  liveData,
  onSelect,
  watchlistIds,
  onWatchlistToggle,
  showSwipeDelete,
}: InstrumentItemProps): React.ReactElement {
  const live = liveData.get(item.symbol);
  const price = live?.price ?? item.price;
  const change = live?.change ?? item.change;
  const changeRate = live?.changeRate ?? item.changeRate;

  const flash = usePriceFlash(price);
  const decimals = item.type === 'coin' && price < 100 ? 2 : 0;

  const flashClass = flash === 'rise' ? 'price-flash-rise' : flash === 'fall' ? 'price-flash-fall' : '';

  // 심볼을 seed로 사용하여 결정적 mock 스파크라인 생성
  const sparklineSeed = item.symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const sparklineData = generateMockSparkline(changeRate, sparklineSeed);

  const card = (
    <div className={[flashClass, 'price-value'].filter(Boolean).join(' ')}>
      <PriceCard
        symbol={item.symbol}
        name={item.name}
        price={price}
        change={change}
        changeRate={changeRate}
        volume={item.volume}
        exchange={item.exchange}
        type={item.type}
        decimals={decimals}
        onClick={() => onSelect(item.symbol)}
        isWatchlisted={watchlistIds?.has(item.symbol)}
        onWatchlistToggle={onWatchlistToggle ? () => onWatchlistToggle(item) : undefined}
        sparklineData={sparklineData}
      />
    </div>
  );

  if (showSwipeDelete && onWatchlistToggle) {
    return (
      <SwipeableItem onDelete={() => onWatchlistToggle(item)}>
        {card}
      </SwipeableItem>
    );
  }

  return card;
}

export function InstrumentList({
  instruments,
  liveData,
  isLoading,
  tabId,
  onSelect,
  watchlistIds,
  onWatchlistToggle,
  showSwipeDelete,
}: InstrumentListProps): React.ReactElement {
  if (isLoading) {
    return (
      <div
        id={`tabpanel-${tabId}`}
        role="tabpanel"
        style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}
        aria-busy="true"
        aria-label="데이터 로딩 중"
      >
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <PriceCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (instruments.length === 0) {
    return (
      <div
        id={`tabpanel-${tabId}`}
        role="tabpanel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 0',
          color: '#94A3B8',
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          style={{ marginBottom: '12px', opacity: 0.4 }}
          aria-hidden="true"
        >
          <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
          <path d="M24 16v10M24 30v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p style={{ fontSize: '14px' }}>종목이 없습니다</p>
      </div>
    );
  }

  return (
    <div
      id={`tabpanel-${tabId}`}
      role="tabpanel"
      style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}
    >
      {instruments.map((item) => (
        <InstrumentItem
          key={item.symbol}
          item={item}
          liveData={liveData}
          onSelect={onSelect}
          watchlistIds={watchlistIds}
          onWatchlistToggle={onWatchlistToggle}
          showSwipeDelete={showSwipeDelete}
        />
      ))}
    </div>
  );
}
