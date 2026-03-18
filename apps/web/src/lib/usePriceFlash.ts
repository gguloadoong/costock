'use client';

import { useState, useRef, useEffect } from 'react';

export type FlashDirection = 'rise' | 'fall' | null;

/**
 * 가격 변동 시 플래시 방향을 반환하는 훅
 * @param price 현재 가격
 * @returns 'rise' | 'fall' | null
 */
export function usePriceFlash(price: number | undefined): FlashDirection {
  const [flash, setFlash] = useState<FlashDirection>(null);
  const prevPrice = useRef<number | undefined>(price);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (price === undefined || prevPrice.current === undefined) {
      prevPrice.current = price;
      return;
    }

    if (price > prevPrice.current) {
      setFlash('rise');
    } else if (price < prevPrice.current) {
      setFlash('fall');
    }

    prevPrice.current = price;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFlash(null), 700);

    return () => clearTimeout(timerRef.current);
  }, [price]);

  return flash;
}
