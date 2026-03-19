'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   TradeEventCard — AI 트레이더 거래 이벤트 카드
   - 매수: 왼쪽 빨간 보더 (#E84040)
   - 매도: 왼쪽 파란 보더 (#2563EB) + 수익/손실 표시
   - 새 이벤트 진입 slide-in 애니메이션 (.trade-feed-item)

   레이아웃:
   ┌─────────────────────────────────┐
   │ [매수] 삼성전자(005930)          │
   │ 78,400원 × 10주 = 784,000원     │
   │ 알파 • 15분 전                  │
   └─────────────────────────────────┘
───────────────────────────────────────────────────────────────────────────── */

import TraderAvatar, { TraderId, TRADERS } from './TraderAvatar';
import ReturnBadge from './ReturnBadge';

export type TradeAction = 'buy' | 'sell';

export interface TradeEvent {
  id: string;
  action: TradeAction;
  /** 종목명 */
  assetName: string;
  /** 종목 코드 또는 심볼 (예: 005930, BTC) */
  assetCode: string;
  /** 체결 단가 (원 또는 USD) */
  price: number;
  /** 수량 */
  quantity: number;
  /** 통화 단위 표시 문자열 (기본: '원') */
  currency?: string;
  /** 트레이더 ID */
  traderId: TraderId;
  /** 거래 발생 시각 */
  timestamp: Date;
  /** 매도 시 수익률 (%) — 양수=수익, 음수=손실 */
  returnRate?: number;
  /** 매도 시 손익 절대금액 */
  returnAmount?: number;
}

interface TradeEventCardProps {
  event: TradeEvent;
  /** slide-in 애니메이션 적용 여부 (피드 최상단 신규 항목에만 true) */
  isNew?: boolean;
}

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}초 전`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return `${Math.floor(diffHr / 24)}일 전`;
}

const ACTION_COLOR: Record<TradeAction, string> = {
  buy: '#E84040',
  sell: '#2563EB',
};

const ACTION_LABEL: Record<TradeAction, string> = {
  buy: '매수',
  sell: '매도',
};

export default function TradeEventCard({ event, isNew = false }: TradeEventCardProps) {
  const {
    action,
    assetName,
    assetCode,
    price,
    quantity,
    currency = '원',
    traderId,
    timestamp,
    returnRate,
    returnAmount,
  } = event;

  const trader = TRADERS[traderId];
  const borderColor = ACTION_COLOR[action];
  const totalAmount = price * quantity;
  const isSell = action === 'sell';

  return (
    <article
      className={isNew ? 'trade-feed-item' : undefined}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 14px',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderLeft: `3px solid ${borderColor}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}
    >
      {/* 트레이더 아바타 */}
      <TraderAvatar trader={traderId} size="sm" />

      {/* 내용 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 상단 행: 뱃지 + 종목명 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
          }}
        >
          <span className={action === 'buy' ? 'badge-buy' : 'badge-sell'}>
            {ACTION_LABEL[action]}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#0F172A',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {assetName}
            <span
              style={{
                marginLeft: 4,
                fontSize: 12,
                fontWeight: 400,
                color: '#6B7280',
              }}
            >
              ({assetCode})
            </span>
          </span>
        </div>

        {/* 중간 행: 가격 × 수량 = 총액 */}
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: '#374151',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
          }}
        >
          <span style={{ fontFamily: "'Roboto Mono', monospace" }}>
            {formatNumber(price)}
          </span>
          {currency} × {formatNumber(quantity)}주 ={' '}
          <span
            style={{
              fontWeight: 700,
              fontFamily: "'Roboto Mono', monospace",
            }}
          >
            {formatNumber(totalAmount)}
          </span>
          {currency}
        </p>

        {/* 매도 시 수익/손실 표시 */}
        {isSell && (returnRate !== undefined || returnAmount !== undefined) && (
          <div style={{ marginTop: 6 }}>
            <ReturnBadge
              returnRate={returnRate}
              returnAmount={returnAmount}
              currency={currency}
              size="sm"
            />
          </div>
        )}

        {/* 하단 행: 트레이더 이름 + 시간 */}
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 11,
            color: '#9CA3AF',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ color: trader.color, fontWeight: 600 }}>
            {trader.name}
          </span>
          <span>•</span>
          <span>{formatRelativeTime(timestamp)}</span>
        </p>
      </div>
    </article>
  );
}
