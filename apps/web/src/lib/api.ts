// ─── API 기본 설정 ────────────────────────────────────────────────────────────

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3101';

// ─── 트레이더 타입 ─────────────────────────────────────────────────────────────

export interface TraderStat {
  totalReturn: number;        // 소수점 (0.234 = 23.4%)
  totalReturnAmount: number;
  winRate: number;            // 소수점 (1.0 = 100%)
  totalTrades: number;
  portfolioValue: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export type AssetType = 'stock_kr' | 'stock_us' | 'crypto';

export interface Trader {
  rank: number;
  id: string;
  nameKr: string;
  strategy: string;
  strategyDesc: string;
  assetType: AssetType;
  stats: TraderStat;
  isSimulated: boolean;
}

// ─── 포지션 / 매매 / 손익 타입 ────────────────────────────────────────────────

export type TradeType = 'buy' | 'sell';
export type TradeAsset = 'stock' | 'coin' | 'us_stock';

export interface TradeRecord {
  id: string;
  type: TradeType;
  asset: TradeAsset;
  name: string;
  price: number;
  quantity: number;
  timestamp: string;
  pnl?: number;
  /** AI 트레이더의 매매 이유 (없을 수 있음) */
  reason?: string;
}

export interface Position {
  id: string;
  name: string;
  asset: TradeAsset;
  buyPrice: number;
  currentPrice: number;
  quantity: number;
  returnRate: number;
}

// ─── API 원시 응답 타입 (서버 실제 구조) ──────────────────────────────────────

export interface RawPosition {
  symbol: string;
  symbolName: string;
  assetType: 'stock_kr' | 'stock_us' | 'crypto';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlRate: number;
  openedAt: string;
}

export interface RawTradeRecord {
  id: string;
  traderId: string;
  symbol: string;
  symbolName: string;
  assetType: 'stock_kr' | 'stock_us' | 'crypto';
  action: 'buy' | 'sell';
  price: number;
  quantity: number;
  amount: number;
  realizedPnl: number | null;
  reason: string;
  timestamp: string;
  isSimulated: boolean;
}

export interface RawPnlMonth {
  year: number;
  month: number;
  realizedPnl: number;
  tradeCount: number;
  winCount: number;
  winRate: number;
}

// ─── 매핑 유틸리티 ────────────────────────────────────────────────────────────

function mapAssetType(assetType: 'stock_kr' | 'stock_us' | 'crypto'): TradeAsset {
  if (assetType === 'crypto') return 'coin';
  if (assetType === 'stock_us') return 'us_stock';
  return 'stock';
}

export function mapPosition(raw: RawPosition): Position {
  return {
    id: raw.symbol,
    name: raw.symbolName,
    asset: mapAssetType(raw.assetType),
    buyPrice: raw.avgPrice,
    currentPrice: raw.currentPrice,
    quantity: raw.quantity,
    returnRate: raw.unrealizedPnlRate,
  };
}

export function mapTradeRecord(raw: RawTradeRecord): TradeRecord {
  const record: TradeRecord = {
    id: raw.id,
    type: raw.action,
    asset: mapAssetType(raw.assetType),
    name: raw.symbolName,
    price: raw.price,
    quantity: raw.quantity,
    timestamp: raw.timestamp,
  };
  if (raw.realizedPnl !== null) record.pnl = raw.realizedPnl;
  if (raw.reason) record.reason = raw.reason;
  return record;
}

export function mapPnlMonth(raw: RawPnlMonth): PnlMonth {
  const monthStr = String(raw.month).padStart(2, '0');
  return {
    label: `${raw.year}년 ${raw.month}월`,
    totalPnl: raw.realizedPnl,
    tradeCount: raw.tradeCount,
    winRate: raw.winRate,
    entries: [
      {
        id: `${raw.year}-${monthStr}`,
        name: `${raw.year}년 ${raw.month}월 합계`,
        date: `${raw.year}-${monthStr}`,
        pnl: raw.realizedPnl,
        type: 'sell' as TradeType,
      },
    ],
  };
}

export interface PnlEntry {
  id: string;
  name: string;
  date: string;
  pnl: number;
  type: TradeType;
}

export interface PnlMonth {
  label: string;
  totalPnl: number;
  tradeCount: number;
  winRate: number;
  entries: PnlEntry[];
}

// ─── WebSocket 이벤트 타입 ─────────────────────────────────────────────────────

export interface TraderWsEvent {
  type: 'trade_event';
  traderId: string;
  trade: TradeRecord;
}

// ─── API 응답 래퍼 ─────────────────────────────────────────────────────────────

export interface ApiListResponse<T> {
  data: T[];
  total?: number;
}

export interface ApiItemResponse<T> {
  data: T;
}
