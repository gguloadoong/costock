import { NextResponse } from 'next/server';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BASE_PRICES: Record<string, number> = {
  '005930': 65400,
  '000660': 187500,
  '035420': 198000,
  '051910': 342000,
  '005380': 215000,
  '035720': 47850,
  '069500': 31250,
  'KRW-BTC': 94500000,
  'KRW-ETH': 5120000,
  'KRW-SOL': 198000,
  'KRW-XRP': 3250,
  'NVDA': 875.32,
  'AAPL': 214.56,
  'MSFT': 415.23,
  'TSLA': 187.64,
};

const INTERVAL_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
};

function generateCandles(basePrice: number, count: number, intervalMs: number): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  let price = basePrice;

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i * intervalMs;
    const volatility = 0.005;

    const openPrice = price;
    const change1 = (Math.random() - 0.5) * 2 * volatility;
    const change2 = (Math.random() - 0.5) * 2 * volatility;
    const closePrice = openPrice * (1 + change1);
    const highPrice = Math.max(openPrice, closePrice) * (1 + Math.random() * volatility * 0.5);
    const lowPrice = Math.min(openPrice, closePrice) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.floor(basePrice * (500 + Math.random() * 1000));

    candles.push({
      timestamp,
      open: parseFloat(openPrice.toFixed(2)),
      high: parseFloat(highPrice.toFixed(2)),
      low: parseFloat(lowPrice.toFixed(2)),
      close: parseFloat(closePrice.toFixed(2)),
      volume,
    });

    price = closePrice * (1 + (Math.random() - 0.5) * change2);
  }

  return candles;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') ?? '005930';
  const interval = searchParams.get('interval') ?? '1d';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);

  const basePrice = BASE_PRICES[symbol] ?? 10000;
  const intervalMs = INTERVAL_MS[interval] ?? INTERVAL_MS['1d'];

  const candles = generateCandles(basePrice, limit, intervalMs);

  return NextResponse.json({ data: candles, symbol, interval });
}
