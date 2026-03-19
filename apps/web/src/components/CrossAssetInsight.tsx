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
  else if (stocksLeading) { message = '주식이 코인보다 강세'; emoji = '📊'; }
  else if (coinsLeading) { message = '코인이 주식보다 강세'; emoji = '💎'; }
  else { message = '주식·코인 혼조세'; emoji = '↔️'; }

  const fmtChange = (v: number) =>
    `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

  return (
    <div style={{ margin: '0 16px 12px', padding: '12px', background: '#F9FAFB', borderRadius: '16px', border: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px' }}>{emoji}</span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#4B5563' }}>{message}</span>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>주식 {stocks.count}종목</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: stocks.avgChange > 0 ? '#E84040' : stocks.avgChange < 0 ? '#2563EB' : '#6B7280' }}>
            {fmtChange(stocks.avgChange)}
          </span>
        </div>
        <div style={{ width: '1px', background: '#E5E7EB' }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>코인 {coins.count}종목</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: coins.avgChange > 0 ? '#E84040' : coins.avgChange < 0 ? '#2563EB' : '#6B7280' }}>
            {fmtChange(coins.avgChange)}
          </span>
        </div>
      </div>
    </div>
  );
}
