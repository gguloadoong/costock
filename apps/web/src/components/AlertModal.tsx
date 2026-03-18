'use client';

import { useState } from 'react';
import { addAlert } from '@/lib/alertStorage';
import { showToast } from '@/components/Toast';

interface AlertModalProps {
  symbol: string;
  name: string;
  type: 'stock' | 'coin';
  currentPrice: number;
  onClose: () => void;
}

export function AlertModal({ symbol, name, type, currentPrice, onClose }: AlertModalProps) {
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [targetPrice, setTargetPrice] = useState(String(currentPrice));

  const handleSubmit = () => {
    const price = parseFloat(targetPrice.replace(/,/g, ''));
    if (isNaN(price) || price <= 0) {
      showToast({ text: '올바른 가격을 입력하세요', type: 'warning' });
      return;
    }
    addAlert({ symbol, name, type, condition, targetPrice: price, currentPrice });
    showToast({ text: `${name} 알림이 설정되었습니다`, type: 'success' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8">
        <h3 className="text-base font-semibold text-gray-800 mb-1">{name} 가격 알림</h3>
        <p className="text-sm text-gray-400 mb-4">현재: {currentPrice.toLocaleString()}원</p>

        <div className="flex gap-2 mb-4">
          {(['above', 'below'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCondition(c)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                condition === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {c === 'above' ? '이상 (목표가)' : '이하 (손절가)'}
            </button>
          ))}
        </div>

        <input
          type="number"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          placeholder="목표 가격 입력"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base mb-4 focus:outline-none focus:border-blue-400"
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium"
          >
            설정
          </button>
        </div>
      </div>
    </div>
  );
}
