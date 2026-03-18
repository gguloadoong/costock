/**
 * shareUrl — 관심종목 URL 공유 인코딩/디코딩 + 종목 딥링크 공유
 *
 * 형식: ?w=KR_005930,KRW-BTC
 */

import type { WatchlistItem } from './watchlistStorage';

/**
 * 관심종목 목록 → URL 파라미터 값 (id 쉼표 구분)
 */
export function encodeWatchlistUrl(items: WatchlistItem[]): string {
  return items.map((i) => i.id).join(',');
}

/**
 * URL 파라미터 값 → id 배열
 */
export function decodeWatchlistParam(param: string): string[] {
  if (!param.trim()) return [];
  return param
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 현재 origin + ?w= + 인코딩된 관심종목 목록
 */
export function buildShareUrl(items: WatchlistItem[]): string {
  const encoded = encodeWatchlistUrl(items);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}?w=${encoded}`;
}

/**
 * 주식 종목 딥링크 URL
 */
export function buildStockShareUrl(symbol: string, _name: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://costock.app';
  return `${base}/stock/${symbol}`;
}

/**
 * 코인 종목 딥링크 URL
 */
export function buildCoinShareUrl(symbol: string, _name: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://costock.app';
  return `${base}/coin/${symbol}`;
}

/**
 * 종목/코인 공유 — Web Share API 우선, 미지원 시 클립보드 복사
 */
export async function shareAsset(symbol: string, name: string, type: 'stock' | 'coin', price: number): Promise<void> {
  const url = type === 'coin' ? buildCoinShareUrl(symbol, name) : buildStockShareUrl(symbol, name);
  const text = `${name} 현재가: ${price.toLocaleString()}원`;

  if (navigator.share) {
    await navigator.share({ title: `${name} | CoStock`, text, url });
  } else {
    await navigator.clipboard.writeText(`${text}\n${url}`);
  }
}
