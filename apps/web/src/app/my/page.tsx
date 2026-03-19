/**
 * MY 페이지 — 관심종목 관리 / 공유 / 앱 정보
 *
 * 섹션:
 *   1. 관심종목 목록 관리
 *   2. 관심목록 공유 URL
 *   3. 앱 정보
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Toast, showToast } from '@/components/Toast';
import { getWatchlist, removeFromWatchlist } from '@/lib/watchlistStorage';
import type { WatchlistItem } from '@/lib/watchlistStorage';
import { buildShareUrl } from '@/lib/shareUrl';
import { usePriceStream } from '@/hooks/usePriceStream';
import type { PriceData } from '@/types/market';
import { formatPriceSafe } from '@/design-system/utils/formatPrice';
import { formatRate } from '@/design-system/utils/formatRate';
import { getAlerts, removeAlert, checkAlerts, markAlertTriggered } from '@/lib/alertStorage';
import type { PriceAlert } from '@/lib/alertStorage';
import { formatKRW } from '@/lib/formatters';
import { useNotification } from '@/lib/useNotification';
import { getHoldings, removeHolding, calcPnL } from '@/lib/holdingStorage';
import type { Holding } from '@/lib/holdingStorage';
import { AllocationChart } from '@/components/AllocationChart';

// ─── 관심종목 현황 요약 카드 ──────────────────────────────────────────────────

interface WatchlistSummaryProps {
  liveData: Map<string, PriceData>;
  items: WatchlistItem[];
}

function WatchlistSummaryCard({ liveData, items }: WatchlistSummaryProps): React.ReactElement | null {
  if (items.length === 0) return null;

  let rise = 0;
  let fall = 0;
  let flat = 0;
  let rateSum = 0;
  let rateCount = 0;

  for (const item of items) {
    const live = liveData.get(item.id);
    const rate = live?.changeRate;
    if (rate === undefined) continue;
    rateSum += rate;
    rateCount += 1;
    if (rate > 0) rise += 1;
    else if (rate < 0) fall += 1;
    else flat += 1;
  }

  const avgRate = rateCount > 0 ? rateSum / rateCount : undefined;

  const avgColor =
    avgRate === undefined
      ? '#6B7280'
      : avgRate > 0
      ? '#E84040'
      : avgRate < 0
      ? '#2563EB'
      : '#6B7280';

  const avgDisplay =
    avgRate === undefined
      ? '—'
      : `${avgRate >= 0 ? '+' : ''}${avgRate.toFixed(2)}%`;

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        margin: '0 16px 8px',
        padding: '16px',
      }}
    >
      <p
        style={{
          fontSize: '12px',
          color: '#94A3B8',
          margin: '0 0 10px',
          fontWeight: 500,
        }}
      >
        내 관심종목 현황
      </p>
      <div
        style={{
          borderTop: '1px solid #F1F5F9',
          paddingTop: '10px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '20px',
        }}
      >
        {/* 평균 수익률 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: avgColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {avgDisplay}
          </span>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>평균 수익률</span>
        </div>

        {/* 상승 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#E84040',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ▲{rise}
          </span>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>상승</span>
        </div>

        {/* 하락 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#2563EB',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ▼{fall}
          </span>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>하락</span>
        </div>

        {/* 보합 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#6B7280',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            →{flat}
          </span>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>보합</span>
        </div>
      </div>
    </div>
  );
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

// ─── 관심종목 빈 상태 ─────────────────────────────────────────────────────────

interface WatchlistEmptyProps {
  onGoHome: () => void;
}

function WatchlistEmpty({ onGoHome }: WatchlistEmptyProps): React.ReactElement {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        margin: '0 16px 8px',
        padding: '32px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <span style={{ fontSize: '32px' }}>⭐</span>
      <p style={{ fontSize: '14px', color: '#64748B', margin: 0, textAlign: 'center' }}>
        관심종목이 없습니다
      </p>
      <button
        onClick={onGoHome}
        style={{
          padding: '10px 20px',
          background: '#0F172A',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        홈에서 종목 추가하기
      </button>
    </div>
  );
}

// ─── 관심종목 행 ──────────────────────────────────────────────────────────────

interface WatchlistRowProps {
  item: WatchlistItem;
  isLast: boolean;
  onRemove: (id: string) => void;
  price?: number;
  changeRate?: number;
}

function WatchlistRow({ item, isLast, onRemove, price, changeRate }: WatchlistRowProps): React.ReactElement {
  const decimals = item.type === 'coin' && price !== undefined && price < 100 ? 2 : 0;
  const formattedPrice = price !== undefined ? formatPriceSafe(price, { decimals }) : null;
  const rate = changeRate !== undefined ? formatRate(changeRate) : null;

  const rateColor =
    rate?.direction === 'rise'
      ? 'var(--kr-rise, #E84040)'
      : rate?.direction === 'fall'
      ? 'var(--kr-fall, #2563EB)'
      : '#6B7280';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 16px',
        borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
        gap: '10px',
      }}
    >
      {/* 종목명 */}
      <span style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: '#0F172A' }}>
        {item.name}
      </span>

      {/* 종류 배지 */}
      <span
        style={{
          fontSize: '10px',
          color: item.type === 'coin' ? '#7C3AED' : '#0369A1',
          background: item.type === 'coin' ? '#EDE9FE' : '#E0F2FE',
          borderRadius: '6px',
          padding: '2px 8px',
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {item.type === 'coin' ? '코인' : '주식'}
      </span>

      {/* 가격 + 변동률 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
          {formattedPrice !== null ? `${formattedPrice}원` : '—'}
        </span>
        {rate !== null && (
          <span style={{ fontSize: '11px', fontWeight: 500, color: rateColor }}>
            {rate.display}
          </span>
        )}
      </div>

      {/* 삭제 버튼 */}
      <button
        onClick={() => onRemove(item.id)}
        aria-label={`${item.name} 삭제`}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: 'none',
          background: '#F1F5F9',
          color: '#94A3B8',
          fontSize: '16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── 포트폴리오 히스토리 라인차트 ────────────────────────────────────────────────

function generateMockHistory(currentValue: number): { date: string; value: number }[] {
  // 결정론적 seed 기반 ±2% 랜덤 워크 (7일 전 → 오늘)
  const seed = Math.abs(Math.round(currentValue)) % 9999 + 1;
  let pseudo = seed;
  const rand = () => {
    pseudo = (pseudo * 1664525 + 1013904223) & 0x7fffffff;
    return pseudo / 0x7fffffff; // 0~1
  };

  const points: { date: string; value: number }[] = [];
  let val = currentValue;
  // 7일 전부터 오늘까지 순서대로 배치하기 위해 뒤에서부터 역산
  // 오늘(index 6)이 currentValue, 과거는 역방향으로 랜덤 워크
  const values: number[] = [currentValue];
  for (let i = 0; i < 6; i++) {
    const change = (rand() * 4 - 2) / 100; // ±2%
    val = val / (1 + change);
    values.unshift(val);
  }

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }); // "3/13"
    points.push({ date: label, value: values[i] });
  }
  return points;
}

interface PortfolioHistoryChartProps {
  currentValue: number;
}

function PortfolioHistoryChart({ currentValue }: PortfolioHistoryChartProps): React.ReactElement | null {
  if (currentValue <= 0) return null;

  const history = generateMockHistory(currentValue);
  const values = history.map((h) => h.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // viewBox: 0 0 320 80, 패딩 top/bottom 8px for label breathing room
  const W = 320;
  const H = 60; // 차트 영역 높이 (라벨 제외)
  const TOP_PAD = 6;
  const BOT_PAD = 4;
  const chartH = H - TOP_PAD - BOT_PAD;

  const toX = (i: number) => (i / (history.length - 1)) * W;
  const toY = (v: number) => TOP_PAD + chartH - ((v - minVal) / range) * chartH;

  const linePath = history
    .map((h, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(h.value).toFixed(1)}`)
    .join(' ');

  // 그라데이션 fill — 라인 아래 닫기
  const fillPath =
    linePath +
    ` L${W},${H} L0,${H} Z`;

  const firstVal = history[0].value;
  const lastVal = history[history.length - 1].value;
  const changeRate = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;
  const isProfit = changeRate >= 0;
  const lineColor = isProfit ? '#E84040' : '#2563EB';
  const gradientId = `phc-grad-${isProfit ? 'r' : 'b'}`;

  const rateDisplay = `${changeRate >= 0 ? '+' : ''}${changeRate.toFixed(2)}%`;

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        margin: '0 16px 8px',
        padding: '16px',
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, fontWeight: 500 }}>
          7일 수익률 추이
        </p>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: lineColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rateDisplay}
        </span>
      </div>

      {/* SVG 차트 */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="60"
        style={{ display: 'block', overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.15} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* 그라데이션 fill */}
        <path d={fillPath} fill={`url(#${gradientId})`} />
        {/* 라인 */}
        <path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* 오늘 끝점 dot */}
        <circle
          cx={toX(history.length - 1).toFixed(1)}
          cy={toY(lastVal).toFixed(1)}
          r="3"
          fill={lineColor}
        />
      </svg>

      {/* X축 레이블 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '4px',
        }}
      >
        {history.map((h) => (
          <span
            key={h.date}
            style={{
              fontSize: '10px',
              color: '#94A3B8',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {h.date}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── MyPage ───────────────────────────────────────────────────────────────────

export default function MyPage(): React.ReactElement {
  const router = useRouter();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);

  useEffect(() => {
    const load = async () => {
      const list = await getWatchlist();
      setItems(list);
      setLoaded(true);
    };
    void load();
  }, []);

  useEffect(() => {
    setAlerts(getAlerts().filter((a) => !a.triggered));
  }, []);

  useEffect(() => {
    setHoldings(getHoldings());
  }, []);

  const streamSymbols = useMemo(() => items.map((i) => i.id), [items]);
  const { prices: liveData } = usePriceStream(streamSymbols);

  // 가격 알림 자동 체크 — liveData 갱신마다 실행
  useEffect(() => {
    if (liveData.size === 0) return;
    liveData.forEach((priceData, symbol) => {
      const triggered = checkAlerts(symbol, priceData.price);
      for (const alert of triggered) {
        markAlertTriggered(alert.id);
        const conditionLabel = alert.condition === 'above' ? '이상' : '이하';
        showToast({
          text: `🔔 ${alert.name} ${conditionLabel} ${alert.targetPrice.toLocaleString()}원 도달!`,
          type: 'success',
        });
      }
    });
    // 트리거된 알림이 있으면 알림 목록 동기화
    setAlerts(getAlerts().filter((a) => !a.triggered));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveData]);
  const { permission: notifPermission, requestPermission } = useNotification();
  const [marketNotifStatus, setMarketNotifStatus] = useState<'idle' | 'granted' | 'denied'>(() => {
    if (typeof window === 'undefined') return 'idle';
    return localStorage.getItem('push_enabled') === 'true' ? 'granted' : 'idle';
  });

  const handleRequestMarketNotif = useCallback(async () => {
    if (!('Notification' in window)) {
      showToast({ text: '이 브라우저는 알림을 지원하지 않습니다', type: 'error' });
      return;
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      localStorage.setItem('push_enabled', 'true');
      setMarketNotifStatus('granted');
      showToast({ text: '개장(09:00), 마감(15:30) 알림이 설정되었습니다', type: 'success' });
    } else {
      setMarketNotifStatus('denied');
      showToast({ text: '브라우저 설정에서 알림을 허용해주세요', type: 'warning' });
    }
  }, []);

  // 수익률 요약 계산
  const profitSummary = useMemo(() => {
    if (!loaded || items.length === 0) return null;
    const rates = items.map((i) => liveData.get(i.id)?.changeRate ?? 0);
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    const riseCount = rates.filter((r) => r > 0).length;
    const fallCount = rates.filter((r) => r < 0).length;
    return { avgRate, riseCount, fallCount };
  }, [loaded, items, liveData]);

  const handleRemoveHolding = useCallback((symbol: string) => {
    removeHolding(symbol);
    setHoldings((prev) => {
      const removed = prev.find((h) => h.symbol === symbol);
      if (removed) showToast({ text: `${removed.name} 보유 종목이 삭제되었습니다`, type: 'warning' });
      return prev.filter((h) => h.symbol !== symbol);
    });
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    await removeFromWatchlist(id);
    setItems((prev) => {
      const removed = prev.find((i) => i.id === id);
      if (removed) showToast({ text: `${removed.name} 삭제됨`, type: 'warning' });
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleRemoveAlert = useCallback((id: string) => {
    removeAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    showToast({ text: '알림이 삭제되었습니다', type: 'warning' });
  }, []);

  const handleCopyUrl = useCallback(async () => {
    const url = buildShareUrl(items);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast({ text: '관심목록 URL 복사됨', type: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ text: 'URL 복사에 실패했습니다', type: 'error' });
    }
  }, [items]);

  const handleExport = useCallback(() => {
    const payload = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      watchlist: items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        addedAt: item.addedAt,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'watchlist.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast({ text: 'watchlist.json 다운로드됨', type: 'success' });
  }, [items]);

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
            padding: '16px 16px 12px',
          }}
        >
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            MY
          </h1>
        </header>

        {/* 관심종목 섹션 */}
        <section aria-label="관심종목 관리">
          <SectionHeader title={`⭐ 관심종목 (${loaded ? items.length : '-'}개)`} />
          {loaded && (
            <WatchlistSummaryCard liveData={liveData} items={items} />
          )}

          {!loaded ? (
            /* 로딩 스켈레톤 */
            <div
              style={{
                background: 'white',
                borderRadius: '16px',
                margin: '0 16px 8px',
                overflow: 'hidden',
              }}
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px 16px',
                    borderBottom: i < 2 ? '1px solid #F1F5F9' : 'none',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: '16px',
                      background: '#F1F5F9',
                      borderRadius: '4px',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                  <div
                    style={{
                      width: '32px',
                      height: '16px',
                      background: '#F1F5F9',
                      borderRadius: '4px',
                    }}
                  />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <WatchlistEmpty onGoHome={() => router.push('/')} />
          ) : (
            <div
              style={{
                background: 'white',
                borderRadius: '16px',
                margin: '0 16px 8px',
                overflow: 'hidden',
              }}
            >
              {items.map((item, idx) => {
                const live = liveData.get(item.id);
                return (
                  <WatchlistRow
                    key={item.id}
                    item={item}
                    isLast={idx === items.length - 1}
                    onRemove={handleRemove}
                    price={live?.price}
                    changeRate={live?.changeRate}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* 보유 종목 섹션 */}
        <section aria-label="보유 종목">
          <SectionHeader title={`💼 보유 종목 (${holdings.length}개)`} />
          {holdings.length === 0 ? (
            <div
              style={{
                background: 'white',
                borderRadius: '16px',
                margin: '0 16px 8px',
                padding: '40px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '40px' }}>💼</span>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: 0, textAlign: 'center' }}>
                아직 보유 종목이 없어요
              </p>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0, textAlign: 'center' }}>
                종목 상세에서 + 매수 버튼으로 추가하세요
              </p>
            </div>
          ) : (
            <>
              {/* 보유 종목 요약 카드 */}
              {(() => {
                const totalInvest = holdings.reduce((sum, h) => sum + h.avgPrice * h.quantity, 0);
                const totalEval = holdings.reduce((sum, h) => {
                  const live = liveData.get(h.symbol);
                  const price = live?.price ?? h.avgPrice;
                  return sum + price * h.quantity;
                }, 0);
                const totalPnl = totalEval - totalInvest;
                const totalPnlRate = totalInvest > 0 ? (totalPnl / totalInvest) * 100 : 0;
                const pnlColor = totalPnl > 0 ? '#E84040' : totalPnl < 0 ? '#2563EB' : '#6B7280';
                return (
                  <>
                  <div
                    style={{
                      background: 'white',
                      borderRadius: '16px',
                      margin: '0 16px 8px',
                      padding: '16px',
                    }}
                  >
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 12px', fontWeight: 500 }}>
                      내 보유 종목 요약
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      {/* 총 평가금액 */}
                      <div
                        style={{
                          flex: 1,
                          background: '#F8FAFC',
                          borderRadius: '10px',
                          padding: '10px 12px',
                        }}
                      >
                        <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px', fontWeight: 500 }}>
                          총 평가금액
                        </p>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                          {formatKRW(totalEval)}
                        </span>
                      </div>
                      {/* 총 매입금액 */}
                      <div
                        style={{
                          flex: 1,
                          background: '#F8FAFC',
                          borderRadius: '10px',
                          padding: '10px 12px',
                        }}
                      >
                        <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px', fontWeight: 500 }}>
                          총 매입금액
                        </p>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                          {formatKRW(totalInvest)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* 평가손익 */}
                      <div
                        style={{
                          flex: 1,
                          background: '#F8FAFC',
                          borderRadius: '10px',
                          padding: '10px 12px',
                        }}
                      >
                        <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px', fontWeight: 500 }}>
                          평가손익
                        </p>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: pnlColor, fontVariantNumeric: 'tabular-nums' }}>
                          {totalPnl >= 0 ? '+' : '-'}{formatKRW(Math.abs(totalPnl))}
                        </span>
                      </div>
                      {/* 수익률 */}
                      <div
                        style={{
                          flex: 1,
                          background: '#F8FAFC',
                          borderRadius: '10px',
                          padding: '10px 12px',
                        }}
                      >
                        <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px', fontWeight: 500 }}>
                          수익률
                        </p>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: pnlColor, fontVariantNumeric: 'tabular-nums' }}>
                          {totalPnlRate >= 0 ? '+' : ''}{totalPnlRate.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <PortfolioHistoryChart currentValue={totalEval} />
                  </>
                );
              })()}

              {/* 자산 배분 차트 */}
              {(() => {
                const stockTotal = holdings
                  .filter(h => h.type === 'stock')
                  .reduce((sum, h) => sum + h.avgPrice * h.quantity, 0);
                const coinTotal = holdings
                  .filter(h => h.type === 'coin')
                  .reduce((sum, h) => sum + h.avgPrice * h.quantity, 0);
                const allocationItems = [
                  { label: '주식', value: stockTotal, color: '#3B82F6' },
                  { label: '코인', value: coinTotal, color: '#F59E0B' },
                ].filter(i => i.value > 0);
                if (allocationItems.length === 0) return null;
                const totalInvest = stockTotal + coinTotal;
                return (
                  <div
                    style={{
                      background: 'white',
                      borderRadius: '16px',
                      margin: '0 16px 8px',
                      padding: '16px',
                    }}
                  >
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 12px', fontWeight: 500 }}>
                      자산 배분
                    </p>
                    <AllocationChart
                      items={allocationItems}
                      totalLabel={`${totalInvest.toLocaleString()}원`}
                    />
                  </div>
                );
              })()}

              {/* 보유 종목 카드 목록 */}
              <div
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  margin: '0 16px 8px',
                  overflow: 'hidden',
                }}
              >
                {holdings.map((holding, idx) => {
                  const live = liveData.get(holding.symbol);
                  const currentPrice = live?.price ?? holding.avgPrice;
                  const { pnl, pnlRate, totalValue, investValue } = calcPnL(holding, currentPrice);
                  const pnlColor = pnl > 0 ? '#E84040' : pnl < 0 ? '#2563EB' : '#6B7280';
                  const isLast = idx === holdings.length - 1;
                  return (
                    <div
                      key={holding.symbol}
                      style={{
                        padding: '14px 16px',
                        borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      {/* 종목 정보 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: '#0F172A' }}>
                            {holding.name}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              color: holding.type === 'coin' ? '#7C3AED' : '#0369A1',
                              background: holding.type === 'coin' ? '#EDE9FE' : '#E0F2FE',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontWeight: 500,
                              flexShrink: 0,
                            }}
                          >
                            {holding.type === 'coin' ? '코인' : '주식'}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
                          {holding.quantity.toLocaleString()}주 · 매수가 {holding.avgPrice.toLocaleString()}원
                        </span>
                      </div>

                      {/* 수익 정보 */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                          {totalValue.toLocaleString()}원
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 500, color: pnlColor, fontVariantNumeric: 'tabular-nums' }}>
                          {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()}원 ({pnlRate >= 0 ? '+' : ''}{pnlRate.toFixed(2)}%)
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
                          투자 {investValue.toLocaleString()}원
                        </div>
                      </div>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleRemoveHolding(holding.symbol)}
                        aria-label={`${holding.name} 보유 종목 삭제`}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          border: 'none',
                          background: '#F1F5F9',
                          color: '#94A3B8',
                          fontSize: '16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* 가격 알림 섹션 */}
        <section aria-label="가격 알림 목록">
          <SectionHeader title={`🔔 가격 알림 (${alerts.length}개)`} />
          {alerts.length === 0 ? (
            <div
              style={{
                background: 'white',
                borderRadius: '16px',
                margin: '0 16px 8px',
                padding: '24px 16px',
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
                설정된 알림이 없습니다
              </p>
            </div>
          ) : (
            <div
              style={{
                background: 'white',
                borderRadius: '16px',
                margin: '0 16px 8px',
                overflow: 'hidden',
              }}
            >
              {alerts.map((alert, idx) => (
                <div
                  key={alert.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderBottom: idx < alerts.length - 1 ? '1px solid #F1F5F9' : 'none',
                    gap: '10px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#0F172A' }}>
                      {alert.name}
                    </span>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
                      {alert.condition === 'above' ? '이상' : '이하'}{' '}
                      <span
                        style={{
                          fontWeight: 600,
                          color: '#0F172A',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {alert.targetPrice.toLocaleString()}원
                      </span>
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      color: alert.type === 'coin' ? '#7C3AED' : '#0369A1',
                      background: alert.type === 'coin' ? '#EDE9FE' : '#E0F2FE',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {alert.type === 'coin' ? '코인' : '주식'}
                  </span>
                  <button
                    onClick={() => handleRemoveAlert(alert.id)}
                    aria-label={`${alert.name} 알림 삭제`}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: 'none',
                      background: '#F1F5F9',
                      color: '#94A3B8',
                      fontSize: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 수익률 요약 섹션 */}
        {profitSummary !== null && (
          <section aria-label="수익률 요약">
            <SectionHeader title="📊 수익률 요약" />
            <div
              style={{
                background: 'white',
                borderRadius: '16px',
                margin: '0 16px 8px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>평균 변동률</span>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color:
                      profitSummary.avgRate > 0
                        ? 'var(--kr-rise, #E84040)'
                        : profitSummary.avgRate < 0
                        ? 'var(--kr-fall, #2563EB)'
                        : '#6B7280',
                  }}
                >
                  {profitSummary.avgRate > 0 ? '+' : ''}{profitSummary.avgRate.toFixed(2)}%
                </span>
              </div>
              <div style={{ width: '1px', height: '40px', background: '#E2E8F0', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>상승</span>
                <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--kr-rise, #E84040)' }}>
                  {profitSummary.riseCount}개
                </span>
              </div>
              <div style={{ width: '1px', height: '40px', background: '#E2E8F0', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>하락</span>
                <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--kr-fall, #2563EB)' }}>
                  {profitSummary.fallCount}개
                </span>
              </div>
            </div>
          </section>
        )}

        {/* 공유 URL 섹션 */}
        <section aria-label="관심목록 공유">
          <SectionHeader title="🔗 관심목록 공유" />
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              margin: '0 16px 8px',
              padding: '16px',
            }}
          >
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 12px' }}>
              현재 관심종목 목록을 URL로 공유하거나 JSON으로 내보낼 수 있어요.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => void handleCopyUrl()}
                disabled={items.length === 0}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: copied ? '#22C55E' : items.length === 0 ? '#F1F5F9' : '#0F172A',
                  color: items.length === 0 ? '#94A3B8' : 'white',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: items.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s ease',
                }}
              >
                {copied ? '복사됨 ✓' : 'URL 복사'}
              </button>
              <button
                onClick={handleExport}
                disabled={items.length === 0}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  background: items.length === 0 ? '#F1F5F9' : 'white',
                  color: items.length === 0 ? '#94A3B8' : '#0F172A',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: items.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                JSON 내보내기
              </button>
            </div>
          </div>
        </section>

        {/* 설정 섹션 */}
        <section aria-label="설정">
          <SectionHeader title="⚙️ 설정" />
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              margin: '0 16px 8px',
              overflow: 'hidden',
            }}
          >
            {/* 알림 설정 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <span style={{ fontSize: '14px', color: '#0F172A' }}>🔔 알림 설정</span>
              {notifPermission === 'granted' ? (
                <span style={{ fontSize: '13px', color: '#16A34A', fontWeight: 500 }}>
                  켜짐
                </span>
              ) : notifPermission === 'denied' ? (
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>
                  브라우저 설정에서 허용
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void requestPermission()}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563EB',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  허용
                </button>
              )}
            </div>

            {/* 시장 알림 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '14px', color: '#0F172A' }}>📈 시장 알림</span>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>개장 09:00 · 마감 15:30</span>
              </div>
              {marketNotifStatus === 'granted' ? (
                <span style={{ fontSize: '13px', color: '#16A34A', fontWeight: 500 }}>
                  ✓ 개장(09:00), 마감(15:30) 알림 설정됨
                </span>
              ) : marketNotifStatus === 'denied' ? (
                <span style={{ fontSize: '12px', color: '#94A3B8', maxWidth: '160px', textAlign: 'right', lineHeight: 1.4 }}>
                  브라우저 설정에서 알림을 허용해주세요
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleRequestMarketNotif()}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0F172A',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  시장 알림 받기
                </button>
              )}
            </div>

            {/* 언어 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <span style={{ fontSize: '14px', color: '#0F172A' }}>🌐 언어</span>
              <span style={{ fontSize: '13px', color: '#64748B' }}>한국어 &gt;</span>
            </div>

            {/* 가격 표시 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <span style={{ fontSize: '14px', color: '#0F172A' }}>📊 가격 표시</span>
              <span style={{ fontSize: '13px', color: '#64748B' }}>원화(KRW) &gt;</span>
            </div>

            {/* 데이터 초기화 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
              }}
            >
              <span style={{ fontSize: '14px', color: '#0F172A' }}>🗑️ 데이터 초기화</span>
              <button
                type="button"
                onClick={() => {
                  if (confirm('관심종목, 알림, 보유종목 데이터를 모두 삭제합니다. 계속할까요?')) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                style={{
                  padding: '4px 12px',
                  borderRadius: '8px',
                  border: '1px solid #E84040',
                  background: 'white',
                  color: '#E84040',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                초기화
              </button>
            </div>
          </div>
        </section>

        {/* 앱 정보 섹션 */}
        <section aria-label="앱 정보">
          <SectionHeader title="ℹ️ 앱 정보" />
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              margin: '0 16px 8px',
              overflow: 'hidden',
            }}
          >
            {/* 버전 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <span style={{ fontSize: '14px', color: '#0F172A' }}>버전</span>
              <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
                0.1.0 (Beta)
              </span>
            </div>

            {/* 설명 */}
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.6 }}>
                CoStock — 주식+코인 통합 투자정보
              </p>
            </div>

            {/* GitHub */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
              }}
            >
              <span style={{ fontSize: '14px', color: '#0F172A' }}>GitHub</span>
              <a
                href="https://github.com/gguloadoong/costock"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '13px', color: '#2563EB', textDecoration: 'none' }}
              >
                github.com/gguloadoong/costock
              </a>
            </div>
          </div>
        </section>
      </div>

      <BottomNavigation />
      <Toast />
    </>
  );
}
