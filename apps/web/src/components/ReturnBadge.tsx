'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   ReturnBadge — 수익률 배지 컴포넌트
   - 누적수익률 크게 표시 (퍼센트 + 절대금액 함께 표시 옵션)
   - 수익: 빨강(#E84040), 손실: 파랑(#2563EB), 보합: 회색(#6B7280)
   - sm / md / lg 세 가지 크기
   - .return-counter 애니메이션 적용 가능
───────────────────────────────────────────────────────────────────────────── */

export type ReturnSize = 'sm' | 'md' | 'lg';

interface ReturnBadgeProps {
  /** 수익률 (%) — 양수=수익, 음수=손실, undefined=보합 */
  returnRate?: number;
  /** 손익 절대금액 — 함께 표시할 때 사용 */
  returnAmount?: number;
  /** 통화 단위 (기본: '원') */
  currency?: string;
  /** 크기 */
  size?: ReturnSize;
  /** 애니메이션 클래스 적용 여부 */
  animate?: boolean;
  className?: string;
}

interface SizeConfig {
  rateFontSize: number;
  amountFontSize: number;
  padding: string;
  borderRadius: number;
  gap: number;
}

const SIZE_CONFIG: Record<ReturnSize, SizeConfig> = {
  sm: {
    rateFontSize: 12,
    amountFontSize: 11,
    padding: '2px 7px',
    borderRadius: 5,
    gap: 4,
  },
  md: {
    rateFontSize: 18,
    amountFontSize: 13,
    padding: '5px 12px',
    borderRadius: 8,
    gap: 6,
  },
  lg: {
    rateFontSize: 28,
    amountFontSize: 15,
    padding: '8px 18px',
    borderRadius: 12,
    gap: 8,
  },
};

function getReturnColors(rate: number | undefined): {
  text: string;
  bg: string;
  border: string;
} {
  if (rate === undefined || rate === 0) {
    return {
      text: '#6B7280',
      bg: 'rgba(107, 114, 128, 0.08)',
      border: 'rgba(107, 114, 128, 0.20)',
    };
  }
  if (rate > 0) {
    return {
      text: '#E84040',
      bg: 'rgba(232, 64, 64, 0.08)',
      border: 'rgba(232, 64, 64, 0.22)',
    };
  }
  return {
    text: '#2563EB',
    bg: 'rgba(37, 99, 235, 0.08)',
    border: 'rgba(37, 99, 235, 0.22)',
  };
}

function formatRate(rate: number): string {
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(2)}%`;
}

function formatAmount(amount: number, currency: string): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${Math.abs(amount).toLocaleString('ko-KR')}${currency}`;
}

export default function ReturnBadge({
  returnRate,
  returnAmount,
  currency = '원',
  size = 'md',
  animate = false,
  className,
}: ReturnBadgeProps) {
  const colors = getReturnColors(returnRate);
  const cfg = SIZE_CONFIG[size];
  const hasAmount = returnAmount !== undefined;

  return (
    <span
      className={[animate ? 'return-counter' : '', className ?? '']
        .filter(Boolean)
        .join(' ') || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: cfg.gap,
        padding: cfg.padding,
        borderRadius: cfg.borderRadius,
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {/* 수익률 퍼센트 — 핵심 숫자, 가장 크게 */}
      <span
        style={{
          fontSize: cfg.rateFontSize,
          fontWeight: 700,
          fontFamily: "'Roboto Mono', monospace",
          color: colors.text,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {returnRate !== undefined ? formatRate(returnRate) : '0.00%'}
      </span>

      {/* 절대금액 — 옵션 */}
      {hasAmount && (
        <span
          style={{
            fontSize: cfg.amountFontSize,
            fontWeight: 500,
            fontFamily: "'Roboto Mono', monospace",
            color: colors.text,
            opacity: 0.75,
            lineHeight: 1,
          }}
        >
          {formatAmount(returnAmount!, currency)}
        </span>
      )}
    </span>
  );
}
