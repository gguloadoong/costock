/**
 * 홈화면 — CoStock 통합 투자정보 메인 페이지
 *
 * 섹션:
 *   1. 상단 헤더 (SearchBar + LiveIndicator)
 *   2. MarketIndexBar (코스피/코스닥/BTC/ETH)
 *   3. 탭 [관심 | 주식 | 코인]
 *   4. 인기 종목 (탭별 TOP5)
 *   5. BottomNavigation
 *
 * 데이터 전략:
 *   - 초기 데이터: fetch (서버 컴포넌트 호환 목 데이터)
 *   - 실시간 업데이트: usePriceStream (WebSocket)
 *   - 스켈레톤: 데이터 로드 전 표시
 */

'use client';

import React, { useState, useEffect, useTransition, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/BottomNavigation';
import { MarketIndexBar } from '@/components/MarketIndexBar';
import { SearchBar } from '@/components/SearchBar';
import { Toast, showToast } from '@/components/Toast';
import { TabBar } from '@/components/TabBar';
import { InstrumentList } from '@/components/InstrumentList';
import { PullToRefresh } from '@/components/PullToRefresh';
import { usePriceStream } from '@/hooks/usePriceStream';
import type { HomeTab, MarketIndex, InstrumentWithPrice } from '@/types/market';
import type { AssetType } from '@/design-system';
import { LiveIndicator } from '@/design-system';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '@/lib/watchlistStorage';
import type { WatchlistItem } from '@/lib/watchlistStorage';
import { decodeWatchlistParam } from '@/lib/shareUrl';
import {
  MOCK_INDICES,
  MOCK_STOCKS,
  MOCK_COINS,
  QUICK_ADD_SYMBOLS,
  ALL_MOCK,
} from '@/data/mockData';

// ─── 관심종목 빈 화면 ─────────────────────────────────────────────────────────

interface WatchlistEmptyProps {
  onQuickAdd: (item: WatchlistItem) => void;
}

function WatchlistEmpty({ onQuickAdd }: WatchlistEmptyProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 24px 24px',
        gap: '24px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⭐</div>
        <p style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', margin: '0 0 4px' }}>
          관심종목을 추가해보세요
        </p>
        <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
          검색하거나 아래 인기 종목을 바로 추가할 수 있어요
        </p>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 4px', fontWeight: 500 }}>
          인기 종목 빠른 추가
        </p>
        {QUICK_ADD_SYMBOLS.map((item) => (
          <button
            key={item.id}
            onClick={() => onQuickAdd(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#0F172A',
            }}
          >
            <span style={{ fontWeight: 500 }}>{item.name}</span>
            <span
              style={{
                fontSize: '11px',
                color: '#64748B',
                background: '#E2E8F0',
                borderRadius: '6px',
                padding: '2px 8px',
              }}
            >
              {item.type === 'coin' ? '코인' : '주식'} + 추가
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 섹션 헤더 ────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

function SectionHeader({ title, subtitle }: SectionHeaderProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '20px 16px 4px',
      }}
    >
      <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', margin: 0 }}>{title}</h2>
      {subtitle && (
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>{subtitle}</span>
      )}
    </div>
  );
}

// ─── 크로스에셋 요약 바 ───────────────────────────────────────────────────────

interface CrossAssetBarProps {
  instruments: InstrumentWithPrice[];
  liveData: Map<string, { price: number; change: number; changeRate: number }>;
}

function avgChangeRate(
  items: InstrumentWithPrice[],
  liveData: Map<string, { price: number; change: number; changeRate: number }>
): number | null {
  if (items.length === 0) return null;
  const rates = items.map((i) => liveData.get(i.symbol)?.changeRate ?? i.changeRate);
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

function CrossAssetBar({ instruments, liveData }: CrossAssetBarProps): React.ReactElement | null {
  const stockItems = instruments.filter((i) => i.type === 'stock');
  const coinItems = instruments.filter((i) => i.type === 'coin');

  const stockRate = avgChangeRate(stockItems, liveData);
  const coinRate = avgChangeRate(coinItems, liveData);

  if (stockItems.length === 0 && coinItems.length === 0) return null;

  function rateColor(rate: number | null): string {
    if (rate === null) return '#6B7280';
    if (rate > 0) return 'var(--kr-rise, #E84040)';
    if (rate < 0) return 'var(--kr-fall, #2563EB)';
    return '#6B7280';
  }

  function rateDisplay(rate: number | null): string {
    if (rate === null) return '—';
    const fixed = Math.abs(rate).toFixed(2);
    if (rate > 0) return `+${fixed}%`;
    if (rate < 0) return `-${fixed}%`;
    return '0.00%';
  }

  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        padding: '12px 16px',
        margin: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '0',
      }}
    >
      {stockItems.length > 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#0369A1', fontWeight: 500 }}>
            주식 {stockItems.length}개
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: rateColor(stockRate) }}>
            {rateDisplay(stockRate)}
          </span>
        </div>
      )}
      {stockItems.length > 0 && coinItems.length > 0 && (
        <div style={{ width: '1px', height: '16px', background: '#E2E8F0', flexShrink: 0 }} />
      )}
      {coinItems.length > 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: stockItems.length > 0 ? 'flex-end' : 'flex-start' }}>
          <span style={{ fontSize: '13px', color: '#7C3AED', fontWeight: 500 }}>
            코인 {coinItems.length}개
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: rateColor(coinRate) }}>
            {rateDisplay(coinRate)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── HomePage ─────────────────────────────────────────────────────────────────

// 심볼 → InstrumentWithPrice 조회 헬퍼 (mock 데이터 기반)
function findInstrument(id: string): InstrumentWithPrice | null {
  return ALL_MOCK.find((i) => i.symbol === id) ?? null;
}

export default function HomePage(): React.ReactElement {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<HomeTab>('watchlist');
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [watchlistLoaded, setWatchlistLoaded] = useState(false);
  const [, startTransition] = useTransition();
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>(MOCK_INDICES);
  const [isIndicesLoading, setIsIndicesLoading] = useState(true);

  // 관심종목 스토리지 로드 + ?w= URL 파라미터 처리
  useEffect(() => {
    const loadWatchlist = async () => {
      const stored = await getWatchlist();

      // ?w=KRW-BTC,005930 파라미터로 공유된 목록 병합
      const params = new URLSearchParams(window.location.search);
      const wParam = params.get('w');
      if (wParam) {
        const sharedIds = decodeWatchlistParam(wParam);
        for (const id of sharedIds) {
          const found = ALL_MOCK.find((i) => i.symbol === id);
          if (found && !stored.some((s) => s.id === id)) {
            const item: WatchlistItem = { id, type: found.type, name: found.name, addedAt: Date.now() };
            await addToWatchlist(item);
            stored.push(item);
          }
        }
        // URL 파라미터 제거 (히스토리 정리)
        const url = new URL(window.location.href);
        url.searchParams.delete('w');
        window.history.replaceState(null, '', url.toString());
      }

      setWatchlistItems(stored);
      setWatchlistLoaded(true);
    };
    void loadWatchlist();
  }, []);

  // 시장 지수 API 호출
  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const res = await fetch('/api/v1/market/indices');
        if (!res.ok) throw new Error('indices fetch failed');
        const json = (await res.json()) as {
          data: {
            kospi: { value: number; change: number; changeRate: number };
            kosdaq: { value: number; change: number; changeRate: number };
            btcDominance: { value: number; change: number; changeRate: number };
          };
        };
        const { kospi, kosdaq, btcDominance } = json.data;
        const indices: MarketIndex[] = [
          { id: 'kospi', name: 'KOSPI', value: kospi.value, change: kospi.change, changeRate: kospi.changeRate, status: 'open', type: 'stock' },
          { id: 'kosdaq', name: 'KOSDAQ', value: kosdaq.value, change: kosdaq.change, changeRate: kosdaq.changeRate, status: 'open', type: 'stock' },
          { id: 'btc_dom', name: 'BTC 도미넌스', value: btcDominance.value, change: btcDominance.change, changeRate: btcDominance.changeRate, status: 'open', type: 'coin' },
          // BTC/ETH 가격은 usePriceStream에서 올 것이므로 mock 유지
          MOCK_INDICES[2],
          MOCK_INDICES[3],
        ];
        setMarketIndices(indices);
      } catch {
        // 실패 시 MOCK_INDICES 폴백 유지
      } finally {
        setIsIndicesLoading(false);
      }
    };
    void fetchIndices();
  }, []);

  // 관심종목 ID Set (watchlist 상태 연결용)
  const watchlistIds = useMemo(() => new Set(watchlistItems.map((i) => i.id)), [watchlistItems]);

  // 구독할 심볼 목록 (관심종목 + 전체 mock)
  const streamSymbols = useMemo(() => [
    ...new Set([
      ...watchlistItems.map((i) => i.id),
      ...MOCK_STOCKS.map((s) => s.symbol),
      ...MOCK_COINS.map((c) => c.symbol),
    ]),
  ], [watchlistItems]);

  // WebSocket 실시간 스트림
  const { prices: liveData, status: liveStatus } = usePriceStream(streamSymbols);

  // 탭 전환은 React 18 useTransition으로 부드럽게 처리 + 스크롤 최상단
  const handleTabChange = (tab: HomeTab) => {
    startTransition(() => setActiveTab(tab));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // PullToRefresh: 관심종목 + 시장 지수 재로드
  const handleRefresh = useCallback(async () => {
    const items = await getWatchlist();
    setWatchlistItems(items);
    try {
      const res = await fetch('/api/v1/market/indices');
      if (res.ok) {
        const json = (await res.json()) as {
          data: {
            kospi: { value: number; change: number; changeRate: number };
            kosdaq: { value: number; change: number; changeRate: number };
            btcDominance: { value: number; change: number; changeRate: number };
          };
        };
        const { kospi, kosdaq, btcDominance } = json.data;
        const indices: MarketIndex[] = [
          { id: 'kospi', name: 'KOSPI', value: kospi.value, change: kospi.change, changeRate: kospi.changeRate, status: 'open', type: 'stock' },
          { id: 'kosdaq', name: 'KOSDAQ', value: kosdaq.value, change: kosdaq.change, changeRate: kosdaq.changeRate, status: 'open', type: 'stock' },
          { id: 'btc_dom', name: 'BTC 도미넌스', value: btcDominance.value, change: btcDominance.change, changeRate: btcDominance.changeRate, status: 'open', type: 'coin' },
          MOCK_INDICES[2],
          MOCK_INDICES[3],
        ];
        setMarketIndices(indices);
      }
    } catch { /* 무시 */ }
  }, []);

  // 관심종목 추가 (검색 결과 또는 온보딩 퀵 추가)
  const handleAddToWatchlist = useCallback(async (item: WatchlistItem) => {
    const result = await addToWatchlist({ ...item, addedAt: Date.now() });
    if (result === 'added') {
      setWatchlistItems((prev) => [{ ...item, addedAt: Date.now() }, ...prev]);
      showToast({ text: `${item.name} 관심종목 추가`, type: 'success' });
    } else if (result === 'duplicate') {
      showToast({ text: `${item.name} 이미 추가된 종목`, type: 'warning' });
    } else {
      showToast({ text: '관심종목 최대 100개까지 추가 가능', type: 'error' });
    }
  }, []);

  // 검색에서 종목 선택 시 상세 페이지로 이동
  const handleSelectSymbol = useCallback((symbol: string, _name: string, type: AssetType) => {
    router.push(`/${type === 'coin' ? 'coin' : 'stock'}/${symbol}`);
  }, [router]);

  // 관심종목 탭: WatchlistItem → InstrumentWithPrice 변환
  const watchlistInstruments = useMemo<InstrumentWithPrice[]>(() => {
    return watchlistItems
      .map((item) => findInstrument(item.id) ?? {
        symbol: item.id,
        name: item.name,
        type: item.type,
        exchange: item.type === 'coin' ? 'UPBIT' : 'KOSPI',
        price: 0,
        change: 0,
        changeRate: 0,
        volume: 0,
        timestamp: Date.now(),
      })
      .filter((i): i is InstrumentWithPrice => i !== null);
  }, [watchlistItems]);

  // 현재 탭에 맞는 종목 목록
  const activeInstruments = useMemo<InstrumentWithPrice[]>(() => {
    switch (activeTab) {
      case 'watchlist':
        return watchlistInstruments;
      case 'stock':
        return MOCK_STOCKS;
      case 'coin':
        return MOCK_COINS;
    }
  }, [activeTab, watchlistInstruments]);

  // 관심종목 탭: 로딩 중이거나 빈 상태
  const showWatchlistEmpty = activeTab === 'watchlist' && watchlistLoaded && watchlistItems.length === 0;

  return (
    <>
      {/* ── 상단 헤더 ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'white',
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
          }}
        >
          {/* 로고 */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '-0.05em',
                }}
              >
                CS
              </span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>CoStock</span>
          </div>

          {/* 검색바 */}
          <div style={{ flex: 1 }}>
            <SearchBar
              onSelect={(symbol, name, type) => handleSelectSymbol(symbol, name, type)}
              placeholder="종목·코인 검색"
            />
          </div>

          {/* 실시간 연결 상태 */}
          <LiveIndicator status={liveStatus} showLabel={false} />
        </div>
      </header>

      <PullToRefresh onRefresh={handleRefresh}>
        {/* ── 시장 지수 바 ── */}
        <MarketIndexBar
          indices={marketIndices}
          isLoading={isIndicesLoading}
          liveStatus={liveStatus}
        />

        {/* ── 종목 섹션 ── */}
        <section aria-label="종목 목록">
          <SectionHeader
            title={activeTab === 'stock' ? '국내 주식' : activeTab === 'coin' ? '코인' : '관심종목'}
            subtitle={
              activeTab === 'stock'
                ? '코스피·코스닥 상위'
                : activeTab === 'coin'
                ? '업비트 거래대금 상위'
                : undefined
            }
          />

          {/* 탭 바 */}
          <TabBar activeTab={activeTab} onChange={handleTabChange} watchlistCount={watchlistItems.length} />

          {/* 관심종목 빈 화면 */}
          {showWatchlistEmpty && (
            <WatchlistEmpty onQuickAdd={handleAddToWatchlist} />
          )}

          {/* 크로스에셋 요약 바 */}
          {!showWatchlistEmpty && activeTab === 'watchlist' && watchlistInstruments.length > 0 && (
            <CrossAssetBar instruments={watchlistInstruments} liveData={liveData} />
          )}

          {/* 종목 목록 */}
          {!showWatchlistEmpty && (
            <InstrumentList
              instruments={activeInstruments}
              liveData={liveData}
              isLoading={activeTab === 'watchlist' && !watchlistLoaded}
              tabId={activeTab}
              onSelect={(symbol) => {
                const found = watchlistInstruments.find((i) => i.symbol === symbol)
                  ?? ALL_MOCK.find((i) => i.symbol === symbol);
                if (found) {
                  router.push(`/${found.type === 'coin' ? 'coin' : 'stock'}/${found.symbol}`);
                }
              }}
              watchlistIds={watchlistIds}
              onWatchlistToggle={(item) => {
                if (watchlistIds.has(item.symbol)) {
                  void removeFromWatchlist(item.symbol).then(() => {
                    setWatchlistItems((prev) => prev.filter((w) => w.id !== item.symbol));
                    showToast({ text: `${item.name} 관심종목 제거`, type: 'warning' });
                  });
                } else {
                  void handleAddToWatchlist({ id: item.symbol, type: item.type, name: item.name, addedAt: 0 });
                }
              }}
            />
          )}
        </section>
      </PullToRefresh>

      {/* ── 하단 네비게이션 ── */}
      <BottomNavigation />

      {/* ── 토스트 알림 ── */}
      <Toast />
    </>
  );
}
