/**
 * 개발용 mock 데이터 — API 연동 전 임시
 */

import type { InstrumentWithPrice, MarketIndex } from '@/types/market';
import type { WatchlistItem } from '@/lib/watchlistStorage';

export const MOCK_INDICES: MarketIndex[] = [
  {
    id: 'kospi',
    name: 'KOSPI',
    value: 2_612.35,
    change: 18.42,
    changeRate: 0.71,
    status: 'open',
    type: 'stock',
  },
  {
    id: 'kosdaq',
    name: 'KOSDAQ',
    value: 871.54,
    change: -3.21,
    changeRate: -0.37,
    status: 'open',
    type: 'stock',
  },
  {
    id: 'btc',
    name: 'BTC',
    value: 142_850_000,
    change: 2_150_000,
    changeRate: 1.53,
    status: 'open',
    type: 'coin',
  },
  {
    id: 'eth',
    name: 'ETH',
    value: 5_420_000,
    change: -88_000,
    changeRate: -1.60,
    status: 'open',
    type: 'coin',
  },
];

export const MOCK_STOCKS: InstrumentWithPrice[] = [
  {
    symbol: '005930',
    name: '삼성전자',
    type: 'stock',
    exchange: 'KOSPI',
    price: 85_400,
    change: 1_200,
    changeRate: 1.43,
    volume: 12_345_678,
    timestamp: Date.now(),
  },
  {
    symbol: '000660',
    name: 'SK하이닉스',
    type: 'stock',
    exchange: 'KOSPI',
    price: 198_500,
    change: -2_500,
    changeRate: -1.24,
    volume: 3_812_091,
    timestamp: Date.now(),
  },
  {
    symbol: '035720',
    name: '카카오',
    type: 'stock',
    exchange: 'KOSPI',
    price: 43_250,
    change: 350,
    changeRate: 0.82,
    volume: 7_204_332,
    timestamp: Date.now(),
  },
  {
    symbol: '035420',
    name: 'NAVER',
    type: 'stock',
    exchange: 'KOSPI',
    price: 212_500,
    change: 0,
    changeRate: 0,
    volume: 1_923_410,
    timestamp: Date.now(),
  },
  {
    symbol: '051910',
    name: 'LG화학',
    type: 'stock',
    exchange: 'KOSPI',
    price: 328_000,
    change: 9_000,
    changeRate: 2.82,
    volume: 944_210,
    timestamp: Date.now(),
  },
];

export const MOCK_COINS: InstrumentWithPrice[] = [
  {
    symbol: 'KRW-BTC',
    name: '비트코인',
    type: 'coin',
    exchange: 'UPBIT',
    price: 142_850_000,
    change: 2_150_000,
    changeRate: 1.53,
    volume: 8_204,
    timestamp: Date.now(),
  },
  {
    symbol: 'KRW-ETH',
    name: '이더리움',
    type: 'coin',
    exchange: 'UPBIT',
    price: 5_420_000,
    change: -88_000,
    changeRate: -1.60,
    volume: 42_910,
    timestamp: Date.now(),
  },
  {
    symbol: 'KRW-XRP',
    name: '리플',
    type: 'coin',
    exchange: 'UPBIT',
    price: 3_845,
    change: 124,
    changeRate: 3.33,
    volume: 1_204_885,
    timestamp: Date.now(),
  },
  {
    symbol: 'KRW-SOL',
    name: '솔라나',
    type: 'coin',
    exchange: 'UPBIT',
    price: 298_500,
    change: -4_200,
    changeRate: -1.39,
    volume: 32_091,
    timestamp: Date.now(),
  },
  {
    symbol: 'KRW-ADA',
    name: '에이다',
    type: 'coin',
    exchange: 'UPBIT',
    price: 1_245,
    change: 38,
    changeRate: 3.15,
    volume: 4_882_001,
    timestamp: Date.now(),
  },
];

// 퀵 추가 5종목 (온보딩용)
export const QUICK_ADD_SYMBOLS: WatchlistItem[] = [
  { id: '005930', type: 'stock', name: '삼성전자', addedAt: 0 },
  { id: '000660', type: 'stock', name: 'SK하이닉스', addedAt: 0 },
  { id: 'KRW-BTC', type: 'coin', name: '비트코인', addedAt: 0 },
  { id: 'KRW-ETH', type: 'coin', name: '이더리움', addedAt: 0 },
  { id: '035420', type: 'stock', name: 'NAVER', addedAt: 0 },
];

export const ALL_MOCK: InstrumentWithPrice[] = [...MOCK_STOCKS, ...MOCK_COINS];
