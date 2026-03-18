/**
 * CoStock Color Tokens
 * Based on Coinbase Design System (CDS) philosophy with Korean financial market overrides.
 *
 * IMPORTANT: Korean financial convention is opposite to Western markets.
 *   Rise (상승) = RED (#E84040)
 *   Fall (하락) = BLUE (#2563EB)
 */

// ─── Brand ───────────────────────────────────────────────────────────────────
export const brand = {
  primary: '#0F172A',    // Deep navy — trust, professionalism
  secondary: '#3B82F6',  // Blue — call to action
  surface: '#F8FAFC',    // Light background
  darkBg: '#0A0F1E',     // Dark mode background
} as const;

// ─── Financial Data Colors (Korean convention) ───────────────────────────────
// ⚠️  Korean market: RED = rise, BLUE = fall (opposite of Western markets)
export const financial = {
  rise: '#E84040',       // 상승 (Rise) — RED
  riseBg: '#FEE2E2',     // Rise badge background
  riseFlash: 'rgba(232, 64, 64, 0.2)', // Flash animation overlay

  fall: '#2563EB',       // 하락 (Fall) — BLUE
  fallBg: '#DBEAFE',     // Fall badge background
  fallFlash: 'rgba(37, 99, 235, 0.2)', // Flash animation overlay

  flat: '#6B7280',       // 보합 (Flat) — Gray
  flatBg: '#F3F4F6',     // Flat badge background
} as const;

// ─── Semantic Colors ──────────────────────────────────────────────────────────
export const semantic = {
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

// ─── Neutral Palette ─────────────────────────────────────────────────────────
export const neutral = {
  0:   '#FFFFFF',
  50:  '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
  950: '#020617',
} as const;

// ─── Asset Type Badge Colors ──────────────────────────────────────────────────
export const assetType = {
  stockBg:   '#EFF6FF',  // Blue-50
  stockText: '#1D4ED8',  // Blue-700
  coinBg:    '#FEF3C7',  // Amber-100
  coinText:  '#92400E',  // Amber-800
} as const;

// ─── Live Indicator Colors ────────────────────────────────────────────────────
export const liveStatus = {
  live:         '#10B981', // Green — connected & fresh
  stale:        '#F59E0B', // Amber — data is delayed (>5s)
  disconnected: '#EF4444', // Red — WebSocket disconnected
} as const;

// ─── Composite export ─────────────────────────────────────────────────────────
export const colors = {
  brand,
  financial,
  semantic,
  neutral,
  assetType,
  liveStatus,
} as const;

export type Colors = typeof colors;
