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
import { formatPriceSafe } from '@/design-system/utils/formatPrice';
import { formatRate } from '@/design-system/utils/formatRate';

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

// ─── MyPage ───────────────────────────────────────────────────────────────────

export default function MyPage(): React.ReactElement {
  const router = useRouter();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const list = await getWatchlist();
      setItems(list);
      setLoaded(true);
    };
    void load();
  }, []);

  const streamSymbols = useMemo(() => items.map((i) => i.id), [items]);
  const { prices: liveData } = usePriceStream(streamSymbols);

  const handleRemove = useCallback(async (id: string) => {
    await removeFromWatchlist(id);
    setItems((prev) => {
      const removed = prev.find((i) => i.id === id);
      if (removed) showToast({ text: `${removed.name} 삭제됨`, type: 'warning' });
      return prev.filter((i) => i.id !== id);
    });
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
            MY
          </h1>
        </header>

        {/* 관심종목 섹션 */}
        <section aria-label="관심종목 관리">
          <SectionHeader title={`⭐ 관심종목 (${loaded ? items.length : '-'}개)`} />

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
              현재 관심종목 목록을 URL로 공유할 수 있어요.
            </p>
            <button
              onClick={() => void handleCopyUrl()}
              disabled={items.length === 0}
              style={{
                width: '100%',
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
          </div>
        </section>

        {/* 앱 정보 섹션 */}
        <section aria-label="앱 정보">
          <SectionHeader title="ℹ️ 정보" />
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
              <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 500 }}>
                v0.1.0 (Beta)
              </span>
            </div>

            {/* 저장 방식 안내 */}
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.6 }}>
                관심종목은 이 기기에 저장됩니다. 로그인 불필요.
              </p>
            </div>

            {/* 피드백 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
              }}
            >
              <span style={{ fontSize: '14px', color: '#0F172A' }}>피드백 보내기</span>
              <span style={{ fontSize: '14px', color: '#94A3B8' }}>준비 중</span>
            </div>
          </div>
        </section>
      </div>

      <BottomNavigation />
      <Toast />
    </>
  );
}
