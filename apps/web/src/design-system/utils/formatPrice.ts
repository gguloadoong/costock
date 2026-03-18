/**
 * formatPrice — formats a KRW price value for display.
 *
 * Rules:
 *   - Thousand-separator commas
 *   - Minimum 2 decimal places (coin can use up to 8)
 *   - Throws on invalid values (0, negative) — callers must handle stale/error states
 */

export class InvalidPriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPriceError';
  }
}

/**
 * Format a numeric price into a localized Korean won display string.
 *
 * @param value - The price value (must be > 0)
 * @param options.decimals - Number of decimal places (default: 0 for stocks, 2 minimum)
 * @returns Formatted price string, e.g. "85,400" or "142,850,000"
 * @throws {InvalidPriceError} if value is 0 or negative
 */
export function formatPrice(
  value: number,
  options: { decimals?: number } = {}
): string {
  if (!Number.isFinite(value)) {
    throw new InvalidPriceError(`Price must be a finite number, got: ${value}`);
  }
  if (value <= 0) {
    throw new InvalidPriceError(
      `Price must be positive, got: ${value}. Use stale/error UI state instead.`
    );
  }

  const { decimals = 0 } = options;

  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Safe variant — returns null instead of throwing for display contexts
 * where an error state is handled separately.
 */
export function formatPriceSafe(
  value: number,
  options: { decimals?: number } = {}
): string | null {
  try {
    return formatPrice(value, options);
  } catch {
    return null;
  }
}
