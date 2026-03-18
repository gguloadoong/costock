/**
 * 시장 페이지 — 주요 지수 / 환율 / 공포탐욕지수 / 섹터별 수익률
 *
 * 섹션:
 *   1. 시장 Breadth (상승/하락/보합 종목 수)
 *   2. 주요 지수 (KOSPI, KOSDAQ, BTC 도미넌스)
 *   3. 환율
 *   4. 공포탐욕지수 (Fear & Greed) — 선형 프로그레스 바
 *   5. 섹터별 수익률
 */

'use client';

import React, { useState, useEffect } from 'react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Toast } from '@/components/Toast';
import { NewsFeed } from '@/components/NewsFeed';

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

interface SectorData {
  sector: string;
  change: number;
  topStock: string;
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

const MOCK_FEAR_GREED = 65;

const MOCK_MARKET_BREADTH = { rise: 423, fall: 287, flat: 63 };

const SECTOR_DATA: SectorData[] = [
  { sector: '반도체', change: 2.34, topStock: '삼성전자' },
  { sector: '배터리', change: -1.23, topStock: 'LG에너지솔루션' },
  { sector: '바이오', change: 0.87, topStock: '삼성바이오' },
  { sector: '인터넷', change: -0.45, topStock: '카카오' },
  { sector: '자동차', change: 1.56, topStock: '현대차' },
  { sector: '금융', change: 0.23, topStock: 'KB금융' },
];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function getFearGreedInfo(value: number): { label: string; color: string; segmentLabel: string } {
  if (value <= 25) return { label: '극단적 공포', segmentLabel: '극단적 공포', color: '#2563EB' };
  if (value <= 45) return { label: '공포', segmentLabel: '공포', color: '#60A5FA' };
  if (value <= 55) return { label: '중립', segmentLabel: '중립', color: '#6B7280' };
  if (value <= 75) return { label: '탐욕', segmentLabel: '탐욕', color: '#F59E0B' };
  return { label: '극단적 탐욕', segmentLabel: '극단적 탐욕', color: '#E84040' };
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

// ─── 시장 Breadth ─────────────────────────────────────────────────────────────

interface MarketBreadthProps {
  rise: number;
  fall: number;
  flat: number;
}

function MarketBreadth({ rise, fall, flat }: MarketBreadthProps): React.ReactElement {
  return (
    <div
      style={{
        background: 'white',
        margin: '0 16px 8px',
        borderRadius: '16px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '16px' }}>📈</span>
        <div>
          <p style={{ fontSize: '10px', color: '#64748B', margin: 0, fontWeight: 500 }}>상승</p>
          <p
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#E84040',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {rise.toLocaleString('ko-KR')}
          </p>
        </div>
      </div>

      <div style={{ width: '1px', height: '32px', background: '#E2E8F0' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '16px' }}>📉</span>
        <div>
          <p style={{ fontSize: '10px', color: '#64748B', margin: 0, fontWeight: 500 }}>하락</p>
          <p
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#2563EB',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {fall.toLocaleString('ko-KR')}
          </p>
        </div>
      </div>

      <div style={{ width: '1px', height: '32px', background: '#E2E8F0' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '16px' }}>➡️</span>
        <div>
          <p style={{ fontSize: '10px', color: '#64748B', margin: 0, fontWeight: 500 }}>보합</p>
          <p
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#6B7280',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {flat.toLocaleString('ko-KR')}
          </p>
        </div>
      </div>
    </div>
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

// ─── 공포탐욕지수 카드 (선형 프로그레스 바) ──────────────────────────────────

interface FearGreedCardProps {
  value: number;
}

function FearGreedCard({ value }: FearGreedCardProps): React.ReactElement {
  const { label, color } = getFearGreedInfo(value);

  const segments = [
    { label: '극단적 공포', color: '#2563EB', start: 0, end: 25 },
    { label: '공포', color: '#60A5FA', start: 25, end: 45 },
    { label: '중립', color: '#6B7280', start: 45, end: 55 },
    { label: '탐욕', color: '#F59E0B', start: 55, end: 75 },
    { label: '극단적 탐욕', color: '#E84040', start: 75, end: 100 },
  ];

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '20px 16px',
        margin: '0 16px 8px',
      }}
    >
      {/* 수치 + 레이블 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '36px', fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color }}>{label}</span>
        </div>
        <span style={{ fontSize: '11px', color: '#94A3B8' }}>0 = 극공포 · 100 = 극탐욕</span>
      </div>

      {/* 프로그레스 바 */}
      <div style={{ position: 'relative' }}>
        {/* 세그먼트 트랙 */}
        <div
          style={{
            display: 'flex',
            height: '10px',
            borderRadius: '5px',
            overflow: 'hidden',
            gap: '2px',
          }}
        >
          {segments.map((seg) => (
            <div
              key={seg.label}
              style={{
                flex: seg.end - seg.start,
                background: seg.color,
                opacity: value >= seg.start && value < seg.end ? 1 : 0.3,
                transition: 'opacity 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* 포인터 */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${value}%`,
            transform: 'translate(-50%, -50%)',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: 'white',
            border: `3px solid ${color}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }}
        />
      </div>

      {/* 레이블 행 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
        }}
      >
        {segments.map((seg) => (
          <span
            key={seg.label}
            style={{
              fontSize: '9px',
              color: seg.color,
              fontWeight: value >= seg.start && value < seg.end ? 700 : 400,
              opacity: value >= seg.start && value < seg.end ? 1 : 0.5,
              textAlign: 'center',
              flex: seg.end - seg.start,
            }}
          >
            {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── 섹터별 수익률 ────────────────────────────────────────────────────────────

interface SectorRowProps {
  data: SectorData;
  isLast: boolean;
}

function SectorRow({ data, isLast }: SectorRowProps): React.ReactElement {
  const isRise = data.change > 0;
  const isFall = data.change < 0;
  const changeColor = isRise ? '#E84040' : isFall ? '#2563EB' : '#6B7280';
  const changeSign = isRise ? '+' : '';

  // 수평 막대 그래프: max ±5% 기준, 0% 중앙
  const MAX_PCT = 5;
  const clampedChange = Math.max(-MAX_PCT, Math.min(MAX_PCT, data.change));
  const barWidthPct = (Math.abs(clampedChange) / MAX_PCT) * 50; // 50% = 절반
  const isPositive = clampedChange >= 0;

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
      }}
    >
      {/* 섹터명 + 수익률 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px',
        }}
      >
        <div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
            {data.sector}
          </span>
          <span style={{ fontSize: '12px', color: '#94A3B8', marginLeft: '6px' }}>
            {data.topStock}
          </span>
        </div>
        <span style={{ fontSize: '14px', fontWeight: 700, color: changeColor }}>
          {changeSign}{data.change.toFixed(2)}%
        </span>
      </div>

      {/* 수평 막대 그래프 */}
      <div
        style={{
          position: 'relative',
          height: '6px',
          borderRadius: '3px',
          background: '#F1F5F9',
          overflow: 'hidden',
        }}
      >
        {/* 중앙 기준선 */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            width: '1px',
            height: '100%',
            background: '#CBD5E1',
          }}
        />
        {/* 막대 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            height: '100%',
            background: changeColor,
            borderRadius: '3px',
            ...(isPositive
              ? { left: '50%', width: `${barWidthPct}%` }
              : { right: '50%', width: `${barWidthPct}%` }),
          }}
        />
      </div>
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

        {/* 시장 Breadth */}
        <section aria-label="시장 현황">
          <SectionHeader title="시장 현황" />
          <MarketBreadth
            rise={MOCK_MARKET_BREADTH.rise}
            fall={MOCK_MARKET_BREADTH.fall}
            flat={MOCK_MARKET_BREADTH.flat}
          />
        </section>

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

        {/* 섹터별 수익률 */}
        <section aria-label="섹터별 수익률">
          <SectionHeader title="📊 섹터별 수익률" />
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              margin: '0 16px 8px',
              overflow: 'hidden',
            }}
          >
            {SECTOR_DATA.map((item, idx) => (
              <SectorRow
                key={item.sector}
                data={item}
                isLast={idx === SECTOR_DATA.length - 1}
              />
            ))}
          </div>
        </section>

        {/* 시장 뉴스 */}
        <section className="py-4">
          <h2 className="text-sm font-semibold text-gray-500 px-4 mb-0">시장 뉴스</h2>
          <NewsFeed limit={6} />
        </section>
      </div>

      <BottomNavigation />
      <Toast />
    </>
  );
}
