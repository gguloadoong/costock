/**
 * formatRate — formats a change rate percentage for display.
 *
 * Rules:
 *   - Always shows sign: "+" for positive, "-" for negative
 *   - 2 decimal places fixed
 *   - Zero shows as "0.00%" (no sign, flat state)
 *
 * Examples:
 *   1.43   → "+1.43%"
 *   -0.89  → "-0.89%"
 *   0      → "0.00%"
 */

export type RateDirection = 'rise' | 'fall' | 'flat';

export interface FormattedRate {
  /** Display string, e.g. "+1.43%" */
  display: string;
  /** Semantic direction for styling */
  direction: RateDirection;
}

/**
 * Format a rate value (as a percentage number) for display.
 *
 * @param value - Rate as a percentage number (e.g. 1.43 for +1.43%)
 * @returns FormattedRate with display string and direction
 */
export function formatRate(value: number): FormattedRate {
  if (!Number.isFinite(value)) {
    return { display: '-.---%', direction: 'flat' };
  }

  const fixed = Math.abs(value).toFixed(2);

  if (value > 0) {
    return { display: `+${fixed}%`, direction: 'rise' };
  }

  if (value < 0) {
    return { display: `-${fixed}%`, direction: 'fall' };
  }

  return { display: '0.00%', direction: 'flat' };
}

/**
 * Convenience: returns only the display string.
 * Useful when direction is determined separately.
 */
export function formatRateDisplay(value: number): string {
  return formatRate(value).display;
}
