import { NextResponse } from 'next/server';
import { TRADERS } from '../../_data';

interface Position {
  symbol: string;
  symbolName: string;
  assetType: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlRate: number;
  openedAt: string;
}

const POSITIONS_MAP: Record<string, Position[]> = {
  alpha: [
    {
      symbol: '005930',
      symbolName: '삼성전자',
      assetType: 'stock_kr',
      quantity: 10,
      avgPrice: 62000,
      currentPrice: 65400,
      unrealizedPnl: 34000,
      unrealizedPnlRate: 0.0548,
      openedAt: '2026-03-15T09:00:00.000Z',
    },
    {
      symbol: '000660',
      symbolName: 'SK하이닉스',
      assetType: 'stock_kr',
      quantity: 3,
      avgPrice: 178000,
      currentPrice: 187500,
      unrealizedPnl: 28500,
      unrealizedPnlRate: 0.0534,
      openedAt: '2026-03-10T09:30:00.000Z',
    },
  ],
  beta: [
    {
      symbol: 'KRW-BTC',
      symbolName: '비트코인',
      assetType: 'crypto',
      quantity: 0.05,
      avgPrice: 88000000,
      currentPrice: 94500000,
      unrealizedPnl: 325000,
      unrealizedPnlRate: 0.0739,
      openedAt: '2026-03-12T14:00:00.000Z',
    },
    {
      symbol: 'KRW-ETH',
      symbolName: '이더리움',
      assetType: 'crypto',
      quantity: 0.5,
      avgPrice: 4850000,
      currentPrice: 5120000,
      unrealizedPnl: 135000,
      unrealizedPnlRate: 0.0557,
      openedAt: '2026-03-14T10:00:00.000Z',
    },
  ],
  gamma: [
    {
      symbol: 'NVDA',
      symbolName: 'NVIDIA',
      assetType: 'stock_us',
      quantity: 5,
      avgPrice: 820.0,
      currentPrice: 875.32,
      unrealizedPnl: 276.6,
      unrealizedPnlRate: 0.0675,
      openedAt: '2026-03-08T15:30:00.000Z',
    },
    {
      symbol: 'AAPL',
      symbolName: '애플',
      assetType: 'stock_us',
      quantity: 10,
      avgPrice: 205.0,
      currentPrice: 214.56,
      unrealizedPnl: 95.6,
      unrealizedPnlRate: 0.0466,
      openedAt: '2026-03-11T16:00:00.000Z',
    },
  ],
  delta: [
    {
      symbol: '069500',
      symbolName: 'KODEX 200',
      assetType: 'etf_kr',
      quantity: 50,
      avgPrice: 30200,
      currentPrice: 31250,
      unrealizedPnl: 52500,
      unrealizedPnlRate: 0.0348,
      openedAt: '2026-03-05T09:00:00.000Z',
    },
  ],
  epsilon: [
    {
      symbol: '005930',
      symbolName: '삼성전자',
      assetType: 'stock_kr',
      quantity: 5,
      avgPrice: 63500,
      currentPrice: 65400,
      unrealizedPnl: 9500,
      unrealizedPnlRate: 0.0299,
      openedAt: '2026-03-17T09:15:00.000Z',
    },
    {
      symbol: 'KRW-BTC',
      symbolName: '비트코인',
      assetType: 'crypto',
      quantity: 0.02,
      avgPrice: 92000000,
      currentPrice: 94500000,
      unrealizedPnl: 50000,
      unrealizedPnlRate: 0.0272,
      openedAt: '2026-03-18T11:00:00.000Z',
    },
  ],
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const trader = TRADERS.find((t) => t.id === params.id);

  if (!trader) {
    return NextResponse.json({ error: '트레이더를 찾을 수 없습니다.' }, { status: 404 });
  }

  const positions = POSITIONS_MAP[params.id] ?? [];

  return NextResponse.json({ data: positions });
}
