/**
 * CoStock 도메인 타입 정의 — 시장 데이터
 *
 * any 타입 절대 금지. 금융 도메인 특성상 타입 정밀도가 데이터 정확성과 직결됩니다.
 */

import type { AssetType } from '@/design-system';

// ─── 기본 종목 ────────────────────────────────────────────────────────────────

export interface Instrument {
  symbol: string;
  name: string;
  type: AssetType;
  exchange: string;
}

// ─── 가격 데이터 ──────────────────────────────────────────────────────────────

export interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changeRate: number;
  volume: number;
  timestamp: number; // Unix ms
}

export interface InstrumentWithPrice extends Instrument, PriceData {}

// ─── 시장 지수 ────────────────────────────────────────────────────────────────

export type MarketStatus = 'open' | 'closed' | 'pre' | 'after';

export interface MarketIndex {
  id: string;
  name: string;
  value: number;
  change: number;
  changeRate: number;
  status: MarketStatus;
  type: AssetType;
}

// ─── WebSocket 메시지 ─────────────────────────────────────────────────────────

/**
 * 심볼 포맷 규칙:
 *   - 주식: "005930" (6자리 숫자, KRX)
 *   - 코인: "KRW-BTC" (업비트 형식, KRW-{coin}) ← "BTC-KRW" 는 잘못된 형식
 */
export interface WsSubscribeMessage {
  type: 'subscribe';
  symbols: string[];
}

export interface WsUnsubscribeMessage {
  type: 'unsubscribe';
  symbols: string[];
}

export interface WsPriceUpdateMessage {
  type: 'price_update';
  data: PriceData;
}

export interface WsHeartbeatMessage {
  type: 'heartbeat';
  ts: number;
}

export type WsInboundMessage = WsPriceUpdateMessage | WsHeartbeatMessage;
export type WsOutboundMessage = WsSubscribeMessage | WsUnsubscribeMessage;

// ─── 검색 ─────────────────────────────────────────────────────────────────────

export interface SearchResult extends Instrument {
  /** 검색어 매칭 하이라이트용 원본 쿼리 */
  matchedQuery: string;
  /** 현재 가격 (없으면 표시 생략) */
  price?: number;
  /** 변동률 % (없으면 표시 생략) */
  changeRate?: number;
}

export interface RecentSearch {
  symbol: string;
  name: string;
  type: AssetType;
  searchedAt: number; // Unix ms
}

// ─── 탭 ───────────────────────────────────────────────────────────────────────

export type HomeTab = 'watchlist' | 'stock' | 'coin';

export const HOME_TAB_LABELS: Record<HomeTab, string> = {
  watchlist: '관심',
  stock: '주식',
  coin: '코인',
} as const;
