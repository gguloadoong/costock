/**
 * validatePriceUpdate — filters anomalous price update events.
 *
 * Rejects:
 *   1. Price is 0 or negative
 *   2. Price change exceeds ±30% from previous close (circuit-breaker-like filter)
 *   3. Timestamp is in the future (clock skew > 5s)
 *
 * Returns a typed result so callers can distinguish rejection reasons.
 */

const MAX_CHANGE_RATE = 0.30; // 30%
const MAX_FUTURE_SKEW_MS = 5_000; // 5 seconds clock tolerance

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: ValidationRejectionReason; detail: string };

export type ValidationRejectionReason =
  | 'INVALID_PRICE'      // 0 or negative
  | 'PRICE_SPIKE'        // ±30% from previous close
  | 'FUTURE_TIMESTAMP';  // timestamp ahead of now by > 5s

export interface PriceUpdateInput {
  price: number;
  /** Previous day closing price for spike detection. Optional — if omitted, spike check is skipped. */
  previousClose?: number;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

/**
 * Validate an incoming price update event.
 *
 * @param update - The price update to validate
 * @returns ValidationResult — { valid: true } or { valid: false, reason, detail }
 */
export function validatePriceUpdate(update: PriceUpdateInput): ValidationResult {
  const { price, previousClose, timestamp } = update;

  // Rule 1: price must be positive
  if (!Number.isFinite(price) || price <= 0) {
    return {
      valid: false,
      reason: 'INVALID_PRICE',
      detail: `Price must be a positive finite number, got: ${price}`,
    };
  }

  // Rule 2: ±30% spike check (only when previousClose is provided)
  if (previousClose !== undefined) {
    if (!Number.isFinite(previousClose) || previousClose <= 0) {
      return {
        valid: false,
        reason: 'INVALID_PRICE',
        detail: `previousClose must be a positive finite number, got: ${previousClose}`,
      };
    }

    const changeRate = Math.abs(price - previousClose) / previousClose;
    if (changeRate > MAX_CHANGE_RATE) {
      const pct = (changeRate * 100).toFixed(2);
      return {
        valid: false,
        reason: 'PRICE_SPIKE',
        detail: `Price change of ${pct}% exceeds ±30% threshold (prev: ${previousClose}, current: ${price})`,
      };
    }
  }

  // Rule 3: future timestamp check
  const nowMs = Date.now();
  if (timestamp > nowMs + MAX_FUTURE_SKEW_MS) {
    return {
      valid: false,
      reason: 'FUTURE_TIMESTAMP',
      detail: `Timestamp ${timestamp} is ${timestamp - nowMs}ms in the future (tolerance: ${MAX_FUTURE_SKEW_MS}ms)`,
    };
  }

  return { valid: true };
}

/**
 * Type-guard: narrows the result to valid.
 */
export function isPriceUpdateValid(
  result: ValidationResult
): result is { valid: true } {
  return result.valid;
}
