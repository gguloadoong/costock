'use client';

import React from 'react';

interface EmptyWatchlistProps {
  onAddSymbol: (symbol: string, type: 'stock' | 'coin') => void;
}

const QUICK_ADD = [
  { symbol: '005930', name: '삼성전자', type: 'stock' as const },
  { symbol: '000660', name: 'SK하이닉스', type: 'stock' as const },
  { symbol: '035720', name: '카카오', type: 'stock' as const },
  { symbol: 'BTC', name: '비트코인', type: 'coin' as const },
  { symbol: 'ETH', name: '이더리움', type: 'coin' as const },
  { symbol: 'XRP', name: '리플', type: 'coin' as const },
];

export function EmptyWatchlist({ onAddSymbol }: EmptyWatchlistProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center px-4 py-12">
      <div className="text-5xl mb-4">📈</div>
      <h3 className="text-lg font-semibold text-gray-800 mb-1">관심종목을 추가해보세요</h3>
      <p className="text-sm text-gray-400 mb-8 text-center">
        종목 검색 후 ⭐을 탭하거나<br />아래에서 빠르게 추가하세요
      </p>

      <div className="w-full mb-6">
        <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">주식</p>
        <div className="flex gap-2">
          {QUICK_ADD.filter(i => i.type === 'stock').map(item => (
            <button
              key={item.symbol}
              onClick={() => onAddSymbol(item.symbol, item.type)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gray-50 border border-gray-100 text-sm font-medium text-gray-700 active:bg-gray-100 transition-colors"
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full">
        <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">코인</p>
        <div className="flex gap-2">
          {QUICK_ADD.filter(i => i.type === 'coin').map(item => (
            <button
              key={item.symbol}
              onClick={() => onAddSymbol(item.symbol, item.type)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gray-50 border border-gray-100 text-sm font-medium text-gray-700 active:bg-gray-100 transition-colors"
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
