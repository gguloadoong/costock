/**
 * CoStock Typography Tokens
 *
 * Font strategy:
 *   - Pretendard: Korean body text (superior CJK rendering)
 *   - Roboto Mono: All numeric/financial data (tabular alignment critical)
 */

// ─── Font Families ────────────────────────────────────────────────────────────
export const fontFamily = {
  /** Korean body text — Pretendard with system fallbacks */
  sans: "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
  /** Financial numbers — monospace for column alignment */
  mono: "'Roboto Mono', 'SF Mono', 'Fira Code', monospace",
} as const;

// ─── Font Sizes ───────────────────────────────────────────────────────────────
export const fontSize = {
  'heading-xl': '28px',  // Symbol name header
  'heading-lg': '22px',  // Section titles
  'heading-md': '18px',  // Card titles
  'body-lg':    '16px',  // Body text
  'body-md':    '14px',  // Secondary info
  'caption':    '12px',  // Meta info / timestamps

  // Mono numeric scale (Roboto Mono)
  'mono-xl':    '24px',  // Current price (현재가)
  'mono-lg':    '18px',  // Change rate (변동률)
  'mono-md':    '14px',  // Other numeric values
} as const;

// ─── Font Weights ─────────────────────────────────────────────────────────────
export const fontWeight = {
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
} as const;

// ─── Line Heights ─────────────────────────────────────────────────────────────
export const lineHeight = {
  tight:   '1.2',
  snug:    '1.375',
  normal:  '1.5',
  relaxed: '1.625',
} as const;

// ─── Composite Type Scale (convenience) ──────────────────────────────────────
export const typeScale = {
  'heading-xl': {
    fontFamily: fontFamily.sans,
    fontSize:   fontSize['heading-xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
  },
  'heading-lg': {
    fontFamily: fontFamily.sans,
    fontSize:   fontSize['heading-lg'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
  },
  'heading-md': {
    fontFamily: fontFamily.sans,
    fontSize:   fontSize['heading-md'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
  },
  'body-lg': {
    fontFamily: fontFamily.sans,
    fontSize:   fontSize['body-lg'],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
  },
  'body-md': {
    fontFamily: fontFamily.sans,
    fontSize:   fontSize['body-md'],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
  },
  'caption': {
    fontFamily: fontFamily.sans,
    fontSize:   fontSize['caption'],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
  },
  'mono-xl': {
    fontFamily: fontFamily.mono,
    fontSize:   fontSize['mono-xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
  },
  'mono-lg': {
    fontFamily: fontFamily.mono,
    fontSize:   fontSize['mono-lg'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
  },
  'mono-md': {
    fontFamily: fontFamily.mono,
    fontSize:   fontSize['mono-md'],
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.tight,
  },
} as const;

// ─── Composite export ─────────────────────────────────────────────────────────
export const typography = {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  typeScale,
} as const;

export type Typography = typeof typography;
