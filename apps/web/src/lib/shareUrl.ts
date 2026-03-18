/**
 * shareUrl — 관심종목 URL 공유 인코딩/디코딩
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
