export interface PriceAlert {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'coin';
  condition: 'above' | 'below';
  targetPrice: number;
  currentPrice: number;
  createdAt: number;
  triggered: boolean;
}

const STORAGE_KEY = 'costock_alerts';

export function getAlerts(): PriceAlert[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? (JSON.parse(data) as PriceAlert[]) : [];
  } catch {
    return [];
  }
}

export function addAlert(alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>): PriceAlert {
  const alerts = getAlerts();
  const newAlert: PriceAlert = {
    ...alert,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    triggered: false,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...alerts, newAlert]));
  return newAlert;
}

export function removeAlert(id: string): void {
  const alerts = getAlerts().filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

export function markAlertTriggered(id: string): void {
  const alerts = getAlerts().map((a) =>
    a.id === id ? { ...a, triggered: true } : a
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

export function checkAlerts(symbol: string, price: number): PriceAlert[] {
  const alerts = getAlerts();
  const triggered: PriceAlert[] = [];
  for (const alert of alerts) {
    if (alert.symbol !== symbol || alert.triggered) continue;
    if (alert.condition === 'above' && price >= alert.targetPrice) triggered.push(alert);
    if (alert.condition === 'below' && price <= alert.targetPrice) triggered.push(alert);
  }
  return triggered;
}
