/**
 * DetailPage — 종목 상세 페이지
 *
 * 섹션:
 *   1. 헤더 (sticky): 뒤로가기 + 종목명 + watchlist 토글
 *   2. 가격 히어로: 실시간 가격 + 등락
 *   3. 차트 (TradingView Lightweight Charts): 기간별 탭
 *   4. 핵심 지표 (2x2 그리드)
 *   5. 뉴스 섹션
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePriceStream } from '@/hooks/usePriceStream';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '@/lib/watchlistStorage';
import type { WatchlistItem } from '@/lib/watchlistStorage';
import { PriceChart } from './PriceChart';
import { showToast } from '@/components/Toast';
import { AlertModal } from '@/components/AlertModal';
import { PriceChange } from '@/components/PriceChange';
import { formatKRW, formatVolume } from '@/lib/formatters';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface DetailPageProps {
  symbol: string;
  assetType: 'stock' | 'coin';
}

interface NewsItem {
  title: string;
  source: string;
  time: string;
  url: string;
}

// ─── 뉴스 카테고리 배지 헬퍼 ─────────────────────────────────────────────────

const CATEGORY_KEYWORDS: { label: string; keywords: string[] }[] = [
  { label: '시황', keywords: ['시황', '증시', '코스피', '코스닥', '지수', '시장', '장세', '매수', '매도', '급등', '급락'] },
  { label: '기업', keywords: ['실적', '분기', '영업이익', '매출', '순이익', '어닝', '배당', '공시', '대표', 'CEO', '인수', '합병'] },
  { label: '산업', keywords: ['반도체', '배터리', '전기차', '바이오', 'AI', '인공지능', '금리', '환율', '원자재', '섹터', '업종'] },
];

function getNewsCategory(title: string): string | null {
  for (const { label, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => title.includes(kw))) return label;
  }
  return null;
}

// ─── Mock 데이터 헬퍼 ─────────────────────────────────────────────────────────

const MOCK_NAMES: Record<string, string> = {
  '005930': '삼성전자',
  '000660': 'SK하이닉스',
  '035720': '카카오',
  '035420': 'NAVER',
  '051910': 'LG화학',
  'KRW-BTC': '비트코인',
  'KRW-ETH': '이더리움',
  'KRW-XRP': '리플',
  'KRW-SOL': '솔라나',
  'KRW-ADA': '에이다',
};

const MOCK_PRICES: Record<string, number> = {
  '005930': 85_400,
  '000660': 198_500,
  '035720': 43_250,
  '035420': 212_500,
  '051910': 328_000,
  'KRW-BTC': 142_850_000,
  'KRW-ETH': 5_420_000,
  'KRW-XRP': 3_845,
  'KRW-SOL': 298_500,
  'KRW-ADA': 1_245,
};

const MOCK_CHANGES: Record<string, { change: number; changeRate: number }> = {
  '005930': { change: 1_200, changeRate: 1.43 },
  '000660': { change: -2_500, changeRate: -1.24 },
  '035720': { change: 350, changeRate: 0.82 },
  '035420': { change: 0, changeRate: 0 },
  '051910': { change: 9_000, changeRate: 2.82 },
  'KRW-BTC': { change: 2_150_000, changeRate: 1.53 },
  'KRW-ETH': { change: -88_000, changeRate: -1.60 },
  'KRW-XRP': { change: 124, changeRate: 3.33 },
  'KRW-SOL': { change: -4_200, changeRate: -1.39 },
  'KRW-ADA': { change: 38, changeRate: 3.15 },
};

const MOCK_VOLUMES: Record<string, number> = {
  '005930': 12_345_678,
  '000660': 3_812_091,
  '035720': 7_204_332,
  '035420': 1_923_410,
  '051910': 944_210,
  'KRW-BTC': 8_204,
  'KRW-ETH': 42_910,
  'KRW-XRP': 1_204_885,
  'KRW-SOL': 32_091,
  'KRW-ADA': 4_882_001,
};

const MOCK_DOMINANCE: Record<string, string> = {
  'KRW-BTC': '59.42%',
  'KRW-ETH': '17.38%',
  'KRW-XRP': '1.84%',
  'KRW-SOL': '2.91%',
  'KRW-ADA': '0.96%',
};

const COIN_NEWS_FALLBACK_URLS: Record<string, string> = {
  'KRW-BTC': 'https://upbit.com/exchange?code=CRIX.UPBIT.KRW-BTC',
  'KRW-ETH': 'https://upbit.com/exchange?code=CRIX.UPBIT.KRW-ETH',
  'KRW-XRP': 'https://upbit.com/exchange?code=CRIX.UPBIT.KRW-XRP',
  'KRW-SOL': 'https://upbit.com/exchange?code=CRIX.UPBIT.KRW-SOL',
  'KRW-ADA': 'https://upbit.com/exchange?code=CRIX.UPBIT.KRW-ADA',
};


function formatPrice(value: number): string {
  return value.toLocaleString('ko-KR');
}

// ─── DetailPage ───────────────────────────────────────────────────────────────

interface PriceApiData {
  price: number;
  prevClose: number;
  change: number;
  changeRate: number;
}

export function DetailPage({ symbol, assetType }: DetailPageProps): React.ReactElement {
  const router = useRouter();
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsError, setNewsError] = useState(false);
  const [apiData, setApiData] = useState<PriceApiData | null>(null);

  const instrumentName = MOCK_NAMES[symbol] ?? symbol;
  const basePrice = MOCK_PRICES[symbol] ?? 10_000;
  const mockChange = MOCK_CHANGES[symbol] ?? { change: 0, changeRate: 0 };

  // 실시간 가격 스트림
  const streamSymbols = useMemo(() => [symbol], [symbol]);
  const { prices: liveData } = usePriceStream(streamSymbols);
  const live = liveData.get(symbol);

  const currentPrice = live?.price ?? apiData?.price ?? basePrice;
  const currentChange = live?.change ?? apiData?.change ?? mockChange.change;
  const currentChangeRate = live?.changeRate ?? apiData?.changeRate ?? mockChange.changeRate;
  const prevClose = apiData?.prevClose ?? null;

  // Watchlist 상태 로드
  useEffect(() => {
    const checkWatchlist = async () => {
      const list = await getWatchlist();
      setIsWatchlisted(list.some((item) => item.id === symbol));
    };
    void checkWatchlist();
  }, [symbol]);

  // 가격 API 호출 (prevClose 포함)
  useEffect(() => {
    const controller = new AbortController();
    const fetchPrice = async () => {
      try {
        const res = await fetch(`/api/v1/prices/${symbol}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('price fetch failed');
        const json = (await res.json()) as {
          data: { symbol: string; price: number; prevClose: number; change: number; changeRate: number; ts: number };
        };
        setApiData(json.data);
      } catch {
        // 실패 시 usePriceStream 데이터로 폴백 유지
      }
    };
    void fetchPrice();
    return () => controller.abort();
  }, [symbol]);

  // 뒤로가기 (히스토리 없을 때 홈으로)
  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }, [router]);

  // 공유
  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const text = `${instrumentName} 실시간 가격 — CoStock`;
    if (navigator.share) {
      await navigator.share({ title: 'CoStock', text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      showToast({ text: 'URL 복사됨', type: 'success' });
    }
  }, [instrumentName]);

  // 페이지 타이틀 업데이트
  useEffect(() => {
    if (currentPrice > 0) {
      const sign = currentChangeRate >= 0 ? '+' : '';
      document.title = `${currentPrice.toLocaleString()}원 ${sign}${currentChangeRate.toFixed(2)}% — ${instrumentName} | CoStock`;
    }
    return () => {
      document.title = 'CoStock — 주식·코인 통합 투자정보';
    };
  }, [currentPrice, currentChangeRate, instrumentName]);

  // Watchlist 토글
  const handleWatchlistToggle = useCallback(async () => {
    if (isWatchlisted) {
      await removeFromWatchlist(symbol);
      setIsWatchlisted(false);
    } else {
      const item: WatchlistItem = {
        id: symbol,
        type: assetType,
        name: instrumentName,
        addedAt: Date.now(),
      };
      await addToWatchlist(item);
      setIsWatchlisted(true);
    }
  }, [isWatchlisted, symbol, assetType, instrumentName]);

  // 뉴스 fetch
  useEffect(() => {
    const controller = new AbortController();
    const fetchNews = async () => {
      try {
        const res = await fetch(`/api/v1/news?symbol=${symbol}&limit=3`, {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error('News fetch failed');
        const data = (await res.json()) as NewsItem[];
        setNews(data);
        setNewsError(false);
      } catch {
        if (!controller.signal.aborted) {
          setNewsError(true);
        }
      }
    };
    void fetchNews();
    return () => controller.abort();
  }, [symbol]);

  // 핵심 지표 mock
  const openPrice = Math.round(currentPrice * 0.998);
  const highPrice = Math.round(currentPrice * 1.015);
  const lowPrice = Math.round(currentPrice * 0.985);
  const high52w = Math.round(currentPrice * 1.35);
  const low52w = Math.round(currentPrice * 0.65);
  const mockVolume = MOCK_VOLUMES[symbol] ?? 1_234_567;
  const fourthMetricLabel = assetType === 'stock' ? '시가총액' : '도미넌스';
  const fourthMetricValue =
    assetType === 'stock'
      ? `${formatPrice(Math.round(currentPrice * 5_000_000))}원`
      : (MOCK_DOMINANCE[symbol] ?? '0.50%');

  const stats = [
    { label: '시가', value: formatKRW(openPrice) },
    { label: '고가', value: formatKRW(highPrice) },
    { label: '저가', value: formatKRW(lowPrice) },
    { label: '거래량', value: formatVolume(mockVolume) },
    { label: '52주 최고', value: formatKRW(high52w) },
    { label: '52주 최저', value: formatKRW(low52w) },
  ];

  const fallbackNewsUrl =
    assetType === 'stock'
      ? `https://finance.naver.com/item/news.nhn?code=${symbol}`
      : (COIN_NEWS_FALLBACK_URLS[symbol] ?? 'https://upbit.com');

  return (
    <div style={{ background: 'white', maxWidth: '430px', margin: '0 auto', paddingBottom: '80px' }}>
      {/* ── 헤더 (sticky) ── */}
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
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {instrumentName}
        </span>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsAlertOpen(true)}
            aria-label="가격 알림 설정"
            style={{
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#64748B',
            }}
          >
            🔔
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label="공유"
            style={{
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748B',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => void handleWatchlistToggle()}
            aria-label={isWatchlisted ? `${instrumentName} 관심종목 제거` : `${instrumentName} 관심종목 추가`}
            style={{
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '22px',
              color: isWatchlisted ? '#F59E0B' : '#CBD5E1',
            }}
          >
            {isWatchlisted ? '\u2605' : '\u2606'}
          </button>
        </div>
      </header>

      {/* ── 가격 히어로 섹션 ── */}
      <section style={{ padding: '24px 16px 16px' }}>
        <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 4px' }}>
          {instrumentName} ({symbol})
        </p>
        <p
          style={{
            fontSize: '40px',
            fontWeight: 700,
            color: '#0F172A',
            margin: '0 0 4px',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'Menlo, Consolas, monospace',
          }}
        >
          {formatPrice(currentPrice)}원
        </p>
        <p style={{ fontSize: '15px', margin: '0 0 6px' }}>
          <span style={{ color: '#64748B', marginRight: '6px' }}>전일 대비</span>
          <PriceChange rate={currentChangeRate} diff={currentChange} size="base" showArrow />
        </p>
        {prevClose !== null && (
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            전일종가 {formatPrice(prevClose)}원
          </p>
        )}
      </section>

      {/* ── 차트 섹션 ── */}
      <section style={{ background: '#F8FAFC', padding: '16px' }}>
        <PriceChart symbol={symbol} assetType={assetType} />
      </section>

      {/* ── 핵심 지표 그리드 (3x2) ── */}
      <section style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', margin: '0 0 12px' }}>
          핵심 지표
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          {stats.map((s) => (
            <MetricCard key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
        <div style={{ marginTop: '12px' }}>
          <MetricCard label={fourthMetricLabel} value={fourthMetricValue} />
        </div>
      </section>

      {/* ── 알림 모달 ── */}
      {isAlertOpen && (
        <AlertModal
          symbol={symbol}
          name={instrumentName}
          type={assetType}
          currentPrice={currentPrice}
          onClose={() => setIsAlertOpen(false)}
        />
      )}

      {/* ── 뉴스 섹션 ── */}
      <section style={{ background: '#F8FAFC', padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', margin: '0 0 12px' }}>
          관련 뉴스
        </h3>
        {news.length > 0 && !newsError ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {news.map((item, idx) => {
              const category = getNewsCategory(item.title);
              return (
                <a
                  key={idx}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px',
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    textDecoration: 'none',
                  }}
                >
                  {/* 이미지 플레이스홀더 */}
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      flexShrink: 0,
                      borderRadius: '6px',
                      background: '#E2E8F0',
                    }}
                  />

                  {/* 텍스트 영역 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* 카테고리 배지 + 외부 링크 아이콘 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      {category ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#2563EB',
                            background: '#EFF6FF',
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {category}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span style={{ fontSize: '13px', color: '#94A3B8', flexShrink: 0 }}>↗</span>
                    </div>
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#0F172A',
                        margin: '0 0 4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </p>
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
                      {item.source} &middot; {item.time}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <a
            href={fallbackNewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: '16px',
              background: 'white',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              textAlign: 'center',
              textDecoration: 'none',
              fontSize: '14px',
              color: '#2563EB',
            }}
          >
            네이버 금융에서 더보기 &rarr;
          </a>
        )}
      </section>
    </div>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div
      style={{
        padding: '12px',
        background: '#F8FAFC',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
      }}
    >
      <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 4px' }}>{label}</p>
      <p
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#0F172A',
          margin: 0,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'Menlo, Consolas, monospace',
        }}
      >
        {value}
      </p>
    </div>
  );
}
