/**
 * Sparkline — 미니 차트 컴포넌트
 *
 * SVG 기반의 간단한 스파크라인. 7일 또는 1시간 가격 변동을 시각화합니다.
 * 색상: 상승(빨강) / 하락(파랑) / 보합(회색)
 *
 * 사용 예:
 *   <Sparkline data={[100, 102, 101, 103, 102, 104, 105]} />
 */

import React from 'react';

export interface SparklineProps {
  /** 차트에 표시할 가격 데이터 (최소 2개 포인트) */
  data: number[];
  /** SVG 너비 (기본: 64px) */
  width?: number;
  /** SVG 높이 (기본: 24px) */
  height?: number;
  /** 선 색상 (선택사항, 기본: 상승=빨강, 하락=파랑, 보합=회색) */
  color?: string;
  /** CSS 클래스 */
  className?: string;
  /** Accessibility 레이블 */
  ariaLabel?: string;
}

/**
 * Sparkline 컴포넌트
 *
 * 가격 배열을 받아 최소/최대를 기준으로 정규화하고,
 * 스무스한 곡선으로 그립니다.
 */
export function Sparkline({
  data,
  width = 64,
  height = 24,
  color,
  className = '',
  ariaLabel,
}: SparklineProps): React.ReactElement | null {
  // 데이터 유효성 검사
  if (!data || data.length < 2) {
    return null;
  }

  // 최소/최대 값으로 정규화
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // 0 으로 나누기 방지

  // 좌표 계산: (x, y) 포인트 배열
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // 색상 결정: 마지막 포인트 vs 첫 포인트
  const lineColor =
    color ??
    (data[data.length - 1] >= data[0]
      ? 'var(--kr-rise)' // 상승 → 빨강 (#E84040)
      : 'var(--kr-fall)'); // 하락 → 파랑 (#2563EB)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-label={ariaLabel}
      role="img"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    >
      <polyline
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default Sparkline;
