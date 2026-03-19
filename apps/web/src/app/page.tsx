'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, type Trader } from '@/lib/api';
import { OnboardingModal } from '@/components/OnboardingModal';

// ─── 뉴스 타입 ────────────────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url?: string;
  category?: string;
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

// 트레이더 strategy → 색상 매핑
function traderColor(strategy: Trader['strategy']): string {
  if (strategy === 'etf_kr' || strategy === 'etf_allocation') return '#EC4899';
  if (strategy === 'crossasset_arb' || strategy === 'mixed') return '#8B5CF6';
  if (strategy === 'momentum_kr') return '#6366F1';
  if (strategy === 'contrarian_crypto') return '#F59E0B';
  if (strategy === 'quant_us') return '#10B981';
  return '#6366F1';
}

// ─── 시장 요약 바 ─────────────────────────────────────────────────────────────

interface MarketSummaryItem {
  label: string;
  value: string;
  change: number;
}

interface MarketIndicesResponse {
  data: {
    kospi?: { value: number; change: number; changeRate: number };
    kosdaq?: { value: number; change: number; changeRate: number };
    btcDominance?: { value: number; change: number; changeRate: number };
    btc?: { value: number; change: number; changeRate: number };
  };
  updatedAt: string;
  source: string;
}

function MarketSummaryBar(): React.ReactElement {
  const [items, setItems] = React.useState<MarketSummaryItem[]>([
    { label: 'KOSPI', value: '-', change: 0 },
    { label: 'BTC D.', value: '-', change: 0 },
  ]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    fetch(`${API_BASE}/api/v1/market/indices`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MarketIndicesResponse>;
      })
      .then((body) => {
        const next: MarketSummaryItem[] = [];
        if (body.data.kospi) {
          next.push({
            label: 'KOSPI',
            value: body.data.kospi.value.toLocaleString('ko-KR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            change: body.data.kospi.changeRate,
          });
        }
        if (body.data.kosdaq) {
          next.push({
            label: 'KOSDAQ',
            value: body.data.kosdaq.value.toLocaleString('ko-KR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            change: body.data.kosdaq.changeRate,
          });
        }
        if (body.data.btcDominance) {
          next.push({
            label: 'BTC D.',
            value: `${body.data.btcDominance.value.toFixed(2)}%`,
            change: body.data.btcDominance.changeRate,
          });
        }
        if (next.length > 0) {
          setItems(next);
          setLoaded(true);
        }
      })
      .catch(() => {
        // 실패 시 이전 값 유지 (초기 '-' 상태 그대로)
      });
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '8px 16px',
        background: '#F1F5F9',
        borderBottom: '1px solid #E2E8F0',
        fontSize: '12px',
      }}
    >
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <span style={{ color: '#CBD5E1' }}>|</span>}
          <span style={{ color: '#64748B' }}>
            {item.label}{' '}
            <span style={{ fontWeight: 600, color: '#0F172A' }}>{item.value}</span>
            {loaded && (
              <>
                {' '}
                <span style={{ color: returnColor(item.change), fontWeight: 500 }}>
                  {formatReturn(item.change)}
                </span>
              </>
            )}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── 트레이더 카드 스켈레톤 ───────────────────────────────────────────────────

function TraderCardSkeleton(): React.ReactElement {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '18px 16px',
        margin: '0 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        border: '1px solid #F1F5F9',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            background: '#F1F5F9',
            flexShrink: 0,
            animation: 'shimmer 1.5s infinite',
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              width: '80px',
              height: '15px',
              borderRadius: '6px',
              background: '#F1F5F9',
              marginBottom: '6px',
              animation: 'shimmer 1.5s infinite',
            }}
          />
          <div
            style={{
              width: '120px',
              height: '12px',
              borderRadius: '6px',
              background: '#F1F5F9',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        </div>
        <div
          style={{
            width: '72px',
            height: '30px',
            borderRadius: '20px',
            background: '#F1F5F9',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      </div>
      <div
        style={{
          width: '100px',
          height: '28px',
          borderRadius: '6px',
          background: '#F1F5F9',
          marginBottom: '12px',
          animation: 'shimmer 1.5s infinite',
        }}
      />
      <div
        style={{
          height: '36px',
          borderRadius: '8px',
          background: '#F1F5F9',
          animation: 'shimmer 1.5s infinite',
        }}
      />
    </div>
  );
}

// ─── 트레이더 카드 ────────────────────────────────────────────────────────────

interface TraderCardProps {
  trader: Trader;
  subscribed: boolean;
  onToggleSubscribe: (id: string) => void;
  onClick: () => void;
  lastReason?: string;
}

function TraderCard({
  trader,
  subscribed,
  onToggleSubscribe,
  onClick,
  lastReason,
}: TraderCardProps): React.ReactElement {
  const color = traderColor(trader.strategy);
  const totalReturnPct = trader.stats.totalReturn * 100;
  const winRatePct = trader.stats.winRate * 100;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '18px 16px',
        margin: '0 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        border: '1px solid #F1F5F9',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      {/* 상단: 아바타 + 이름 + 전략 + 알림 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        {/* 아바타 */}
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>
            {trader.nameKr.charAt(0)}
          </span>
        </div>

        {/* 이름 + 전략 태그 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
            AI {trader.nameKr}
          </div>
          <div
            style={{
              display: 'inline-block',
              marginTop: '3px',
              padding: '2px 8px',
              borderRadius: '20px',
              background: `${color}18`,
              fontSize: '11px',
              fontWeight: 600,
              color: color,
            }}
          >
            {trader.strategy}
          </div>
        </div>

        {/* 알림 토글 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSubscribe(trader.id);
          }}
          style={{
            flexShrink: 0,
            padding: '6px 12px',
            borderRadius: '20px',
            border: subscribed ? 'none' : '1px solid #E2E8F0',
            background: subscribed ? '#0F172A' : 'white',
            color: subscribed ? 'white' : '#6B7280',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {subscribed ? '알림 ON' : '알림 OFF'}
        </button>
      </div>

      {/* 수익률 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>누적 수익률</span>
            <span style={{ fontSize: '10px', color: '#CBD5E1' }}>
              {`${new Date().getMonth() + 1}/${new Date().getDate()}`}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '28px',
              fontWeight: 800,
              color: returnColor(totalReturnPct),
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>
              {totalReturnPct > 0 ? '▲' : totalReturnPct < 0 ? '▼' : '━'}
            </span>
            {formatReturn(totalReturnPct)}
          </div>
        </div>
        <div style={{ paddingBottom: '3px' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '2px' }}>승률</div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#0F172A',
            }}
          >
            {winRatePct.toFixed(1)}%
          </div>
        </div>
        <div style={{ paddingBottom: '3px', marginLeft: 'auto' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '2px' }}>총 매매</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#374151' }}>
            {trader.stats.totalTrades}회
          </div>
        </div>
      </div>

      {/* 전략 설명 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 10px',
          borderRadius: '8px',
          background: '#F8FAFC',
        }}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
            animation: 'pulse 2s infinite',
          }}
        />
        <span style={{ fontSize: '12px', color: '#64748B' }}>{trader.strategyDesc}</span>
      </div>

      {/* 최근 매매 이유 힌트 */}
      {lastReason && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            marginTop: '8px',
            padding: '8px 10px',
            borderRadius: '8px',
            background: '#F0F9FF',
            border: '1px solid #BAE6FD',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#0369A1', flexShrink: 0 }}>
            이유 보기
          </span>
          <span style={{ fontSize: '12px', color: '#0C4A6E', lineHeight: 1.4 }}>
            {lastReason}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── 뉴스 카드 스켈레톤 ───────────────────────────────────────────────────────

function NewsCardSkeleton(): React.ReactElement {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '14px 16px',
        margin: '0 16px',
        border: '1px solid #F1F5F9',
      }}
    >
      <div
        style={{
          width: '90%',
          height: '14px',
          borderRadius: '6px',
          background: '#F1F5F9',
          marginBottom: '8px',
          animation: 'shimmer 1.5s infinite',
        }}
      />
      <div
        style={{
          width: '60%',
          height: '12px',
          borderRadius: '6px',
          background: '#F1F5F9',
          marginBottom: '6px',
          animation: 'shimmer 1.5s infinite',
        }}
      />
      <div
        style={{
          width: '100px',
          height: '11px',
          borderRadius: '6px',
          background: '#F1F5F9',
          animation: 'shimmer 1.5s infinite',
        }}
      />
    </div>
  );
}

// ─── 뉴스 카드 ────────────────────────────────────────────────────────────────

interface NewsCardProps {
  item: NewsItem;
}

function NewsCard({ item }: NewsCardProps): React.ReactElement {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '14px 16px',
        margin: '0 16px',
        border: '1px solid #F1F5F9',
      }}
    >
      <div
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#0F172A',
          lineHeight: 1.5,
          marginBottom: '8px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {item.title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94A3B8' }}>
        <span>{item.source}</span>
        <span>·</span>
        <span>{timeAgo(item.publishedAt)}</span>
      </div>
    </div>
  );
}

// ─── 섹션 헤더 ────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        padding: '20px 16px 10px',
        fontSize: '13px',
        fontWeight: 600,
        color: '#94A3B8',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

// ─── 홈 페이지 ────────────────────────────────────────────────────────────────

export default function HomePage(): React.ReactElement {
  const router = useRouter();
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [lastReasons, setLastReasons] = useState<Record<string, string>>({});

  // 온보딩 표시 여부 확인 (SSR 안전: useEffect 안에서만 localStorage 접근)
  useEffect(() => {
    try {
      if (!localStorage.getItem('onboarding_done')) {
        setShowOnboarding(true);
      }
    } catch {
      // localStorage 접근 불가 시 모달 미표시
    }
  }, []);

  const handleOnboardingClose = useCallback(() => {
    try {
      localStorage.setItem('onboarding_done', '1');
    } catch {
      // 무시
    }
    setShowOnboarding(false);
  }, []);

  // localStorage에서 구독 상태 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem('trader_subscriptions');
      if (stored) {
        setSubscribed(new Set(JSON.parse(stored) as string[]));
      }
    } catch {
      // 무시
    }
  }, []);

  // 트레이더 목록 API 호출
  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`${API_BASE}/api/v1/traders`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data: Trader[] }>;
      })
      .then((body) => {
        setTraders(body.data);
        setLoading(false);
        // 각 트레이더 최근 매매 이유 병렬 fetch
        const ids: string[] = body.data.map((t: Trader) => t.id);
        void Promise.all(
          ids.map((id) =>
            fetch(`${API_BASE}/api/v1/traders/${id}/trades?limit=1`)
              .then((r) => r.ok ? r.json() as Promise<{ data: { reason?: string }[] }> : null)
              .then((res) => {
                const reason = res?.data?.[0]?.reason;
                if (reason) setLastReasons((prev) => ({ ...prev, [id]: reason }));
              })
              .catch(() => undefined),
          ),
        );
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  // 뉴스 API 호출
  useEffect(() => {
    setNewsLoading(true);
    fetch(`${API_BASE}/api/v1/news?limit=10`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data: NewsItem[] }>;
      })
      .then((body) => {
        setNews(body.data);
        setNewsLoading(false);
      })
      .catch(() => {
        // 실패 시 뉴스 섹션 숨김
        setNewsLoading(false);
      });
  }, []);

  const handleToggleSubscribe = useCallback((id: string) => {
    setSubscribed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem('trader_subscriptions', JSON.stringify([...next]));
      } catch {
        // 무시
      }
      return next;
    });
  }, []);

  return (
    <>
      {showOnboarding && <OnboardingModal onClose={handleOnboardingClose} />}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
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
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px 12px',
          }}
        >
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
              AI 트레이더
            </div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
              실시간 모의투자 카피트레이딩
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '20px',
                background: '#F0FDF4',
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#22C55E',
                  animation: 'pulse 2s infinite',
                }}
              />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#16A34A' }}>LIVE</span>
            </div>
            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '20px',
              background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
              모의투자
            </span>
          </div>
        </div>

        {/* 시장 요약 */}
        <MarketSummaryBar />
      </header>

      {/* ── 트레이더 목록 ── */}
      <section style={{ animation: 'fadeIn 0.2s ease' }}>
        {loading ? (
          <>
            <SectionLabel>트레이더 불러오는 중...</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <TraderCardSkeleton />
              <TraderCardSkeleton />
              <TraderCardSkeleton />
            </div>
          </>
        ) : error ? (
          <>
            <SectionLabel>트레이더</SectionLabel>
            <div
              style={{
                margin: '0 16px',
                padding: '24px 16px',
                borderRadius: '16px',
                background: 'white',
                border: '1px solid #F1F5F9',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '12px' }}>
                데이터를 불러올 수 없습니다
              </div>
              <button
                onClick={() => {
                  setLoading(true);
                  setError(false);
                  fetch(`${API_BASE}/api/v1/traders`)
                    .then((r) => {
                      if (!r.ok) throw new Error(`HTTP ${r.status}`);
                      return r.json() as Promise<{ data: Trader[] }>;
                    })
                    .then((body) => {
                      setTraders(body.data);
                      setLoading(false);
                    })
                    .catch(() => {
                      setError(true);
                      setLoading(false);
                    });
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: 'white',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                다시 시도
              </button>
            </div>
          </>
        ) : (
          <>
            <SectionLabel>트레이더 {traders.length}명 활동 중</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {traders.map((trader) => (
                <TraderCard
                  key={trader.id}
                  trader={trader}
                  subscribed={subscribed.has(trader.id)}
                  onToggleSubscribe={handleToggleSubscribe}
                  onClick={() => router.push(`/trader/${trader.id}`)}
                  lastReason={lastReasons[trader.id]}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── 시장 뉴스 ── */}
      {(newsLoading || news.length > 0) && (
        <section style={{ paddingBottom: '16px' }}>
          <SectionLabel>시장 뉴스</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {newsLoading ? (
              <>
                <NewsCardSkeleton />
                <NewsCardSkeleton />
              </>
            ) : (
              news.map((item) => (
                <NewsCard key={item.id} item={item} />
              ))
            )}
          </div>
        </section>
      )}
    </>
  );
}
