/**
 * 탐색 페이지 — 급등/급락/거래량 급증 종목
 *
 * 섹션:
 *   1. 탭 [전체 | 주식 | 코인]
 *   2. 정렬 기준 pill 버튼 바 [급등 🔥 | 급락 📉 | 거래량 💧 | 시총 👑]
 *   3. 정렬된 랭킹 리스트 (상위 10개)
 *   4. 히트맵 뷰 (토글)
 *
 * 데이터 전략:
 *   - 초기 가격: GET /api/v1/prices?symbols=... (HTTP 배치 조회)
 *   - 실시간 갱신: usePriceStream (WebSocket)
 *   - API 실패 시 basePrice/baseChangeRate 폴백 유지
 */

'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Toast } from '@/components/Toast';
import { usePriceStream } from '@/hooks/usePriceStream';
import { HeatmapView } from '@/components/HeatmapView';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type AssetFilter = 'all' | 'stock' | 'coin';
type SortBy = 'gainers' | 'losers' | 'volume' | 'marketcap';

/** 'stock_us' 구분을 위해 currency 필드 추가 */
interface RankItem {
  symbol: string;
  name: string;
  price: number;
  changeRate: number;
  volume?: number;
  type: 'stock' | 'coin';
  currency: 'KRW' | 'USD';
}

interface SymbolMeta {
  name: string;
  type: 'stock' | 'coin';
  currency: 'KRW' | 'USD';
  baseChangeRate: number;
  basePrice: number;
  baseVolume?: number;
}

/** GET /api/v1/prices 응답 아이템 */
interface ApiPriceItem {
  symbol: string;
  price: number;
  changeRate: number;
  assetType: 'stock_kr' | 'stock_us' | 'etf_kr' | 'etf_us' | 'crypto';
}

// ─── 추적 심볼 목록 ────────────────────────────────────────────────────────────

const TRACKED_SYMBOLS = [
  // 국내주식 (KIS API — .KS suffix로 priceMap에 저장됨)
  '005930.KS', '000660.KS', '373220.KS', '207940.KS', '005380.KS',
  '035420.KS', '000270.KS', '051910.KS', '006400.KS', '028260.KS',
  '105560.KS', '055550.KS', '035720.KS', '012330.KS', '066570.KS',
  '003550.KS', '096770.KS', '034730.KS', '247540.KS', '086280.KS',
  // 미국주식 (yahoo-finance2)
  'NVDA', 'AAPL', 'MSFT', 'TSLA', 'META',
  // 코인 (업비트)
  'KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-SOL', 'KRW-ADA',
  'KRW-DOGE', 'KRW-AVAX', 'KRW-MATIC', 'KRW-DOT', 'KRW-LINK',
];

// ─── 심볼 기본 정보 맵 ────────────────────────────────────────────────────────
// basePrice / baseChangeRate 는 API 실패 시 폴백용 (Phase 0 mock 기준)

const SYMBOL_META: Record<string, SymbolMeta> = {
  // 국내주식 (.KS suffix — priceService 저장 키와 일치)
  '005930.KS': { name: '삼성전자',     type: 'stock', currency: 'KRW', baseChangeRate:  3.12, basePrice:  78_400, baseVolume: 24_812_091 },
  '000660.KS': { name: 'SK하이닉스',  type: 'stock', currency: 'KRW', baseChangeRate:  2.41, basePrice: 198_000, baseVolume:  8_341_200 },
  '373220.KS': { name: 'LG에너지솔루션', type: 'stock', currency: 'KRW', baseChangeRate:  0.85, basePrice: 412_000, baseVolume:  1_204_310 },
  '207940.KS': { name: '삼성바이오로직스', type: 'stock', currency: 'KRW', baseChangeRate: -0.42, basePrice: 873_000, baseVolume:    384_920 },
  '005380.KS': { name: '현대차',       type: 'stock', currency: 'KRW', baseChangeRate:  1.20, basePrice: 218_000, baseVolume:  2_103_440 },
  '035420.KS': { name: 'NAVER',        type: 'stock', currency: 'KRW', baseChangeRate: -1.10, basePrice: 185_000, baseVolume:  1_923_410 },
  '000270.KS': { name: '기아',         type: 'stock', currency: 'KRW', baseChangeRate:  0.60, basePrice: 105_000, baseVolume:  3_481_200 },
  '051910.KS': { name: 'LG화학',       type: 'stock', currency: 'KRW', baseChangeRate: -3.87, basePrice: 312_000, baseVolume:    944_210 },
  '006400.KS': { name: '삼성SDI',      type: 'stock', currency: 'KRW', baseChangeRate: -1.50, basePrice: 287_000, baseVolume:    712_880 },
  '028260.KS': { name: '삼성물산',     type: 'stock', currency: 'KRW', baseChangeRate:  0.30, basePrice: 148_000, baseVolume:    561_430 },
  '105560.KS': { name: 'KB금융',       type: 'stock', currency: 'KRW', baseChangeRate:  1.05, basePrice:  89_500, baseVolume:  2_840_770 },
  '055550.KS': { name: '신한지주',     type: 'stock', currency: 'KRW', baseChangeRate:  0.75, basePrice:  56_200, baseVolume:  3_104_220 },
  '035720.KS': { name: '카카오',       type: 'stock', currency: 'KRW', baseChangeRate: -2.66, basePrice:  41_850, baseVolume:  7_204_332 },
  '012330.KS': { name: '현대모비스',   type: 'stock', currency: 'KRW', baseChangeRate:  0.45, basePrice: 236_000, baseVolume:    498_110 },
  '066570.KS': { name: 'LG전자',       type: 'stock', currency: 'KRW', baseChangeRate: -0.80, basePrice:  96_200, baseVolume:  1_832_540 },
  '003550.KS': { name: 'LG',           type: 'stock', currency: 'KRW', baseChangeRate:  0.20, basePrice:  78_100, baseVolume:    623_890 },
  '096770.KS': { name: 'SK이노베이션', type: 'stock', currency: 'KRW', baseChangeRate: -0.35, basePrice: 124_000, baseVolume:  1_047_600 },
  '034730.KS': { name: 'SK',           type: 'stock', currency: 'KRW', baseChangeRate:  0.50, basePrice: 168_000, baseVolume:    412_330 },
  '247540.KS': { name: '에코프로비엠', type: 'stock', currency: 'KRW', baseChangeRate: -1.20, basePrice: 142_000, baseVolume:  5_201_440 },
  '086280.KS': { name: '현대글로비스', type: 'stock', currency: 'KRW', baseChangeRate:  0.90, basePrice: 198_000, baseVolume:    387_210 },
  // 미국주식 (yahoo-finance2 — USD)
  'NVDA': { name: 'NVIDIA',     type: 'stock', currency: 'USD', baseChangeRate: -0.84, basePrice: 180,   baseVolume: 50_000_000 },
  'AAPL': { name: 'Apple',      type: 'stock', currency: 'USD', baseChangeRate: -0.50, basePrice: 250,   baseVolume: 40_000_000 },
  'MSFT': { name: 'Microsoft',  type: 'stock', currency: 'USD', baseChangeRate:  0.30, basePrice: 415,   baseVolume: 25_000_000 },
  'TSLA': { name: 'Tesla',      type: 'stock', currency: 'USD', baseChangeRate: -1.20, basePrice: 280,   baseVolume: 80_000_000 },
  'META': { name: 'Meta',       type: 'stock', currency: 'USD', baseChangeRate:  0.65, basePrice: 590,   baseVolume: 15_000_000 },
  // 코인 (업비트 — KRW)
  'KRW-BTC':  { name: '비트코인', type: 'coin', currency: 'KRW', baseChangeRate:  4.23, basePrice:  94_500_000, baseVolume:     18_204 },
  'KRW-ETH':  { name: '이더리움', type: 'coin', currency: 'KRW', baseChangeRate:  2.87, basePrice:   4_820_000, baseVolume:     92_910 },
  'KRW-XRP':  { name: '리플',     type: 'coin', currency: 'KRW', baseChangeRate: -1.89, basePrice:       3_710, baseVolume:  3_204_885 },
  'KRW-SOL':  { name: '솔라나',   type: 'coin', currency: 'KRW', baseChangeRate:  1.98, basePrice:     184_000, baseVolume:     48_320 },
  'KRW-ADA':  { name: '에이다',   type: 'coin', currency: 'KRW', baseChangeRate: -3.22, basePrice:       1_120, baseVolume:  4_882_001 },
  'KRW-DOGE': { name: '도지코인', type: 'coin', currency: 'KRW', baseChangeRate: -5.41, basePrice:         182, baseVolume: 12_304_550 },
  'KRW-AVAX': { name: '아발란체', type: 'coin', currency: 'KRW', baseChangeRate:  0.65, basePrice:      38_200, baseVolume:    182_440 },
  'KRW-MATIC':{ name: '폴리곤',   type: 'coin', currency: 'KRW', baseChangeRate: -0.92, basePrice:         940, baseVolume:  8_102_330 },
  'KRW-DOT':  { name: '폴카닷',   type: 'coin', currency: 'KRW', baseChangeRate:  1.15, basePrice:      10_800, baseVolume:  1_024_780 },
  'KRW-LINK': { name: '체인링크', type: 'coin', currency: 'KRW', baseChangeRate:  2.30, basePrice:      22_400, baseVolume:    641_920 },
};

// ─── 환경변수 ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

// ─── 초기 가격 HTTP 조회 훅 ──────────────────────────────────────────────────
// usePriceStream(WebSocket)이 연결되기 전 초기 가격을 API로 채운다.
// API 실패 시 에러 없이 빈 Map 반환 → SYMBOL_META.basePrice 폴백 유지.

function useInitialPrices(symbols: string[]): Map<string, { price: number; changeRate: number }> {
  const [initialPrices, setInitialPrices] = React.useState<Map<string, { price: number; changeRate: number }>>(new Map());
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current || symbols.length === 0) return;
    fetchedRef.current = true;

    const query = symbols.join(',');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);

    fetch(`${API_BASE}/api/v1/prices?symbols=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ data: ApiPriceItem[] }>;
      })
      .then(({ data }) => {
        const map = new Map<string, { price: number; changeRate: number }>();
        for (const item of data) {
          if (item.price > 0) {
            map.set(item.symbol, { price: item.price, changeRate: item.changeRate });
          }
        }
        setInitialPrices(map);
      })
      .catch(() => {
        // API 실패 시 basePrice 폴백 — 조용히 무시
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
    // symbols는 컴포넌트 생애 동안 변하지 않으므로 최초 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return initialPrices;
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

/**
 * 가격 포맷:
 *   - KRW (국내주식/코인): 천 단위 콤마 + 원
 *   - USD (미국주식):      $180.40 형식
 */
function formatPrice(price: number, currency: 'KRW' | 'USD'): string {
  if (currency === 'USD') {
    return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // KRW: 백만원 이상 코인은 축약
  if (price >= 1_000_000) {
    return (price / 1_000_000).toFixed(2) + '백만원';
  }
  return price.toLocaleString('ko-KR') + '원';
}

function formatVolume(volume: number): string {
  if (volume >= 10_000) return (volume / 10_000).toFixed(1) + '만';
  return volume.toLocaleString('ko-KR');
}

function getMarketCap(item: RankItem): number {
  // USD 주식은 KRW 환산 없이 USD 기준 상대 비교 (시총 정렬 용도)
  return item.price * (item.type === 'stock' ? 100_000_000 : 1);
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

// ─── 정렬 기준 pill 버튼 바 ───────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'gainers', label: '급등 🔥' },
  { key: 'losers', label: '급락 📉' },
  { key: 'volume', label: '거래량 💧' },
  { key: 'marketcap', label: '시총 👑' },
];

interface SortTabsProps {
  active: SortBy;
  onChange: (s: SortBy) => void;
}

function SortTabs({ active, onChange }: SortTabsProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '10px 16px',
        background: 'white',
        borderBottom: '1px solid #E2E8F0',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
      }}
      aria-label="정렬 기준"
    >
      {SORT_OPTIONS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              background: isActive ? '#2563EB' : '#F1F5F9',
              color: isActive ? 'white' : '#64748B',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
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

// ─── 랭킹 리스트 (통합, 상위 10개) ──────────────────────────────────────────

interface RankingListProps {
  items: RankItem[];
  sortBy: SortBy;
  onNavigate: (item: RankItem) => void;
}

function RankingList({ items, sortBy, onNavigate }: RankingListProps): React.ReactElement {
  if (items.length === 0) {
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

  const showVolume = sortBy === 'volume';
  const showMarketCap = sortBy === 'marketcap';

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        margin: '0 16px 8px',
        overflow: 'hidden',
      }}
    >
      {items.map((item, idx) => {
        const isRise = item.changeRate > 0;
        const isFall = item.changeRate < 0;
        const changeColor = isRise ? '#E84040' : isFall ? '#2563EB' : '#6B7280';
        const changeSign = isRise ? '+' : '';
        const arrow = isRise ? ' ↑' : isFall ? ' ↓' : '';
        // 거래소 표시: 코인→업비트, US 주식→나스닥/NYSE, KR 주식→코스피
        const exchange =
          item.type === 'coin' ? '업비트' :
          item.currency === 'USD' ? 'NASDAQ' : '코스피';
        const icon = item.type === 'coin' ? '🪙' : item.currency === 'USD' ? '🇺🇸' : '🏢';

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
              borderBottom: idx < items.length - 1 ? '1px solid #F1F5F9' : 'none',
              cursor: 'pointer',
              textAlign: 'left',
              gap: '12px',
            }}
          >
            {/* 순위 번호 */}
            <span
              style={{
                width: '20px',
                fontSize: '14px',
                fontWeight: 700,
                color: '#94A3B8',
                flexShrink: 0,
                textAlign: 'center',
              }}
            >
              {idx + 1}
            </span>

            {/* 아이콘 + 종목명 + 심볼·거래소 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px' }}>{icon}</span>
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
              </div>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                {item.symbol} · {exchange}
              </span>
            </div>

            {/* 가격 + 변동률 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
              {showVolume ? (
                <span style={{ fontSize: '13px', color: '#475569' }}>
                  {formatVolume(item.volume ?? 0)}
                </span>
              ) : showMarketCap ? (
                <span style={{ fontSize: '13px', color: '#475569' }}>
                  {(getMarketCap(item) / 1_000_000_000_000).toFixed(1)}조
                </span>
              ) : (
                <span style={{ fontSize: '13px', color: '#475569' }}>
                  {formatPrice(item.price, item.currency)}
                </span>
              )}
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: changeColor,
                }}
              >
                {changeSign}{item.changeRate.toFixed(2)}%{arrow}
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
  const [sortBy, setSortBy] = useState<SortBy>('gainers');
  const [viewMode, setViewMode] = useState<'list' | 'heatmap'>('list');
  const router = useRouter();

  // 1단계: HTTP 배치 조회로 초기 가격 채우기 (WebSocket 연결 전 공백 방지)
  const initialPrices = useInitialPrices(TRACKED_SYMBOLS);

  // 2단계: WebSocket 실시간 갱신 (초기 가격 위에 덮어씀)
  const { prices: livePrices } = usePriceStream(TRACKED_SYMBOLS);

  // 전체 심볼을 RankItem으로 변환
  // 우선순위: WebSocket 실시간 > HTTP 초기 > SYMBOL_META 폴백
  const allItems = useMemo<RankItem[]>(() => {
    return TRACKED_SYMBOLS.map((symbol) => {
      const meta = SYMBOL_META[symbol];
      const live = livePrices.get(symbol);
      const initial = initialPrices.get(symbol);
      return {
        symbol,
        name: meta.name,
        type: meta.type,
        currency: meta.currency,
        price: live?.price ?? initial?.price ?? meta.basePrice,
        changeRate: live?.changeRate ?? initial?.changeRate ?? meta.baseChangeRate,
        // volume은 API 응답에 없으므로 WebSocket 또는 baseVolume 폴백
        volume: live?.volume ?? meta.baseVolume,
      };
    });
  }, [livePrices, initialPrices]);

  // assetFilter 적용
  const filteredItems = useMemo<RankItem[]>(
    () => (filter === 'all' ? allItems : allItems.filter((i) => i.type === filter)),
    [allItems, filter]
  );

  // sortBy 기준으로 정렬 후 상위 10개
  const rankedItems = useMemo<RankItem[]>(() => {
    const sorted = [...filteredItems];
    switch (sortBy) {
      case 'gainers':
        sorted.sort((a, b) => b.changeRate - a.changeRate);
        break;
      case 'losers':
        sorted.sort((a, b) => a.changeRate - b.changeRate);
        break;
      case 'volume':
        sorted.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
        break;
      case 'marketcap':
        sorted.sort((a, b) => getMarketCap(b) - getMarketCap(a));
        break;
    }
    return sorted.slice(0, 10);
  }, [filteredItems, sortBy]);

  const handleNavigate = (item: RankItem) => {
    // US 주식 심볼(.KS suffix 없음)은 그대로 사용, KR 주식은 .KS 제거
    const symbol = item.symbol.endsWith('.KS')
      ? item.symbol.slice(0, -3)
      : item.symbol;
    const path = item.type === 'coin' ? `/coin/${symbol}` : `/stock/${symbol}`;
    router.push(path);
  };

  const handleSelect = (symbol: string, type: 'stock' | 'coin') => {
    const path = type === 'coin' ? `/coin/${symbol}` : `/stock/${symbol}`;
    router.push(path);
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? '';

  // 히트맵에 표시할 items: 현재 필터 기준 전체 allItems
  const heatmapItems = useMemo(
    () => (filter === 'all' ? allItems : allItems.filter((i) => i.type === filter)),
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
          {viewMode === 'list' && (
            <SortTabs active={sortBy} onChange={setSortBy} />
          )}
        </header>

        {viewMode === 'heatmap' ? (
          <HeatmapView items={heatmapItems} onSelect={handleSelect} />
        ) : (
          <section aria-label={`${sortLabel} 랭킹`}>
            <SectionHeader
              title={`${sortLabel} TOP10`}
              count={rankedItems.length}
            />
            <RankingList
              items={rankedItems}
              sortBy={sortBy}
              onNavigate={handleNavigate}
            />
          </section>
        )}
      </div>

      <BottomNavigation />
      <Toast />
    </>
  );
}
