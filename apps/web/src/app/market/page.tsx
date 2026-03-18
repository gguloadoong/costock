/**
 * 시장 페이지 — 주요 지수 / 환율 / 공포탐욕지수
 *
 * 섹션:
 *   1. 주요 지수 (KOSPI, KOSDAQ, BTC 도미넌스)
 *   2. 환율
 *   3. 공포탐욕지수 (Fear & Greed)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Toast } from '@/components/Toast';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface IndexData {
  id: string;
  name: string;
  value: number;
  change: number;
  changeRate: number;
  unit: string; // 'pt' | '%' | '원'
}

interface FxRate {
  pair: string;
  rate: number;
  change: number;
  changeRate: number;
}

// ─── 목 데이터 ─────────────────────────────────────────────────────────────────

const MOCK_INDICES: IndexData[] = [
  { id: 'kospi', name: 'KOSPI', value: 2_612.35, change: 18.42, changeRate: 0.71, unit: 'pt' },
  { id: 'kosdaq', name: 'KOSDAQ', value: 871.54, change: -3.21, changeRate: -0.37, unit: 'pt' },
];

const MOCK_BTC_DOMINANCE = 52.4;

const MOCK_FX: FxRate[] = [
  { pair: 'USD/KRW', rate: 1_325.50, change: 3.20, changeRate: 0.24 },
  { pair: 'JPY/KRW', rate: 8.87, change: -0.02, changeRate: -0.23 },
  { pair: 'EUR/KRW', rate: 1_438.20, change: -2.10, changeRate: -0.15 },
];

const MOCK_FEAR_GREED = 62;

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function getFearGreedLabel(value: number): { label: string; color: string } {
  if (value <= 24) return { label: '극공포', color: '#2563EB' };
  if (value <= 44) return { label: '공포', color: '#60A5FA' };
  if (value <= 55) return { label: '중립', color: '#6B7280' };
  if (value <= 74) return { label: '탐욕', color: '#F59E0B' };
  return { label: '극탐욕', color: '#E84040' };
}

// ─── 섹션 헤더 ────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps): React.ReactElement {
  return (
    <h2
      style={{
        fontSize: '16px',
        fontWeight: 600,
        color: '#0F172A',
        margin: 0,
        padding: '20px 16px 8px',
      }}
    >
      {title}
    </h2>
  );
}

// ─── 지수 카드 ────────────────────────────────────────────────────────────────

interface IndexCardProps {
  data: IndexData;
}

function IndexCard({ data }: IndexCardProps): React.ReactElement {
  const isRise = data.changeRate > 0;
  const isFall = data.changeRate < 0;
  const changeColor = isRise ? 'var(--kr-rise)' : isFall ? 'var(--kr-fall)' : '#6B7280';
  const changeSign = isRise ? '+' : '';

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '16px',
      }}
    >
      <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 6px', fontWeight: 500 }}>
        {data.name}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>
          {data.value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span style={{ fontSize: '14px', fontWeight: 600, color: changeColor }}>
          {changeSign}{data.changeRate.toFixed(2)}%
        </span>
      </div>
      <p style={{ fontSize: '12px', color: changeColor, margin: '2px 0 0', fontWeight: 500 }}>
        {changeSign}{data.change.toFixed(2)}{data.unit}
      </p>
    </div>
  );
}

// ─── BTC 도미넌스 카드 ────────────────────────────────────────────────────────

interface BtcDominanceCardProps {
  value: number;
}

function BtcDominanceCard({ value }: BtcDominanceCardProps): React.ReactElement {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '16px',
        margin: '0 16px 8px',
      }}
    >
      <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 6px', fontWeight: 500 }}>
        BTC 도미넌스
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>
          {value.toFixed(2)}%
        </span>
        <div
          style={{
            flex: 1,
            height: '8px',
            background: '#F1F5F9',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${value}%`,
              height: '100%',
              background: '#F59E0B',
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── 환율 행 ──────────────────────────────────────────────────────────────────

interface FxRowProps {
  fx: FxRate;
  isLast: boolean;
}

function FxRow({ fx, isLast }: FxRowProps): React.ReactElement {
  const isRise = fx.changeRate > 0;
  const isFall = fx.changeRate < 0;
  const changeColor = isRise ? 'var(--kr-rise)' : isFall ? 'var(--kr-fall)' : '#6B7280';
  const changeSign = isRise ? '+' : '';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 16px',
        borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
      }}
    >
      <span style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: '#0F172A' }}>
        {fx.pair}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
          {fx.rate.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: changeColor }}>
          {changeSign}{fx.change.toFixed(2)} ({changeSign}{fx.changeRate.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}

// ─── 공포탐욕지수 카드 ────────────────────────────────────────────────────────

interface FearGreedCardProps {
  value: number;
}

function FearGreedCard({ value }: FearGreedCardProps): React.ReactElement {
  const { label, color } = getFearGreedLabel(value);

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px 16px',
        margin: '0 16px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      {/* 숫자 */}
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '48px', fontWeight: 700, color, lineHeight: 1 }}>
          {value}
        </span>
        <p style={{ fontSize: '16px', fontWeight: 600, color, margin: '4px 0 0' }}>
          {label}
        </p>
      </div>

      {/* 게이지 바 */}
      <div style={{ width: '100%' }}>
        <div
          style={{
            position: 'relative',
            height: '12px',
            borderRadius: '6px',
            overflow: 'hidden',
            background: 'linear-gradient(to right, #2563EB 0%, #60A5FA 25%, #6B7280 45%, #F59E0B 56%, #E84040 75%)',
          }}
        >
          {/* 포인터 */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${value}%`,
              transform: 'translate(-50%, -50%)',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: 'white',
              border: `3px solid ${color}`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}
          />
        </div>

        {/* 레이블 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '6px',
          }}
        >
          <span style={{ fontSize: '10px', color: '#2563EB', fontWeight: 500 }}>극공포</span>
          <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: 500 }}>중립</span>
          <span style={{ fontSize: '10px', color: '#E84040', fontWeight: 500 }}>극탐욕</span>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
        0 = 극공포 · 100 = 극탐욕
      </p>
    </div>
  );
}

// ─── MarketPage ───────────────────────────────────────────────────────────────

export default function MarketPage(): React.ReactElement {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const res = await fetch('/api/v1/market/indices');
        if (res.ok) {
          const data = (await res.json()) as IndexData[];
          setIndices(data);
        } else {
          setIndices(MOCK_INDICES);
        }
      } catch {
        setIndices(MOCK_INDICES);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchIndices();
  }, []);

  const displayIndices = isLoading ? MOCK_INDICES : indices;

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
            padding: '16px 16px 12px',
          }}
        >
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            시장
          </h1>
        </header>

        {/* 주요 지수 */}
        <section aria-label="주요 지수">
          <SectionHeader title="📈 주요 지수" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              margin: '0 16px 8px',
            }}
          >
            {displayIndices.map((idx) => (
              <IndexCard key={idx.id} data={idx} />
            ))}
          </div>
          <BtcDominanceCard value={MOCK_BTC_DOMINANCE} />
        </section>

        {/* 환율 */}
        <section aria-label="환율">
          <SectionHeader title="💱 환율" />
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              margin: '0 16px 8px',
              overflow: 'hidden',
            }}
          >
            {MOCK_FX.map((fx, idx) => (
              <FxRow key={fx.pair} fx={fx} isLast={idx === MOCK_FX.length - 1} />
            ))}
          </div>
        </section>

        {/* 공포탐욕지수 */}
        <section aria-label="공포탐욕지수">
          <SectionHeader title="😨 공포탐욕지수" />
          <FearGreedCard value={MOCK_FEAR_GREED} />
        </section>
      </div>

      <BottomNavigation />
      <Toast />
    </>
  );
}
