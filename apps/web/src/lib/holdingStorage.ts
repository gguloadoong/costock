const STORAGE_KEY = 'costock_holdings';

export interface Holding {
  symbol: string;
  name: string;
  type: 'stock' | 'coin';
  avgPrice: number;    // 평균 매수가
  quantity: number;    // 보유 수량
  updatedAt: number;
}

export function getHoldings(): Holding[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Holding[];
  } catch { return []; }
}

export function setHolding(holding: Omit<Holding, 'updatedAt'>): void {
  const holdings = getHoldings().filter(h => h.symbol !== holding.symbol);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([
    ...holdings,
    { ...holding, updatedAt: Date.now() }
  ]));
}

export function removeHolding(symbol: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(
    getHoldings().filter(h => h.symbol !== symbol)
  ));
}

export function calcPnL(holding: Holding, currentPrice: number): {
  pnl: number; pnlRate: number; totalValue: number; investValue: number;
} {
  const investValue = holding.avgPrice * holding.quantity;
  const totalValue = currentPrice * holding.quantity;
  const pnl = totalValue - investValue;
  const pnlRate = investValue > 0 ? (pnl / investValue) * 100 : 0;
  return { pnl, pnlRate, totalValue, investValue };
}
