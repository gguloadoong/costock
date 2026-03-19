import { NextResponse } from 'next/server';

interface PriceData {
  symbol: string;
  price: number;
  changeRate: number;
  updatedAt: string;
  assetType: string;
}

const PRICE_MAP: Record<string, PriceData> = {
  '005930': { symbol: '005930', price: 65400, changeRate: 0.0054, updatedAt: '2026-03-20T09:00:00Z', assetType: 'stock' },
  '000660': { symbol: '000660', price: 187500, changeRate: 0.0122, updatedAt: '2026-03-20T09:00:00Z', assetType: 'stock' },
  '035420': { symbol: '035420', price: 198000, changeRate: -0.0025, updatedAt: '2026-03-20T09:00:00Z', assetType: 'stock' },
  '051910': { symbol: '051910', price: 342000, changeRate: 0.0088, updatedAt: '2026-03-20T09:00:00Z', assetType: 'stock' },
  '005380': { symbol: '005380', price: 215000, changeRate: 0.0046, updatedAt: '2026-03-20T09:00:00Z', assetType: 'stock' },
  '035720': { symbol: '035720', price: 47850, changeRate: -0.0031, updatedAt: '2026-03-20T09:00:00Z', assetType: 'stock' },
  '069500': { symbol: '069500', price: 31250, changeRate: 0.005, updatedAt: '2026-03-20T09:00:00Z', assetType: 'etf' },
  'KRW-BTC': { symbol: 'KRW-BTC', price: 94500000, changeRate: 0.0161, updatedAt: '2026-03-20T09:00:00Z', assetType: 'crypto' },
  'KRW-ETH': { symbol: 'KRW-ETH', price: 5120000, changeRate: 0.0094, updatedAt: '2026-03-20T09:00:00Z', assetType: 'crypto' },
  'KRW-SOL': { symbol: 'KRW-SOL', price: 198000, changeRate: -0.0213, updatedAt: '2026-03-20T09:00:00Z', assetType: 'crypto' },
  'KRW-XRP': { symbol: 'KRW-XRP', price: 3250, changeRate: 0.0378, updatedAt: '2026-03-20T09:00:00Z', assetType: 'crypto' },
  'NVDA': { symbol: 'NVDA', price: 875.32, changeRate: 0.0221, updatedAt: '2026-03-20T09:00:00Z', assetType: 'stock' },
  'AAPL': { symbol: 'AAPL', price: 214.56, changeRate: 0.0087, updatedAt: '2026-03-20T09:00:00Z', assetType: 'stock' },
  'MSFT': { symbol: 'MSFT', price: 415.23, changeRate: 0.0043, updatedAt: '2026-03-20T09:00:00Z', assetType: 'stock' },
  'TSLA': { symbol: 'TSLA', price: 187.64, changeRate: -0.0312, updatedAt: '2026-03-20T09:00:00Z', assetType: 'stock' },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');

  const updatedAt = '2026-03-20T09:00:00Z';

  if (!symbolsParam) {
    return NextResponse.json({ data: Object.values(PRICE_MAP), updatedAt });
  }

  const requestedSymbols = symbolsParam.split(',').map((s) => s.trim()).filter(Boolean);
  const data = requestedSymbols.map((sym) => PRICE_MAP[sym]).filter(Boolean) as PriceData[];

  return NextResponse.json({ data, updatedAt });
}
