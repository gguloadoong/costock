/**
 * 한국 금융 앱 숫자 포맷 유틸리티
 */

/** 원화 표시: 75,300원 */
export function formatKRW(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(1)}조원`;
  }
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(0)}억원`;
  }
  return `${value.toLocaleString('ko-KR')}원`;
}

/** 변동률: +2.34% / -1.56% */
export function formatChangeRate(rate: number): string {
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${rate.toFixed(2)}%`;
}

/** 변동액: +1,200 / -500 */
export function formatChangeDiff(diff: number): string {
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toLocaleString('ko-KR')}`;
}

/** 거래량: 1.2M / 340K */
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(0)}K`;
  return volume.toLocaleString('ko-KR');
}

/** 시가총액: 1.2조 / 340억 */
export function formatMarketCap(value: number): string {
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}조`;
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(0)}억`;
  return value.toLocaleString('ko-KR');
}

/** 가격 컬러 클래스 (한국 금융: 상승=빨강, 하락=파랑) */
export function getPriceColorClass(change: number): string {
  if (change > 0) return 'text-[#E84040]';
  if (change < 0) return 'text-[#2563EB]';
  return 'text-gray-500';
}

/** 가격 컬러 (인라인 style용) */
export function getPriceColor(change: number): string {
  if (change > 0) return '#E84040';
  if (change < 0) return '#2563EB';
  return '#6B7280';
}
