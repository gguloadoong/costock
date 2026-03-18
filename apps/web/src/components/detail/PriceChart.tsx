'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { CandlestickData, Time } from 'lightweight-charts';

interface CandlePoint {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface PriceChartProps {
  symbol: string;
  assetType: 'stock' | 'coin';
}

type Period = '1D' | '1W' | '1M' | '3M';

const PERIODS: Period[] = ['1D', '1W', '1M', '3M'];

const PERIOD_INTERVAL: Record<Period, string> = {
  '1D': '15m',
  '1W': '1h',
  '1M': '1d',
  '3M': '1d',
};

const PERIOD_LIMIT: Record<Period, number> = {
  '1D': 40,
  '1W': 42,
  '1M': 30,
  '3M': 90,
};

function generateMockCandles(count: number): CandlestickData[] {
  const now = Math.floor(Date.now() / 1000);
  const basePrice = 100_000;
  const intervalSec = 60 * 60; // 1h spacing for mock
  const candles: CandlestickData[] = [];
  let close = basePrice;

  for (let i = count - 1; i >= 0; i--) {
    const time = (now - i * intervalSec) as Time;
    const open = close;
    const change = (Math.random() - 0.48) * open * 0.02;
    close = Math.max(open + change, open * 0.5);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    candles.push({
      time,
      open: Math.round(open),
      high: Math.round(high),
      low: Math.round(low),
      close: Math.round(close),
    });
  }
  return candles;
}

export function PriceChart({ symbol, assetType: _assetType }: PriceChartProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<Period>('1M');

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    let chart: ReturnType<typeof import('lightweight-charts')['createChart']> | null = null;
    let cancelled = false;

    const init = async () => {
      const { createChart } = await import('lightweight-charts');

      if (cancelled || !containerRef.current) return;

      chart = createChart(container, {
        width: container.clientWidth,
        height: 220,
        layout: {
          background: { color: 'white' },
          textColor: '#64748B',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: '#F1F5F9' },
          horzLines: { color: '#F1F5F9' },
        },
        rightPriceScale: {
          borderColor: '#E2E8F0',
        },
        timeScale: {
          borderColor: '#E2E8F0',
          timeVisible: true,
        },
        crosshair: {
          mode: 1, // CrosshairMode.Magnet
        },
      });

      const { CandlestickSeries } = await import('lightweight-charts');
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#E84040',
        downColor: '#2563EB',
        borderUpColor: '#E84040',
        borderDownColor: '#2563EB',
        wickUpColor: '#E84040',
        wickDownColor: '#2563EB',
      });

      // Load candle data
      let candles: CandlestickData[] = [];
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      try {
        const interval = PERIOD_INTERVAL[period];
        const limit = PERIOD_LIMIT[period];
        const res = await fetch(
          `/api/v1/prices/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error('fetch failed');
        const json = (await res.json()) as { data?: CandlePoint[] } | CandlePoint[];
        const raw: CandlePoint[] = Array.isArray(json) ? json : ((json as { data?: CandlePoint[] }).data ?? []);
        candles = raw
          .map((c) => ({
            time: (typeof c.time === 'string'
              ? Math.floor(new Date(c.time).getTime() / 1000)
              : c.time) as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));
      } catch {
        candles = generateMockCandles(PERIOD_LIMIT[period]);
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (!cancelled) {
        series.setData(candles);
        chart.timeScale().fitContent();
      }

      // ResizeObserver for responsive width
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry && chart) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      });
      ro.observe(container);

      // Store ro for cleanup
      (container as HTMLDivElement & { _ro?: ResizeObserver })._ro = ro;
    };

    void init();

    return () => {
      cancelled = true;
      const c = containerRef.current as (HTMLDivElement & { _ro?: ResizeObserver }) | null;
      c?._ro?.disconnect();
      chart?.remove();
    };
  }, [symbol, period]);

  return (
    <div>
      {/* 기간 탭 버튼 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {PERIODS.map((p) => {
          const isActive = period === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              style={{
                flex: 1,
                minHeight: '44px',
                padding: '8px 0',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'white' : '#94A3B8',
                background: isActive ? '#0F172A' : 'transparent',
                border: isActive ? '1px solid #0F172A' : '1px solid #E2E8F0',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
              aria-pressed={isActive}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* 차트 컨테이너 */}
      <div ref={containerRef} style={{ width: '100%', height: '220px' }} />
    </div>
  );
}
