import { describe, it, expect } from 'vitest';
import { formatRate, formatRateDisplay } from './formatRate';

describe('formatRate', () => {
  describe('positive values (rise)', () => {
    it('formats a positive rate with + sign', () => {
      const result = formatRate(1.43);
      expect(result.display).toBe('+1.43%');
      expect(result.direction).toBe('rise');
    });

    it('formats a small positive rate', () => {
      const result = formatRate(0.01);
      expect(result.display).toBe('+0.01%');
      expect(result.direction).toBe('rise');
    });

    it('formats a large positive rate', () => {
      const result = formatRate(29.99);
      expect(result.display).toBe('+29.99%');
      expect(result.direction).toBe('rise');
    });

    it('rounds to 2 decimal places', () => {
      const result = formatRate(1.456);
      expect(result.display).toBe('+1.46%');
    });
  });

  describe('negative values (fall)', () => {
    it('formats a negative rate with - sign', () => {
      const result = formatRate(-0.89);
      expect(result.display).toBe('-0.89%');
      expect(result.direction).toBe('fall');
    });

    it('formats a large negative rate', () => {
      const result = formatRate(-15.5);
      expect(result.display).toBe('-15.50%');
      expect(result.direction).toBe('fall');
    });
  });

  describe('zero (flat)', () => {
    it('formats zero as 0.00% with no sign', () => {
      const result = formatRate(0);
      expect(result.display).toBe('0.00%');
      expect(result.direction).toBe('flat');
    });

    it('formats -0 as flat', () => {
      const result = formatRate(-0);
      expect(result.display).toBe('0.00%');
      expect(result.direction).toBe('flat');
    });
  });

  describe('direction property', () => {
    // UT-FR-008: 상승 direction 값 확인
    it('양수 변동률은 direction="rise"', () => {
      const result = formatRate(1.43);
      expect(result.direction).toBe('rise');
    });

    // UT-FR-009: 하락 direction 값 확인
    it('음수 변동률은 direction="fall"', () => {
      const result = formatRate(-0.89);
      expect(result.direction).toBe('fall');
    });

    // UT-FR-010: 29.99% 경계값 표시
    it('29.99% 는 정상 표시', () => {
      const result = formatRate(29.99);
      expect(result.display).toBe('+29.99%');
      expect(result.direction).toBe('rise');
    });
  });

  describe('edge cases', () => {
    it('handles NaN gracefully', () => {
      const result = formatRate(NaN);
      expect(result.display).toBe('-.---%');
      expect(result.direction).toBe('flat');
    });

    it('handles Infinity gracefully', () => {
      const result = formatRate(Infinity);
      expect(result.display).toBe('-.---%');
      expect(result.direction).toBe('flat');
    });

    it('handles -Infinity gracefully', () => {
      const result = formatRate(-Infinity);
      expect(result.display).toBe('-.---%');
      expect(result.direction).toBe('flat');
    });
  });
});

describe('formatRateDisplay', () => {
  it('returns only the display string', () => {
    expect(formatRateDisplay(1.43)).toBe('+1.43%');
    expect(formatRateDisplay(-0.89)).toBe('-0.89%');
    expect(formatRateDisplay(0)).toBe('0.00%');
  });
});
