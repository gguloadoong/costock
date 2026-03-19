import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    {
      symbol: 'KOSPI',
      name: '코스피',
      price: 2485.32,
      change: 12.45,
      changeRate: 0.005,
    },
    {
      symbol: 'KOSDAQ',
      name: '코스닥',
      price: 721.89,
      change: -3.21,
      changeRate: -0.0044,
    },
    {
      symbol: 'BTC',
      name: '비트코인',
      price: 94500000,
      change: 1500000,
      changeRate: 0.0161,
    },
    {
      symbol: 'USD_KRW',
      name: '달러/원',
      price: 1378.5,
      change: -2.3,
      changeRate: -0.0017,
    },
  ];

  return NextResponse.json({ data });
}
