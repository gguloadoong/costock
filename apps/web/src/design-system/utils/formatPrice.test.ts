import { describe, it, expect } from 'vitest';
import { formatPrice, formatPriceSafe, InvalidPriceError } from './formatPrice';

describe('formatPrice', () => {
  it('formats integer stock price with commas', () => {
    expect(formatPrice(85400)).toBe('85,400');
  });

  it('formats large coin price with commas', () => {
    expect(formatPrice(142850000)).toBe('142,850,000');
  });

  it('formats with decimal places when specified', () => {
    expect(formatPrice(85400.5, { decimals: 2 })).toBe('85,400.50');
  });

  it('formats small coin price with 8 decimal places', () => {
    expect(formatPrice(0.00012345, { decimals: 8 })).toBe('0.00012345');
  });

  it('throws InvalidPriceError for zero', () => {
    expect(() => formatPrice(0)).toThrow(InvalidPriceError);
    expect(() => formatPrice(0)).toThrow('Price must be positive');
  });

  it('throws InvalidPriceError for negative value', () => {
    expect(() => formatPrice(-100)).toThrow(InvalidPriceError);
    expect(() => formatPrice(-100)).toThrow('Price must be positive');
  });

  it('throws InvalidPriceError for NaN', () => {
    expect(() => formatPrice(NaN)).toThrow(InvalidPriceError);
  });

  it('throws InvalidPriceError for Infinity', () => {
    expect(() => formatPrice(Infinity)).toThrow(InvalidPriceError);
  });

  it('formats price of 1', () => {
    expect(formatPrice(1)).toBe('1');
  });

  it('formats price of 1000', () => {
    expect(formatPrice(1000)).toBe('1,000');
  });

  // UT-FP-011: 소수점 없는 코인 (100원 이상)
  it('3845원 코인은 소수점 없이 표시', () => {
    expect(formatPrice(3845, { decimals: 0 })).toBe('3,845');
  });

  // UT-FP-012: JS 부동소수점 경계
  it('0.1 + 0.2 반올림 오류 없이 표시', () => {
    const result = formatPrice(0.1 + 0.2, { decimals: 2 });
    expect(result).toBe('0.30');
  });

  // UT-FP-013: 비트코인 실제 가격대
  it('142850000 비트코인 가격 정상 표시', () => {
    expect(formatPrice(142850000)).toBe('142,850,000');
  });
});

describe('formatPriceSafe', () => {
  it('returns formatted string for valid price', () => {
    expect(formatPriceSafe(85400)).toBe('85,400');
  });

  it('returns null for zero', () => {
    expect(formatPriceSafe(0)).toBeNull();
  });

  it('returns null for negative value', () => {
    expect(formatPriceSafe(-100)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(formatPriceSafe(NaN)).toBeNull();
  });
});
