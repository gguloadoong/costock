import { NextResponse } from 'next/server';
import { TRADERS } from '../../_data';

interface MonthlyPnl {
  year: number;
  month: number;
  realizedPnl: number;
  tradeCount: number;
  winCount: number;
  winRate: number;
}

const PNL_MAP: Record<string, MonthlyPnl[]> = {
  alpha: [
    { year: 2026, month: 3, realizedPnl: 213000, tradeCount: 12, winCount: 8, winRate: 0.67 },
    { year: 2026, month: 2, realizedPnl: 187000, tradeCount: 15, winCount: 10, winRate: 0.67 },
    { year: 2026, month: 1, realizedPnl: -45000, tradeCount: 10, winCount: 5, winRate: 0.5 },
    { year: 2025, month: 12, realizedPnl: 320000, tradeCount: 18, winCount: 13, winRate: 0.72 },
    { year: 2025, month: 11, realizedPnl: 156000, tradeCount: 14, winCount: 9, winRate: 0.64 },
    { year: 2025, month: 10, realizedPnl: -28000, tradeCount: 11, winCount: 5, winRate: 0.45 },
  ],
  beta: [
    { year: 2026, month: 3, realizedPnl: 187000, tradeCount: 14, winCount: 9, winRate: 0.64 },
    { year: 2026, month: 2, realizedPnl: 243000, tradeCount: 18, winCount: 11, winRate: 0.61 },
    { year: 2026, month: 1, realizedPnl: -92000, tradeCount: 12, winCount: 5, winRate: 0.42 },
    { year: 2025, month: 12, realizedPnl: 415000, tradeCount: 20, winCount: 13, winRate: 0.65 },
    { year: 2025, month: 11, realizedPnl: -67000, tradeCount: 16, winCount: 7, winRate: 0.44 },
    { year: 2025, month: 10, realizedPnl: 189000, tradeCount: 15, winCount: 9, winRate: 0.6 },
  ],
  gamma: [
    { year: 2026, month: 3, realizedPnl: 156000, tradeCount: 10, winCount: 7, winRate: 0.7 },
    { year: 2026, month: 2, realizedPnl: 198000, tradeCount: 12, winCount: 9, winRate: 0.75 },
    { year: 2026, month: 1, realizedPnl: 87000, tradeCount: 8, winCount: 6, winRate: 0.75 },
    { year: 2025, month: 12, realizedPnl: 287000, tradeCount: 14, winCount: 10, winRate: 0.71 },
    { year: 2025, month: 11, realizedPnl: 134000, tradeCount: 11, winCount: 8, winRate: 0.73 },
    { year: 2025, month: 10, realizedPnl: -42000, tradeCount: 9, winCount: 4, winRate: 0.44 },
  ],
  delta: [
    { year: 2026, month: 3, realizedPnl: 98000, tradeCount: 6, winCount: 5, winRate: 0.83 },
    { year: 2026, month: 2, realizedPnl: 112000, tradeCount: 8, winCount: 6, winRate: 0.75 },
    { year: 2026, month: 1, realizedPnl: 54000, tradeCount: 5, winCount: 4, winRate: 0.8 },
    { year: 2025, month: 12, realizedPnl: 143000, tradeCount: 7, winCount: 5, winRate: 0.71 },
    { year: 2025, month: 11, realizedPnl: 89000, tradeCount: 6, winCount: 5, winRate: 0.83 },
    { year: 2025, month: 10, realizedPnl: -23000, tradeCount: 5, winCount: 2, winRate: 0.4 },
  ],
  epsilon: [
    { year: 2026, month: 3, realizedPnl: 71000, tradeCount: 16, winCount: 9, winRate: 0.56 },
    { year: 2026, month: 2, realizedPnl: 145000, tradeCount: 22, winCount: 13, winRate: 0.59 },
    { year: 2026, month: 1, realizedPnl: -38000, tradeCount: 18, winCount: 8, winRate: 0.44 },
    { year: 2025, month: 12, realizedPnl: 198000, tradeCount: 25, winCount: 15, winRate: 0.6 },
    { year: 2025, month: 11, realizedPnl: 67000, tradeCount: 20, winCount: 11, winRate: 0.55 },
    { year: 2025, month: 10, realizedPnl: -54000, tradeCount: 19, winCount: 8, winRate: 0.42 },
  ],
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const trader = TRADERS.find((t) => t.id === params.id);

  if (!trader) {
    return NextResponse.json({ error: '트레이더를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  let pnlData = PNL_MAP[params.id] ?? [];

  if (yearParam) {
    const year = parseInt(yearParam, 10);
    pnlData = pnlData.filter((p) => p.year === year);
  }

  return NextResponse.json({ data: pnlData });
}
