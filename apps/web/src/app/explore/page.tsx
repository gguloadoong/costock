/**
 * 탐색 페이지 — 급등/급락/거래량 급증 종목
 *
 * 섹션:
 *   1. 탭 [전체 | 주식 | 코인]
 *   2. 오늘의 급등 TOP5
 *   3. 오늘의 급락 TOP5
 *   4. 거래량 급증 TOP5
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Toast } from '@/components/Toast';
import { usePriceStream } from '@/hooks/usePriceStream';
import { HeatmapView } from '@/components/HeatmapView';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type AssetFilter = 'all' | 'stock' | 'coin';

interface RankItem {
  symbol: string;
  name: string;
  price: number;
  changeRate: number;
  volume?: number;
  type: 'stock' | 'coin';
}

interface SymbolMeta {
  name: string;
  type: 'stock' | 'coin';
  baseChangeRate: number;
  basePrice: number;
  baseVolume?: number;
}

// ─── 추적 심볼 목록 ────────────────────────────────────────────────────────────

const TRACKED_SYMBOLS = [
  // 주식 (상위 20개 코스피)
  '005930', '000660', '373220', '207940', '005380', '035420', '000270',
  '051910', '006400', '028260', '105560', '055550', '035720', '012330',
  '066570', '003550', '096770', '034730', '247540', '086280',
  // 코인 (업비트 주요)
  'KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-SOL', 'KRW-ADA',
  'KRW-DOGE', 'KRW-AVAX', 'KRW-MATIC', 'KRW-DOT', 'KRW-LINK',
];

// ─── 심볼 기본 정보 맵 ────────────────────────────────────────────────────────

const SYMBOL_META: Record<string, SymbolMeta> = {
  // 주식
  '005930': { name: '삼성전자', type: 'stock', baseChangeRate: 3.12, basePrice: 78_400, baseVolume: 24_812_091 },
  '000660': { name: 'SK하이닉스', type: 'stock', baseChangeRate: 2.41, basePrice: 198_000, baseVolume: 8_341_200 },
  '373220': { name: 'LG에너지솔루션', type: 'stock', baseChangeRate: 0.85, basePrice: 412_000, baseVolume: 1_204_310 },
  '207940': { name: '삼성바이오로직스', type: 'stock', baseChangeRate: -0.42, basePrice: 873_000, baseVolume: 384_920 },
  '005380': { name: '현대차', type: 'stock', baseChangeRate: 1.20, basePrice: 218_000, baseVolume: 2_103_440 },
  '035420': { name: 'NAVER', type: 'stock', baseChangeRate: -1.10, basePrice: 185_000, baseVolume: 1_923_410 },
  '000270': { name: '기아', type: 'stock', baseChangeRate: 0.60, basePrice: 105_000, baseVolume: 3_481_200 },
  '051910': { name: 'LG화학', type: 'stock', baseChangeRate: -3.87, basePrice: 312_000, baseVolume: 944_210 },
  '006400': { name: '삼성SDI', type: 'stock', baseChangeRate: -1.50, basePrice: 287_000, baseVolume: 712_880 },
  '028260': { name: '삼성물산', type: 'stock', baseChangeRate: 0.30, basePrice: 148_000, baseVolume: 561_430 },
  '105560': { name: 'KB금융', type: 'stock', baseChangeRate: 1.05, basePrice: 89_500, baseVolume: 2_840_770 },
  '055550': { name: '신한지주', type: 'stock', baseChangeRate: 0.75, basePrice: 56_200, baseVolume: 3_104_220 },
  '035720': { name: '카카오', type: 'stock', baseChangeRate: -2.66, basePrice: 41_850, baseVolume: 7_204_332 },
  '012330': { name: '현대모비스', type: 'stock', baseChangeRate: 0.45, basePrice: 236_000, baseVolume: 498_110 },
  '066570': { name: 'LG전자', type: 'stock', baseChangeRate: -0.80, basePrice: 96_200, baseVolume: 1_832_540 },
  '003550': { name: 'LG', type: 'stock', baseChangeRate: 0.20, basePrice: 78_100, baseVolume: 623_890 },
  '096770': { name: 'SK이노베이션', type: 'stock', baseChangeRate: -0.35, basePrice: 124_000, baseVolume: 1_047_600 },
  '034730': { name: 'SK', type: 'stock', baseChangeRate: 0.50, basePrice: 168_000, baseVolume: 412_330 },
  '247540': { name: '에코프로비엠', type: 'stock', baseChangeRate: -1.20, basePrice: 142_000, baseVolume: 5_201_440 },
  '086280': { name: '현대글로비스', type: 'stock', baseChangeRate: 0.90, basePrice: 198_000, baseVolume: 387_210 },
  // 코인
  'KRW-BTC': { name: '비트코인', type: 'coin', baseChangeRate: 4.23, basePrice: 94_500_000, baseVolume: 18_204 },
  'KRW-ETH': { name: '이더리움', type: 'coin', baseChangeRate: 2.87, basePrice: 4_820_000, baseVolume: 92_910 },
  'KRW-XRP': { name: '리플', type: 'coin', baseChangeRate: -1.89, basePrice: 3_710, baseVolume: 3_204_885 },
  'KRW-SOL': { name: '솔라나', type: 'coin', baseChangeRate: 1.98, basePrice: 184_000, baseVolume: 48_320 },
  'KRW-ADA': { name: '에이다', type: 'coin', baseChangeRate: -3.22, basePrice: 1_120, baseVolume: 4_882_001 },
  'KRW-DOGE': { name: '도지코인', type: 'coin', baseChangeRate: -5.41, basePrice: 182, baseVolume: 12_304_550 },
  'KRW-AVAX': { name: '아발란체', type: 'coin', baseChangeRate: 0.65, basePrice: 38_200, baseVolume: 182_440 },
  'KRW-MATIC': { name: '폴리곤', type: 'coin', baseChangeRate: -0.92, basePrice: 940, baseVolume: 8_102_330 },
  'KRW-DOT': { name: '폴카닷', type: 'coin', baseChangeRate: 1.15, basePrice: 10_800, baseVolume: 1_024_780 },
  'KRW-LINK': { name: '체인링크', type: 'coin', baseChangeRate: 2.30, basePrice: 22_400, baseVolume: 641_920 },
};

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function formatPrice(price: number, type: 'stock' | 'coin'): string {
  if (type === 'coin' && price >= 1_000_000) {
    return (price / 1_000_000).toFixed(2) + '백만원';
  }
  return price.toLocaleString('ko-KR') + '원';
}

function formatVolume(volume: number): string {
  if (volume >= 10_000) return (volume / 10_000).toFixed(1) + '만';
  return volume.toLocaleString('ko-KR');
}

// ─── 탭 바 ────────────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<AssetFilter, string> = {
  all: '전체',
  stock: '주식',
  coin: '코인',
};

const FILTER_ORDER: AssetFilter[] = ['all', 'stock', 'coin'];

interface FilterTabsProps {
  active: AssetFilter;
  onChange: (f: AssetFilter) => void;
}

function FilterTabs({ active, onChange }: FilterTabsProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        background: 'white',
        borderBottom: '1px solid #E2E8F0',
      }}
      role="tablist"
      aria-label="자산 종류 필터"
    >
      {FILTER_ORDER.map((f) => {
        const isActive = active === f;
        return (
          <button
            key={f}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(f)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: isActive ? '1.5px solid #0F172A' : '1.5px solid #E2E8F0',
              background: isActive ? '#0F172A' : 'white',
              color: isActive ? 'white' : '#64748B',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {FILTER_LABELS[f]}
          </button>
        );
      })}
    </div>
  );
}

// ─── 섹션 헤더 ────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  count?: number;
}

function SectionHeader({ title, count }: SectionHeaderProps): React.ReactElement {
  return (
    <h2
      style={{
        fontSize: '16px',
        fontWeight: 600,
        color: '#0F172A',
        margin: 0,
        padding: '20px 16px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {title}
      {count !== undefined && (
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#64748B',
            background: '#F1F5F9',
            borderRadius: '10px',
            padding: '1px 8px',
          }}
        >
          {count === 0 ? '-' : count}
        </span>
      )}
    </h2>
  );
}

// ─── 순위 카드 ────────────────────────────────────────────────────────────────

interface RankListProps {
  items: RankItem[];
  showVolume?: boolean;
  filter: AssetFilter;
  onNavigate: (item: RankItem) => void;
}

function RankList({ items, showVolume, filter, onNavigate }: RankListProps): React.ReactElement {
  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);

  if (filtered.length === 0) {
    return (
      <div
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: '#94A3B8',
          fontSize: '14px',
        }}
      >
        해당하는 종목이 없습니다
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        margin: '0 16px 8px',
        overflow: 'hidden',
      }}
    >
      {filtered.map((item, idx) => {
        const isRise = item.changeRate > 0;
        const isFall = item.changeRate < 0;
        const changeColor = isRise ? 'var(--kr-rise)' : isFall ? 'var(--kr-fall)' : '#6B7280';
        const changeSign = isRise ? '+' : '';

        return (
          <button
            key={item.symbol}
            onClick={() => onNavigate(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '14px 16px',
              background: 'none',
              border: 'none',
              borderBottom: idx < filtered.length - 1 ? '1px solid #F1F5F9' : 'none',
              cursor: 'pointer',
              textAlign: 'left',
              gap: '12px',
            }}
          >
            {/* 순위 */}
            <span
              style={{
                width: '20px',
                fontSize: '14px',
                fontWeight: 700,
                color: idx < 3 ? '#0F172A' : '#94A3B8',
                flexShrink: 0,
                textAlign: 'center',
              }}
            >
              {idx + 1}
            </span>

            {/* 종목명 + 배지 */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#0F172A',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.name}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: '10px',
                  color: '#64748B',
                  background: '#F1F5F9',
                  borderRadius: '4px',
                  padding: '1px 6px',
                }}
              >
                {item.type === 'coin' ? '코인' : '주식'}
              </span>
            </div>

            {/* 가격 + 등락률 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
              {showVolume ? (
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  거래량 {formatVolume(item.volume ?? 0)}
                </span>
              ) : (
                <span style={{ fontSize: '13px', color: '#475569' }}>
                  {formatPrice(item.price, item.type)}
                </span>
              )}
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: changeColor,
                }}
              >
                {changeSign}{item.changeRate.toFixed(2)}%
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── ExplorePage ──────────────────────────────────────────────────────────────

export default function ExplorePage(): React.ReactElement {
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [viewMode, setViewMode] = useState<'list' | 'heatmap'>('list');
  const router = useRouter();

  const { prices } = usePriceStream(TRACKED_SYMBOLS);

  // 전체 심볼을 RankItem으로 변환 (liveData로 changeRate/price 덮어쓰기)
  const allItems = useMemo<RankItem[]>(() => {
    return TRACKED_SYMBOLS.map((symbol) => {
      const meta = SYMBOL_META[symbol];
      const live = prices.get(symbol);
      return {
        symbol,
        name: meta.name,
        type: meta.type,
        price: live?.price ?? meta.basePrice,
        changeRate: live?.changeRate ?? meta.baseChangeRate,
        volume: live?.volume ?? meta.baseVolume,
      };
    });
  }, [prices]);

  // 급등 TOP5: changeRate 내림차순
  const gainers = useMemo<RankItem[]>(
    () => [...allItems].sort((a, b) => b.changeRate - a.changeRate).slice(0, 5),
    [allItems]
  );

  // 급락 TOP5: changeRate 오름차순
  const losers = useMemo<RankItem[]>(
    () => [...allItems].sort((a, b) => a.changeRate - b.changeRate).slice(0, 5),
    [allItems]
  );

  // 거래량 TOP5: volume 내림차순 (volume 있는 항목만)
  const volumeTop = useMemo<RankItem[]>(
    () =>
      [...allItems]
        .filter((i) => i.volume !== undefined)
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
        .slice(0, 5),
    [allItems]
  );

  const handleNavigate = (item: RankItem) => {
    const path = item.type === 'coin'
      ? `/coin/${item.symbol}`
      : `/stock/${item.symbol}`;
    router.push(path);
  };

  const handleSelect = (symbol: string, type: 'stock' | 'coin') => {
    const path = type === 'coin' ? `/coin/${symbol}` : `/stock/${symbol}`;
    router.push(path);
  };

  // 히트맵에 표시할 items: 현재 필터 기준 전체 allItems
  const heatmapItems = useMemo(
    () => filter === 'all' ? allItems : allItems.filter(i => i.type === filter),
    [allItems, filter]
  );

  return (
    <>
      <div
        style={{
          maxWidth: '430px',
          margin: '0 auto',
          background: '#F8FAFC',
          minHeight: '100vh',
          paddingBottom: '80px',
        }}
      >
        {/* 상단 헤더 */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background: 'white',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              탐색
            </h1>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-lg text-xs ${viewMode === 'list' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
              >
                목록
              </button>
              <button
                onClick={() => setViewMode('heatmap')}
                className={`px-2.5 py-1 rounded-lg text-xs ${viewMode === 'heatmap' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
              >
                히트맵
              </button>
            </div>
          </div>
          <FilterTabs active={filter} onChange={setFilter} />
        </header>

        {viewMode === 'heatmap' ? (
          <HeatmapView items={heatmapItems} onSelect={handleSelect} />
        ) : (
          <>
            {/* 급등 TOP5 */}
            <section aria-label="오늘의 급등">
              <SectionHeader
                title="🔥 오늘의 급등"
                count={filter === 'all' ? gainers.length : gainers.filter(i => i.type === filter).length}
              />
              <RankList items={gainers} filter={filter} onNavigate={handleNavigate} />
            </section>

            {/* 급락 TOP5 */}
            <section aria-label="오늘의 급락">
              <SectionHeader
                title="📉 오늘의 급락"
                count={filter === 'all' ? losers.length : losers.filter(i => i.type === filter).length}
              />
              <RankList items={losers} filter={filter} onNavigate={handleNavigate} />
            </section>

            {/* 거래량 급증 TOP5 */}
            <section aria-label="거래량 급증">
              <SectionHeader
                title="📊 거래량 급증"
                count={filter === 'all' ? volumeTop.length : volumeTop.filter(i => i.type === filter).length}
              />
              <RankList items={volumeTop} showVolume filter={filter} onNavigate={handleNavigate} />
            </section>
          </>
        )}
      </div>

      <BottomNavigation />
      <Toast />
    </>
  );
}
