'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  API_BASE,
  type Trader,
  type TradeRecord,
  type Position,
  type PnlMonth,
  type TraderWsEvent,
  type TradeType,
  type TradeAsset,
  type RawPosition,
  type RawTradeRecord,
  type RawPnlMonth,
  mapPosition,
  mapTradeRecord,
  mapPnlMonth,
} from '@/lib/api';
import { subscribeToPush, unsubscribeFromPush, getStoredSubscription } from '@/lib/pushNotification';

// ─── 유틸: 트레이더 색상 ──────────────────────────────────────────────────────

function traderColor(strategy: Trader['strategy']): string {
  if (strategy === 'etf_kr' || strategy === 'etf_allocation') return '#EC4899';
  if (strategy === 'crossasset_arb' || strategy === 'mixed') return '#8B5CF6';
  if (strategy === 'momentum_kr') return '#6366F1';
  if (strategy === 'contrarian_crypto') return '#F59E0B';
  if (strategy === 'quant_us') return '#10B981';
  return '#6366F1';
}

// ─── 유틸 함수 ────────────────────────────────────────────────────────────────

function formatReturn(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function returnColor(value: number): string {
  if (value > 0) return '#E84040';
  if (value < 0) return '#2563EB';
  return '#6B7280';
}

function formatPrice(price: number, asset: TradeAsset): string {
  if (asset === 'us_stock') {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  return price.toLocaleString('ko-KR') + '원';
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}${pnl.toLocaleString('ko-KR')}원`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function assetLabel(asset: TradeAsset): string {
  if (asset === 'stock') return '국내';
  if (asset === 'coin') return '코인';
  return '미국';
}

// ─── PnL 스파크라인 ───────────────────────────────────────────────────────────

interface SparklineProps {
  /** 월별 realizedPnl 원시값 배열 (시간순) */
  data: number[];
  positive: boolean;
}

function PnlSparkline({ data, positive }: SparklineProps): React.ReactElement {
  // 누적합 계산
  const cumulative: number[] = [];
  let acc = 0;
  for (const v of data) {
    acc += v;
    cumulative.push(acc);
  }

  const W = 80;
  const H = 32;
  const PAD = 2; // 선이 경계에 닿지 않도록 내부 여백

  if (cumulative.length < 2) {
    // 데이터 부족: 수평선
    return (
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden="true"
        style={{ display: 'block' }}
      >
        <line
          x1={PAD}
          y1={H / 2}
          x2={W - PAD}
          y2={H / 2}
          stroke="#6B7280"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const min = Math.min(...cumulative);
  const max = Math.max(...cumulative);
  const range = max - min || 1;

  const toX = (i: number) => PAD + (i / (cumulative.length - 1)) * (W - PAD * 2);
  const toY = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2);

  const points = cumulative
    .map((v, i) => `${toX(i).toFixed(2)},${toY(v).toFixed(2)}`)
    .join(' ');

  const lineColor = positive ? '#E84040' : '#2563EB';

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <polyline
        points={points}
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ─── 탭 타입 ──────────────────────────────────────────────────────────────────

type TabId = 'feed' | 'positions' | 'realized';

// ─── 로딩 스피너 ──────────────────────────────────────────────────────────────

function LoadingSpinner(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 0',
      }}
    >
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: '2px solid #E2E8F0',
          borderTopColor: '#6366F1',
          animation: 'spin 0.7s linear infinite',
        }}
      />
    </div>
  );
}

// ─── 에러 박스 ────────────────────────────────────────────────────────────────

function ErrorBox({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div
      style={{
        margin: '16px',
        padding: '20px 16px',
        borderRadius: '12px',
        background: 'white',
        border: '1px solid #F1F5F9',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '12px' }}>
        데이터를 불러올 수 없습니다
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: '7px 14px',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          background: 'white',
          fontSize: '12px',
          fontWeight: 600,
          color: '#374151',
          cursor: 'pointer',
        }}
      >
        다시 시도
      </button>
    </div>
  );
}

// ─── 수익률 히어로 ────────────────────────────────────────────────────────────

interface ReturnHeroProps {
  trader: Trader;
}

function ReturnHero({ trader }: ReturnHeroProps): React.ReactElement {
  const totalReturnPct = trader.stats.totalReturn * 100;
  const winRatePct = trader.stats.winRate * 100;

  return (
    <div
      style={{
        padding: '20px 16px 16px',
        background: 'white',
        borderBottom: '1px solid #F1F5F9',
      }}
    >
      {/* 누적 수익률 — 크게 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px', fontWeight: 500 }}>
          누적 수익률
        </div>
        <div
          style={{
            fontSize: '40px',
            fontWeight: 800,
            color: returnColor(totalReturnPct),
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          {formatReturn(totalReturnPct)}
        </div>
      </div>

      {/* 승률 / 최대 낙폭 / 샤프 */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          background: '#F8FAFC',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {[
          { label: '승률', value: `${winRatePct.toFixed(1)}%`, color: '#0F172A' },
          {
            label: '최대 낙폭',
            value: formatReturn(trader.stats.maxDrawdown * 100),
            color: returnColor(trader.stats.maxDrawdown * 100),
          },
          {
            label: '샤프',
            value: trader.stats.sharpeRatio.toFixed(2),
            color: '#0F172A',
          },
        ].map((item, i) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              padding: '10px 8px',
              textAlign: 'center',
              borderLeft: i > 0 ? '1px solid #E2E8F0' : 'none',
            }}
          >
            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '3px' }}>
              {item.label}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: item.color }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 탭 바 ────────────────────────────────────────────────────────────────────

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  traderColor: string;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'feed', label: '활동피드' },
  { id: 'positions', label: '보유포지션' },
  { id: 'realized', label: '실현손익' },
];

function TabBar({ active, onChange, traderColor: color }: TabBarProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        background: 'white',
        borderBottom: '1px solid #E2E8F0',
        position: 'sticky',
        top: '57px',
        zIndex: 20,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
              background: 'transparent',
              fontSize: '13px',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? color : '#9CA3AF',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── 활동피드 ─────────────────────────────────────────────────────────────────

function TradeBadge({ type }: { type: TradeType }): React.ReactElement {
  const isBuy = type === 'buy';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: isBuy ? '#FEF2F2' : '#EFF6FF',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: isBuy ? '#E84040' : '#2563EB',
        }}
      >
        {isBuy ? '매수' : '매도'}
      </span>
    </div>
  );
}

function TradeFeedItem({
  trade,
  isNew,
}: {
  trade: TradeRecord;
  isNew?: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        background: isNew ? '#FAFEFF' : 'white',
        borderBottom: '1px solid #F1F5F9',
        animation: isNew ? 'feedSlideIn 0.3s ease' : undefined,
      }}
    >
      <TradeBadge type={trade.type} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '3px',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
            {trade.name}
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '4px',
              background: '#F1F5F9',
              color: '#64748B',
              fontWeight: 500,
            }}
          >
            {assetLabel(trade.asset)}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: '#64748B' }}>
          {formatPrice(trade.price, trade.asset)} × {trade.quantity}
        </div>
        {/* 매매 이유 강조 박스 */}
        {trade.reason && (
          <div
            style={{
              marginTop: '6px',
              borderLeft: '3px solid #3B82F6',
              background: '#EFF6FF',
              padding: '6px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#1D4ED8',
              lineHeight: 1.5,
            }}
          >
            {trade.reason}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {trade.pnl !== undefined && (
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: returnColor(trade.pnl),
              marginBottom: '2px',
            }}
          >
            {formatPnl(trade.pnl)}
          </div>
        )}
        <div style={{ fontSize: '11px', color: '#94A3B8' }}>{timeAgo(trade.timestamp)}</div>
      </div>
    </div>
  );
}

interface ActivityFeedProps {
  trades: TradeRecord[];
  traderColor: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  newIds: Set<string>;
}

function ActivityFeed({
  trades,
  traderColor: color,
  loading,
  error,
  onRetry,
  newIds,
}: ActivityFeedProps): React.ReactElement {
  return (
    <div>
      {/* 실시간 헤더 */}
      <div
        style={{
          padding: '10px 16px',
          background: '#F8FAFC',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: color,
            animation: 'pulse 2s infinite',
          }}
        />
        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
          실시간 매매 스트림
        </span>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorBox onRetry={onRetry} />
      ) : (
        <>
          {trades.map((trade) => (
            <TradeFeedItem key={trade.id} trade={trade} isNew={newIds.has(trade.id)} />
          ))}
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: '#94A3B8',
              fontSize: '13px',
            }}
          >
            최근 50건 매매 내역 표시 중
          </div>
        </>
      )}
    </div>
  );
}

// ─── 보유포지션 ───────────────────────────────────────────────────────────────

function PositionItem({ position }: { position: Position }): React.ReactElement {
  const pnlAmount = (position.currentPrice - position.buyPrice) * position.quantity;
  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'white',
        borderBottom: '1px solid #F1F5F9',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
            {position.name}
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '4px',
              background: '#F1F5F9',
              color: '#64748B',
              fontWeight: 500,
            }}
          >
            {assetLabel(position.asset)}
          </span>
        </div>
        <span
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: returnColor(position.returnRate),
          }}
        >
          {formatReturn(position.returnRate)}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#64748B',
        }}
      >
        <span>매수가 {formatPrice(position.buyPrice, position.asset)}</span>
        <span>현재가 {formatPrice(position.currentPrice, position.asset)}</span>
        <span style={{ color: returnColor(pnlAmount), fontWeight: 600 }}>
          {formatPnl(Math.round(pnlAmount))}
        </span>
      </div>
    </div>
  );
}

interface PositionsTabProps {
  positions: Position[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

function PositionsTab({
  positions,
  loading,
  error,
  onRetry,
}: PositionsTabProps): React.ReactElement {
  const totalPnl = positions.reduce(
    (acc, p) => acc + (p.currentPrice - p.buyPrice) * p.quantity,
    0
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBox onRetry={onRetry} />;

  return (
    <div>
      <div
        style={{
          padding: '14px 16px',
          background: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '13px', color: '#64748B' }}>{positions.length}개 보유</span>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: returnColor(totalPnl),
          }}
        >
          평가손익 {formatPnl(Math.round(totalPnl))}
        </span>
      </div>

      {positions.map((p) => (
        <PositionItem key={p.id} position={p} />
      ))}
    </div>
  );
}

// ─── 실현손익 ─────────────────────────────────────────────────────────────────

function RealizedMonthItem({ month }: { month: PnlMonth }): React.ReactElement {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ background: 'white', marginBottom: '1px' }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          borderBottom: expanded ? '1px solid #F1F5F9' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
            {month.label}
          </span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: returnColor(month.totalPnl),
            }}
          >
            {formatPnl(month.totalPnl)}
          </span>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
            승률 {(month.winRate * 100).toFixed(0)}%
          </span>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
            {month.tradeCount}건
          </span>
        </div>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div>
          {month.entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 16px 11px 24px',
                borderBottom: '1px solid #F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>{entry.date}</span>
                <span style={{ fontSize: '13px', color: '#374151' }}>{entry.name} 매도</span>
              </div>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: returnColor(entry.pnl),
                }}
              >
                {formatPnl(entry.pnl)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface RealizedTabProps {
  months: PnlMonth[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

function RealizedTab({ months, loading, error, onRetry }: RealizedTabProps): React.ReactElement {
  const totalPnl = months.reduce((acc, m) => acc + m.totalPnl, 0);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBox onRetry={onRetry} />;

  if (months.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 24px',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '32px' }}>📭</div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
          아직 실현된 손익이 없습니다
        </div>
        <div style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
          매도 거래가 발생하면 여기에 표시됩니다
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          padding: '14px 16px',
          background: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '13px', color: '#64748B' }}>총 실현손익</span>
        <span style={{ fontSize: '15px', fontWeight: 700, color: returnColor(totalPnl) }}>
          {formatPnl(totalPnl)}
        </span>
      </div>

      {months.map((month) => (
        <RealizedMonthItem key={month.label} month={month} />
      ))}
    </div>
  );
}

// ─── 트레이더 상세 페이지 ─────────────────────────────────────────────────────

export default function TraderDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const traderId = typeof params.id === 'string' ? params.id : '';

  // ── 트레이더 기본 정보
  const [trader, setTrader] = useState<Trader | null>(null);
  const [traderLoading, setTraderLoading] = useState(true);
  const [traderError, setTraderError] = useState(false);

  // ── 탭 데이터
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesError, setTradesError] = useState(false);

  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState(false);

  const [pnlMonths, setPnlMonths] = useState<PnlMonth[]>([]);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [pnlError, setPnlError] = useState(false);

  // ── WebSocket 실시간
  const [newTradeIds, setNewTradeIds] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);

  // ── 스파크라인 데이터 (월별 realizedPnl)
  const [sparkData, setSparkData] = useState<number[]>([]);

  // ── 기타 상태
  const [activeTab, setActiveTab] = useState<TabId>('feed');
  const [subscribed, setSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);

  // ── 알림 권한 + 구독 상태 초기화 (CSR only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 알림 권한 상태
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    // 구독 상태 (pushNotification 유틸 사용)
    setSubscribed(getStoredSubscription(traderId));
  }, [traderId]);

  // ── 트레이더 기본 정보 로드
  const loadTrader = useCallback(() => {
    if (!traderId) return;
    setTraderLoading(true);
    setTraderError(false);
    fetch(`${API_BASE}/api/v1/traders/${traderId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data: Trader }>;
      })
      .then((body) => {
        setTrader(body.data);
        setTraderLoading(false);
      })
      .catch(() => {
        setTraderError(true);
        setTraderLoading(false);
      });
  }, [traderId]);

  useEffect(() => {
    loadTrader();
  }, [loadTrader]);

  // ── 스파크라인용 PnL 데이터 로드 (트레이더 로드와 병렬)
  useEffect(() => {
    if (!traderId) return;
    fetch(`${API_BASE}/api/v1/traders/${traderId}/pnl?year=2026`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data: RawPnlMonth[] }>;
      })
      .then((body) => {
        setSparkData(body.data.map((m) => m.realizedPnl));
      })
      .catch(() => {
        // 실패 시 스파크라인 미표시 (빈 배열 유지)
      });
  }, [traderId]);

  // ── 활동피드 (매매 히스토리) 로드
  const loadTrades = useCallback(() => {
    if (!traderId) return;
    setTradesLoading(true);
    setTradesError(false);
    fetch(`${API_BASE}/api/v1/traders/${traderId}/trades?limit=50`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data: RawTradeRecord[] }>;
      })
      .then((body) => {
        setTrades(body.data.map(mapTradeRecord));
        setTradesLoading(false);
      })
      .catch(() => {
        setTradesError(true);
        setTradesLoading(false);
      });
  }, [traderId]);

  // ── 포지션 로드
  const loadPositions = useCallback(() => {
    if (!traderId) return;
    setPositionsLoading(true);
    setPositionsError(false);
    fetch(`${API_BASE}/api/v1/traders/${traderId}/positions`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data: RawPosition[] }>;
      })
      .then((body) => {
        setPositions(body.data.map(mapPosition));
        setPositionsLoading(false);
      })
      .catch(() => {
        setPositionsError(true);
        setPositionsLoading(false);
      });
  }, [traderId]);

  // ── 실현손익 로드
  const loadPnl = useCallback(() => {
    if (!traderId) return;
    setPnlLoading(true);
    setPnlError(false);
    fetch(`${API_BASE}/api/v1/traders/${traderId}/pnl?year=2026`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data: RawPnlMonth[] }>;
      })
      .then((body) => {
        setPnlMonths(body.data.map(mapPnlMonth));
        setPnlLoading(false);
      })
      .catch(() => {
        setPnlError(true);
        setPnlLoading(false);
      });
  }, [traderId]);

  // ── 탭 전환 시 데이터 지연 로드
  useEffect(() => {
    if (activeTab === 'feed') loadTrades();
    else if (activeTab === 'positions') loadPositions();
    else if (activeTab === 'realized') loadPnl();
  }, [activeTab, loadTrades, loadPositions, loadPnl]);

  // ── WebSocket 실시간 매매 이벤트
  useEffect(() => {
    if (!traderId) return;

    const wsUrl = (API_BASE.replace(/^http/, 'ws')) + '/ws/traders';

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as TraderWsEvent;
          if (msg.type === 'trade_event' && msg.traderId === traderId) {
            const incoming = msg.trade;
            setTrades((prev) => [incoming, ...prev]);
            setNewTradeIds((prev) => new Set([...prev, incoming.id]));
            // 3초 후 하이라이트 제거
            setTimeout(() => {
              setNewTradeIds((prev) => {
                const next = new Set(prev);
                next.delete(incoming.id);
                return next;
              });
            }, 3000);
          }
        } catch {
          // 파싱 실패 무시
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        // 5초 후 재연결 시도
        setTimeout(() => {
          if (wsRef.current === ws) {
            connect();
          }
        }, 5000);
      };
    };

    connect();

    return () => {
      const ws = wsRef.current;
      if (ws) {
        wsRef.current = null;
        ws.close();
      }
    };
  }, [traderId]);

  const handleToggleSubscribe = useCallback(async () => {
    if (subLoading) return;

    if (subscribed) {
      // 구독 해제
      setSubLoading(true);
      await unsubscribeFromPush(traderId);
      setSubscribed(false);
      setSubLoading(false);
      setSubError(false);
      return;
    }

    // 구독 시도
    setSubLoading(true);
    setSubError(false);
    const success = await subscribeToPush(traderId);
    if (success) {
      setSubscribed(true);
      // 권한 상태 갱신
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotifPermission(Notification.permission);
      }
    } else {
      setSubError(true);
      // 권한 상태 갱신 (denied 반영)
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotifPermission(Notification.permission);
      }
    }
    setSubLoading(false);
  }, [subLoading, subscribed, traderId]);

  // ── 로딩 중 (트레이더 기본 정보)
  if (traderLoading) {
    return (
      <>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '2px solid #E2E8F0',
              borderTopColor: '#6366F1',
              animation: 'spin 0.7s linear infinite',
            }}
          />
        </div>
      </>
    );
  }

  // ── 에러 또는 404
  if (traderError || !trader) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '16px',
          padding: '24px',
        }}
      >
        <div style={{ fontSize: '40px' }}>404</div>
        <div style={{ fontSize: '16px', color: '#64748B' }}>
          {traderError ? '데이터를 불러올 수 없습니다' : '트레이더를 찾을 수 없습니다'}
        </div>
        <button
          onClick={() => router.push('/')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            background: '#0F172A',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  const color = traderColor(trader.strategy);

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes feedSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

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
          gap: '12px',
          padding: '12px 16px',
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            fontSize: '16px',
            color: '#374151',
          }}
          aria-label="뒤로가기"
        >
          ‹
        </button>

        {/* 아바타 + 이름 + 전략 설명 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
              {trader.nameKr.charAt(0)}
            </span>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}
            >
              AI {trader.nameKr}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#94A3B8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {trader.strategyDesc || trader.strategy}
            </div>
          </div>
        </div>

        {/* 스파크라인 */}
        {sparkData.length >= 2 && (
          <div style={{ flexShrink: 0 }}>
            <PnlSparkline
              data={sparkData}
              positive={sparkData.reduce((a, b) => a + b, 0) >= 0}
            />
          </div>
        )}

        {/* 총 매매 수 */}
        <div style={{ fontSize: '12px', color: '#64748B', flexShrink: 0 }}>
          {trader.stats.totalTrades}회 매매
        </div>
      </header>

      {/* ── 수익률 히어로 ── */}
      <ReturnHero trader={trader} />

      {/* ── 탭 바 ── */}
      <TabBar active={activeTab} onChange={setActiveTab} traderColor={color} />

      {/* ── 탭 콘텐츠 ── */}
      <div style={{ minHeight: '50vh' }}>
        {activeTab === 'feed' && (
          <ActivityFeed
            trades={trades}
            traderColor={color}
            loading={tradesLoading}
            error={tradesError}
            onRetry={loadTrades}
            newIds={newTradeIds}
          />
        )}
        {activeTab === 'positions' && (
          <PositionsTab
            positions={positions}
            loading={positionsLoading}
            error={positionsError}
            onRetry={loadPositions}
          />
        )}
        {activeTab === 'realized' && (
          <RealizedTab
            months={pnlMonths}
            loading={pnlLoading}
            error={pnlError}
            onRetry={loadPnl}
          />
        )}
      </div>

      {/* ── 하단 고정: 알림 구독 버튼 ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '430px',
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
          background: 'white',
          borderTop: '1px solid #E2E8F0',
          zIndex: 40,
        }}
      >
        {/* 알림 권한 상태 안내 */}
        {notifPermission === 'denied' && (
          <div
            style={{
              fontSize: '12px',
              color: '#B45309',
              textAlign: 'center',
              marginBottom: '8px',
              padding: '6px 10px',
              background: '#FFFBEB',
              borderRadius: '8px',
              border: '1px solid #FDE68A',
            }}
          >
            브라우저 알림이 차단됨 — 설정에서 허용 후 다시 시도하세요
          </div>
        )}
        {notifPermission === 'default' && !subscribed && (
          <div
            style={{
              fontSize: '12px',
              color: '#64748B',
              textAlign: 'center',
              marginBottom: '8px',
            }}
          >
            알림을 허용하면 매매 즉시 받을 수 있어요
          </div>
        )}
        {subError && notifPermission !== 'denied' && (
          <div
            style={{
              fontSize: '12px',
              color: '#DC2626',
              textAlign: 'center',
              marginBottom: '8px',
            }}
          >
            구독에 실패했습니다. 다시 시도해 주세요.
          </div>
        )}

        <button
          onClick={handleToggleSubscribe}
          disabled={subLoading || notifPermission === 'denied'}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '14px',
            border: subscribed ? '2px solid #E2E8F0' : 'none',
            background: subLoading
              ? '#E2E8F0'
              : subscribed
                ? '#0F172A'
                : notifPermission === 'denied'
                  ? '#E2E8F0'
                  : color,
            color: subLoading
              ? '#94A3B8'
              : subscribed
                ? 'white'
                : notifPermission === 'denied'
                  ? '#9CA3AF'
                  : 'white',
            fontSize: '15px',
            fontWeight: 700,
            cursor: subLoading || notifPermission === 'denied' ? 'not-allowed' : 'pointer',
            opacity: subLoading ? 0.7 : 1,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          {subLoading ? (
            <span>처리 중...</span>
          ) : subscribed ? (
            <span>🔔 알림 ON — 탭하여 해제</span>
          ) : notifPermission === 'denied' ? (
            <span>알림 권한이 필요합니다</span>
          ) : (
            <span>🔕 알림 OFF — 구독하기</span>
          )}
        </button>
      </div>
    </>
  );
}
