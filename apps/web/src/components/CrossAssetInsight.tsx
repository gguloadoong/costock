'use client';

interface AssetGroup {
  label: string;
  avgChange: number;
  count: number;
}

interface CrossAssetInsightProps {
  stocks: AssetGroup;
  coins: AssetGroup;
}

export function CrossAssetInsight({ stocks, coins }: CrossAssetInsightProps) {
  // 시장 분위기 판단
  const bothRising = stocks.avgChange > 0 && coins.avgChange > 0;
  const bothFalling = stocks.avgChange < 0 && coins.avgChange < 0;
  const stocksLeading = stocks.avgChange > coins.avgChange + 0.5;
  const coinsLeading = coins.avgChange > stocks.avgChange + 0.5;

  let message = '';
  let emoji = '';
  if (bothRising) { message = '주식·코인 동반 상승 중'; emoji = '📈'; }
  else if (bothFalling) { message = '전체 시장 약세 흐름'; emoji = '📉'; }
  else if (stocksLeading) { message = '주식이 코인보다 강세'; emoji = '🏦'; }
  else if (coinsLeading) { message = '코인이 주식보다 강세'; emoji = '💎'; }
  else { message = '주식·코인 혼조세'; emoji = '↔️'; }

  const fmtChange = (v: number) =>
    `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

  return (
    <div className="mx-4 mb-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{emoji}</span>
        <span className="text-xs font-medium text-gray-600">{message}</span>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 flex items-center justify-between">
          <span className="text-xs text-gray-400">주식 {stocks.count}종목</span>
          <span
            className="text-xs font-semibold"
            style={{ color: stocks.avgChange >= 0 ? '#E84040' : '#2563EB' }}
          >
            {fmtChange(stocks.avgChange)}
          </span>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="flex-1 flex items-center justify-between">
          <span className="text-xs text-gray-400">코인 {coins.count}종목</span>
          <span
            className="text-xs font-semibold"
            style={{ color: coins.avgChange >= 0 ? '#E84040' : '#2563EB' }}
          >
            {fmtChange(coins.avgChange)}
          </span>
        </div>
      </div>
    </div>
  );
}
