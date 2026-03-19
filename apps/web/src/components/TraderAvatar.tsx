'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   TraderAvatar — AI 트레이더 원형 아바타
   - 트레이더 고유 색상 배경 + 이모지 아바타
   - sm(32) / md(44) / lg(60) 세 가지 크기
   - 실시간 거래 중일 때 pulse 링 효과 (.trader-pulse-ring)
───────────────────────────────────────────────────────────────────────────── */

export type TraderId = 'alpha' | 'beta' | 'gamma';

export interface TraderConfig {
  id: TraderId;
  name: string;
  emoji: string;
  color: string;       /* 텍스트·링 색상 */
  bgColor: string;     /* 아바타 배경 */
  ringColor: string;   /* pulse 링 색상 (rgba) */
}

export const TRADERS: Record<TraderId, TraderConfig> = {
  alpha: {
    id: 'alpha',
    name: '알파',
    emoji: '🟣',
    color: '#6366F1',
    bgColor: '#EEF2FF',
    ringColor: 'rgba(99, 102, 241, 0.40)',
  },
  beta: {
    id: 'beta',
    name: '베타',
    emoji: '🟡',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    ringColor: 'rgba(245, 158, 11, 0.40)',
  },
  gamma: {
    id: 'gamma',
    name: '감마',
    emoji: '🟢',
    color: '#10B981',
    bgColor: '#ECFDF5',
    ringColor: 'rgba(16, 185, 129, 0.40)',
  },
};

type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<AvatarSize, { px: number; fontSize: number; ringOffset: number; ringThickness: number }> = {
  sm: { px: 32, fontSize: 14, ringOffset: 3, ringThickness: 2 },
  md: { px: 44, fontSize: 20, ringOffset: 4, ringThickness: 2.5 },
  lg: { px: 60, fontSize: 28, ringOffset: 5, ringThickness: 3 },
};

interface TraderAvatarProps {
  trader: TraderId | TraderConfig;
  size?: AvatarSize;
  /** 실시간 거래 중 여부 — true면 pulse 링 표시 */
  isActive?: boolean;
  className?: string;
}

export default function TraderAvatar({
  trader,
  size = 'md',
  isActive = false,
  className,
}: TraderAvatarProps) {
  const config: TraderConfig =
    typeof trader === 'string' ? TRADERS[trader] : trader;

  const { px, fontSize, ringOffset, ringThickness } = SIZE_MAP[size];
  const containerSize = px + (isActive ? ringOffset * 2 + ringThickness * 2 : 0);

  return (
    <span
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: containerSize,
        height: containerSize,
        flexShrink: 0,
      }}
      aria-label={`${config.name} 트레이더`}
    >
      {/* pulse 링 — 실시간 거래 중일 때만 렌더 */}
      {isActive && (
        <span
          className="trader-pulse-ring"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `${ringThickness}px solid ${config.ringColor}`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 아바타 원형 */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: px,
          height: px,
          borderRadius: '50%',
          backgroundColor: config.bgColor,
          border: `1.5px solid ${config.color}22`,
          fontSize,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {config.emoji}
      </span>
    </span>
  );
}
