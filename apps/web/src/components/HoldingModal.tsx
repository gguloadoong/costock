'use client';

import { useState } from 'react';
import { setHolding } from '@/lib/holdingStorage';
import { showToast } from '@/components/Toast';

interface HoldingModalProps {
  symbol: string;
  name: string;
  type: 'stock' | 'coin';
  currentPrice: number;
  onClose: () => void;
}

export function HoldingModal({ symbol, name, type, currentPrice, onClose }: HoldingModalProps) {
  const [avgPrice, setAvgPrice] = useState(String(currentPrice));
  const [quantity, setQuantity] = useState('1');

  const handleSave = () => {
    const price = parseFloat(avgPrice.replace(/,/g, ''));
    const qty = parseFloat(quantity);
    if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
      showToast({ text: '올바른 값을 입력하세요', type: 'warning' });
      return;
    }
    setHolding({ symbol, name, type, avgPrice: price, quantity: qty });
    showToast({ text: `${name} 보유 종목이 저장되었습니다`, type: 'success' });
    onClose();
  };

  const investValue = (parseFloat(avgPrice) || 0) * (parseFloat(quantity) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8">
        <h3 className="text-base font-semibold mb-1">{name} 보유 종목 등록</h3>
        <p className="text-sm text-gray-400 mb-4">현재가: {currentPrice.toLocaleString()}원</p>

        <div className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block">평균 매수가 (원)</label>
          <input
            type="number"
            value={avgPrice}
            onChange={e => setAvgPrice(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-400"
          />
        </div>

        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">보유 수량</label>
          <input
            type="number"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            step="0.0001"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-400"
          />
        </div>

        {investValue > 0 && (
          <p className="text-xs text-gray-400 mb-4">
            투자금액: {investValue.toLocaleString()}원
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-medium">취소</button>
          <button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium">저장</button>
        </div>
      </div>
    </div>
  );
}
