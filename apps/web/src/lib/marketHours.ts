// src/lib/marketHours.ts

export type MarketStatus = 'open' | 'pre' | 'after' | 'closed';

export interface MarketInfo {
  status: MarketStatus;
  label: string;      // "장중" | "프리마켓" | "애프터마켓" | "장마감"
  color: string;      // tailwind text color class
}

// 2026년 한국 공휴일 (YYYY-MM-DD)
const KR_HOLIDAYS_2026 = [
  '2026-01-01', '2026-01-28', '2026-01-29', '2026-01-30',
  '2026-03-01', '2026-05-05', '2026-05-25', '2026-06-06',
  '2026-08-15', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-10-03', '2026-10-09', '2026-12-25',
];

function getKSTDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 9 * 3600000);
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getStockMarketInfo(): MarketInfo {
  const kst = getKSTDate();
  const dow = kst.getDay(); // 0=일, 6=토
  const dateStr = toDateString(kst);
  const minutes = kst.getHours() * 60 + kst.getMinutes();

  const isWeekend = dow === 0 || dow === 6;
  const isHoliday = KR_HOLIDAYS_2026.includes(dateStr);

  if (isWeekend || isHoliday) {
    return { status: 'closed', label: '장마감', color: 'text-gray-400' };
  }

  if (minutes >= 8 * 60 && minutes < 9 * 60) {
    return { status: 'pre', label: '프리마켓', color: 'text-yellow-500' };
  }
  if (minutes >= 9 * 60 && minutes < 15 * 60 + 30) {
    return { status: 'open', label: '장중', color: 'text-green-500' };
  }
  if (minutes >= 15 * 60 + 30 && minutes < 18 * 60) {
    return { status: 'after', label: '애프터마켓', color: 'text-orange-400' };
  }
  return { status: 'closed', label: '장마감', color: 'text-gray-400' };
}

export function getCoinMarketInfo(): MarketInfo {
  return { status: 'open', label: '24시간', color: 'text-green-500' };
}

export function isStockMarketOpen(): boolean {
  return getStockMarketInfo().status === 'open';
}
