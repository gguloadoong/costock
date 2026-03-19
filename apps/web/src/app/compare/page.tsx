/**
 * ComparePage — 두 종목 나란히 비교
 *
 * URL: /compare?a=005930&b=KRW-BTC
 * useSearchParams()로 a, b 파라미터 읽기
 * 파라미터 없으면 기본값: a='005930', b='KRW-BTC'
 */

'use client';

import React, { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BottomNavigation } from '@/components/BottomNavigation';
import { formatKRW, formatVolume, formatChangeRate, getPriceColor } from '@/lib/formatters';

// ─── Mock 데이터 ──────────────────────────────────────────────────────────────

const MOCK_NAMES: Record<string, string> = {
  '005930': '삼성전자',
  '000660': 'SK하이닉스',
  '035720': '카카오',
  '035420': 'NAVER',
  'KRW-BTC': '비트코인',
  'KRW-ETH': '이더리움',
  'KRW-XRP': '리플',
  'KRW-SOL': '솔라나',
};

const MOCK_PRICES: Record<string, number> = {
  '005930': 85_400,
  '000660': 198_500,
  '035720': 43_250,
  '035420': 212_500,
  'KRW-BTC': 94_500_000,
  'KRW-ETH': 5_420_000,
  'KRW-XRP': 3_845,
  'KRW-SOL': 298_500,
};

const MOCK_CHANGES: Record<string, { change: number; changeRate: number }> = {
  '005930': { change: 1_200, changeRate: 1.43 },
  '000660': { change: -2_500, changeRate: -1.24 },
  '035720': { change: 350, changeRate: 0.82 },
  '035420': { change: 0, changeRate: 0 },
  'KRW-BTC': { change: 3_840_000, changeRate: 4.23 },
  'KRW-ETH': { change: -88_000, changeRate: -1.60 },
  'KRW-XRP': { change: 124, changeRate: 3.33 },
  'KRW-SOL': { change: -4_200, changeRate: -1.39 },
};

const MOCK_VOLUMES: Record<string, number> = {
  '005930': 24_800_000,
  '000660': 3_812_091,
  '035720': 7_204_332,
  '035420': 1_923_410,
  'KRW-BTC': 18_204,
  'KRW-ETH': 42_910,
  'KRW-XRP': 1_204_885,
  'KRW-SOL': 32_091,
};

const MOCK_52W: Record<string, { high: number; low: number; ytd: number }> = {
  '005930': { high: 98_800, low: 60_100, ytd: 18.4 },
  '000660': { high: 248_000, low: 158_000, ytd: 24.1 },
  'KRW-BTC': { high: 158_000_000, low: 52_000_000, ytd: 38.2 },
  'KRW-ETH': { high: 7_800_000, low: 2_400_000, ytd: 22.8 },
  'KRW-XRP': { high: 5_200, low: 2_100, ytd: -12.4 },
  'KRW-SOL': { high: 420_000, low: 168_000, ytd: 44.1 },
  '035420': { high: 245_000, low: 158_000, ytd: -8.2 },
  '035720': { high: 58_900, low: 32_100, ytd: -18.6 },
};

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function getAssetType(symbol: string): 'stock' | 'coin' {
  return symbol.startsWith('KRW-') ? 'coin' : 'stock';
}

function getMockData(symbol: string): {
  name: string;
  price: number;
  change: number;
  changeRate: number;
  volume: number;
  high52w: number;
  low52w: number;
  ytd: number;
} {
  const name = MOCK_NAMES[symbol] ?? symbol;
  const price = MOCK_PRICES[symbol] ?? 10_000;
  const { change, changeRate } = MOCK_CHANGES[symbol] ?? { change: 0, changeRate: 0 };
  const volume = MOCK_VOLUMES[symbol] ?? 1_000_000;
  const w52 = MOCK_52W[symbol] ?? { high: Math.round(price * 1.35), low: Math.round(price * 0.65), ytd: 0 };
  return { name, price, change, changeRate, volume, high52w: w52.high, low52w: w52.low, ytd: w52.ytd };
}

// ─── 비교 행 컴포넌트 ──────────────────────────────────────────────────────────

interface CompareRowProps {
  label: string;
  valueA: string;
  valueB: string;
  isEven: boolean;
}

function CompareRow({ label, valueA, valueB, isEven }: CompareRowProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        borderBottom: '1px solid #E2E8F0',
        background: isEven ? '#F8FAFC' : 'white',
      }}
    >
      <div
        style={{
          padding: '12px 8px',
          fontSize: '13px',
          color: '#64748B',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {label}
      </div>
      <div
        style={{
          padding: '12px 8px',
          fontSize: '14px',
          fontWeight: 600,
          color: '#0F172A',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'Menlo, Consolas, monospace',
          borderLeft: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {valueA}
      </div>
      <div
        style={{
          padding: '12px 8px',
          fontSize: '14px',
          fontWeight: 600,
          color: '#0F172A',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'Menlo, Consolas, monospace',
          borderLeft: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {valueB}
      </div>
    </div>
  );
}

// ─── YTD 바 차트 ──────────────────────────────────────────────────────────────

interface YtdBarProps {
  name: string;
  ytd: number;
  maxAbsYtd: number;
}

function YtdBar({ name, ytd, maxAbsYtd }: YtdBarProps): React.ReactElement {
  const widthPct = maxAbsYtd === 0 ? 0 : Math.round((Math.abs(ytd) / maxAbsYtd) * 100);
  const color = ytd >= 0 ? '#E84040' : '#2563EB';
  const sign = ytd >= 0 ? '+' : '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <span
        style={{
          fontSize: '13px',
          color: '#0F172A',
          fontWeight: 500,
          minWidth: '64px',
          flexShrink: 0,
        }}
      >
        {name}
      </span>
      <div
        style={{
          flex: 1,
          background: '#F1F5F9',
          borderRadius: '4px',
          height: '16px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${widthPct}%`,
            height: '100%',
            background: color,
            borderRadius: '4px',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color,
          minWidth: '52px',
          textAlign: 'right',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {sign}{ytd.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── CompareContent (useSearchParams 사용) ────────────────────────────────────

function CompareContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  const symbolA = searchParams.get('a') ?? '005930';
  const symbolB = searchParams.get('b') ?? 'KRW-BTC';

  const dataA = getMockData(symbolA);
  const dataB = getMockData(symbolB);

  const typeA = getAssetType(symbolA);
  const typeB = getAssetType(symbolB);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }, [router]);

  const handleSwap = useCallback(() => {
    const params = new URLSearchParams({ a: symbolB, b: symbolA });
    router.push(`/compare?${params.toString()}`);
  }, [router, symbolA, symbolB]);

  const maxAbsYtd = Math.max(Math.abs(dataA.ytd), Math.abs(dataB.ytd));

  const rows: { label: string; valueA: string; valueB: string }[] = [
    {
      label: '현재가',
      valueA: formatKRW(dataA.price),
      valueB: formatKRW(dataB.price),
    },
    {
      label: '등락률',
      valueA: formatChangeRate(dataA.changeRate),
      valueB: formatChangeRate(dataB.changeRate),
    },
    {
      label: '거래량',
      valueA: formatVolume(dataA.volume),
      valueB: formatVolume(dataB.volume),
    },
    {
      label: '52주 최고',
      valueA: formatKRW(dataA.high52w),
      valueB: formatKRW(dataB.high52w),
    },
    {
      label: '52주 최저',
      valueA: formatKRW(dataA.low52w),
      valueB: formatKRW(dataB.low52w),
    },
  ];

  return (
    <div style={{ background: 'white', maxWidth: '430px', margin: '0 auto' }}>
      {/* ── 헤더 ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'white',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          height: '52px',
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로가기"
          style={{
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            color: '#0F172A',
          }}
        >
          &larr;
        </button>

        <span
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#0F172A',
          }}
        >
          종목 비교
        </span>

        {/* 오른쪽 패딩 균형 */}
        <div style={{ minWidth: '44px' }} />
      </header>

      {/* ── 종목 전환 버튼 ── */}
      <section style={{ padding: '16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#0F172A',
              padding: '8px 12px',
              background: 'white',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}
          >
            {dataA.name}
          </span>

          <button
            type="button"
            onClick={handleSwap}
            aria-label="두 종목 위치 전환"
            style={{
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#111827',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            🔄
          </button>

          <span
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#0F172A',
              padding: '8px 12px',
              background: 'white',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}
          >
            {dataB.name}
          </span>
        </div>
      </section>

      {/* ── 요약 카드 ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#E2E8F0' }}>
        {([
          { symbol: symbolA, data: dataA },
          { symbol: symbolB, data: dataB },
        ] as const).map(({ symbol, data }) => (
          <div
            key={symbol}
            style={{
              padding: '20px 16px',
              background: 'white',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 2px', fontWeight: 500 }}>
              {data.name}
            </p>
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 8px' }}>
              {symbol}
            </p>
            <p
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: '#0F172A',
                margin: '0 0 4px',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'Menlo, Consolas, monospace',
              }}
            >
              {formatKRW(data.price)}
            </p>
            <p
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: getPriceColor(data.changeRate),
                margin: 0,
              }}
            >
              {formatChangeRate(data.changeRate)}
              {data.changeRate > 0 ? '↑' : data.changeRate < 0 ? '↓' : ''}
            </p>
          </div>
        ))}
      </section>

      {/* ── 비교 항목 테이블 ── */}
      <section style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', margin: '0 0 12px' }}>
          비교 항목
        </h3>

        {/* 테이블 헤더 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            borderBottom: '2px solid #0F172A',
            paddingBottom: '8px',
            marginBottom: '0',
          }}
        >
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500, padding: '0 8px' }}>
            항목
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#0F172A',
              padding: '0 8px',
              borderLeft: '1px solid #E2E8F0',
            }}
          >
            {dataA.name}
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#0F172A',
              padding: '0 8px',
              borderLeft: '1px solid #E2E8F0',
            }}
          >
            {dataB.name}
          </div>
        </div>

        {/* 테이블 바디 */}
        <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {rows.map((row, idx) => (
            <CompareRow
              key={row.label}
              label={row.label}
              valueA={row.valueA}
              valueB={row.valueB}
              isEven={idx % 2 === 0}
            />
          ))}
        </div>
      </section>

      {/* ── 올해 수익률 비교 바 차트 ── */}
      <section style={{ padding: '16px', background: '#F8FAFC', margin: '0 16px', borderRadius: '12px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', margin: '0 0 16px' }}>
          올해 수익률 비교
        </h3>
        <YtdBar name={dataA.name} ytd={dataA.ytd} maxAbsYtd={maxAbsYtd} />
        <YtdBar name={dataB.name} ytd={dataB.ytd} maxAbsYtd={maxAbsYtd} />
      </section>

      {/* ── 하단 CTA ── */}
      <section style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <button
          type="button"
          onClick={() => router.push(`/${typeA}/${symbolA}`)}
          style={{
            padding: '14px 12px',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            background: 'white',
            color: '#0F172A',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          {dataA.name} 상세 보기
        </button>
        <button
          type="button"
          onClick={() => router.push(`/${typeB}/${symbolB}`)}
          style={{
            padding: '14px 12px',
            borderRadius: '12px',
            border: 'none',
            background: '#111827',
            color: 'white',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          {dataB.name} 상세 보기
        </button>
      </section>

      <BottomNavigation />
    </div>
  );
}

// ─── Page (Suspense 래핑) ─────────────────────────────────────────────────────

export default function ComparePage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <span style={{ fontSize: '14px', color: '#94A3B8' }}>불러오는 중...</span>
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
