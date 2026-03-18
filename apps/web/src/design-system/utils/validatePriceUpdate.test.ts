import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validatePriceUpdate, isPriceUpdateValid } from './validatePriceUpdate';

const NOW = 1_700_000_000_000; // Fixed timestamp for deterministic tests

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('validatePriceUpdate', () => {
  describe('valid inputs', () => {
    it('passes a normal stock price update', () => {
      const result = validatePriceUpdate({
        price: 85400,
        previousClose: 84200,
        timestamp: NOW - 1000,
      });
      expect(result.valid).toBe(true);
    });

    it('passes without previousClose (spike check skipped)', () => {
      const result = validatePriceUpdate({
        price: 85400,
        timestamp: NOW - 500,
      });
      expect(result.valid).toBe(true);
    });

    it('passes at exactly 30% change', () => {
      // Exactly at boundary — 30% is the limit, should pass at exactly 30%
      const previousClose = 100;
      const price = 130; // exactly +30%
      const result = validatePriceUpdate({ price, previousClose, timestamp: NOW });
      expect(result.valid).toBe(true);
    });

    it('passes a timestamp within 5s future tolerance', () => {
      const result = validatePriceUpdate({
        price: 85400,
        timestamp: NOW + 4999,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('INVALID_PRICE rejections', () => {
    it('rejects price of 0', () => {
      const result = validatePriceUpdate({ price: 0, timestamp: NOW });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('INVALID_PRICE');
      }
    });

    it('rejects negative price', () => {
      const result = validatePriceUpdate({ price: -100, timestamp: NOW });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('INVALID_PRICE');
      }
    });

    it('rejects NaN price', () => {
      const result = validatePriceUpdate({ price: NaN, timestamp: NOW });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('INVALID_PRICE');
      }
    });

    it('rejects Infinity price', () => {
      const result = validatePriceUpdate({ price: Infinity, timestamp: NOW });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('INVALID_PRICE');
      }
    });

    it('rejects invalid previousClose', () => {
      const result = validatePriceUpdate({
        price: 85400,
        previousClose: -1,
        timestamp: NOW,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('INVALID_PRICE');
      }
    });
  });

  describe('PRICE_SPIKE rejections', () => {
    it('rejects +30.01% rise', () => {
      const result = validatePriceUpdate({
        price: 130.01,
        previousClose: 100,
        timestamp: NOW,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('PRICE_SPIKE');
        expect(result.detail).toContain('%');
      }
    });

    it('rejects -30.01% fall', () => {
      const result = validatePriceUpdate({
        price: 69.99,
        previousClose: 100,
        timestamp: NOW,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('PRICE_SPIKE');
      }
    });

    it('rejects extreme spike (price doubles)', () => {
      const result = validatePriceUpdate({
        price: 200000,
        previousClose: 85400,
        timestamp: NOW,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('PRICE_SPIKE');
      }
    });
  });

  describe('FUTURE_TIMESTAMP rejections', () => {
    it('rejects timestamp more than 5s in the future', () => {
      const result = validatePriceUpdate({
        price: 85400,
        timestamp: NOW + 5001,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('FUTURE_TIMESTAMP');
        expect(result.detail).toContain('future');
      }
    });
  });

  describe('additional edge cases', () => {
    // UT-VP-010: previousClose가 0인 경우
    it('previousClose가 0이면 INVALID_PRICE', () => {
      const result = validatePriceUpdate({ price: 100, previousClose: 0, timestamp: NOW });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('INVALID_PRICE');
      }
    });

    // UT-VP-011: 비트코인 실제 가격대 정상 통과
    it('비트코인 2.03% 변동은 정상 통과', () => {
      const result = validatePriceUpdate({
        price: 142850000,
        previousClose: 140000000,
        timestamp: NOW,
      });
      expect(result.valid).toBe(true);
    });

    // UT-VP-013: previousClose 없을 때 극단값 통과 (스파이크 검사 스킵)
    it('previousClose 없으면 극단값도 valid', () => {
      const result = validatePriceUpdate({
        price: 999999999,
        timestamp: NOW,
      });
      expect(result.valid).toBe(true);
    });
  });
});

describe('isPriceUpdateValid', () => {
  it('returns true for valid result', () => {
    const result = validatePriceUpdate({ price: 85400, timestamp: NOW });
    expect(isPriceUpdateValid(result)).toBe(true);
  });

  it('returns false for invalid result', () => {
    const result = validatePriceUpdate({ price: 0, timestamp: NOW });
    expect(isPriceUpdateValid(result)).toBe(false);
  });
});
