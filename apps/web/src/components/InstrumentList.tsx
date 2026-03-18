'use client';

import React from 'react';
import { PriceCard, PriceCardSkeleton } from '@/design-system';
import type { HomeTab, InstrumentWithPrice } from '@/types/market';
import { SwipeableItem } from '@/components/SwipeableItem';
import { usePriceFlash } from '@/lib/usePriceFlash';

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
