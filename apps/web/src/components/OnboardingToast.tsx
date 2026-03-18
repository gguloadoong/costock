'use client';

import { useState, useEffect } from 'react';

const STEPS = [
  { emoji: '⭐', text: '종목을 검색해서 관심 종목에 추가하세요' },
  { emoji: '📈', text: '실시간 가격과 차트를 확인하세요' },
  { emoji: '🔔', text: '가격 알림을 설정해서 놓치지 마세요' },
];

export function OnboardingToast() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('costock_onboarded')) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const current = STEPS[step];

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      localStorage.setItem('costock_onboarded', '1');
      setVisible(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('costock_onboarded', '1');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 bg-gray-900 text-white rounded-2xl p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{current.emoji}</span>
        <div className="flex-1">
          <p className="text-sm font-medium">{current.text}</p>
          <div className="flex gap-1 mt-2">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1 rounded-full flex-1 ${i === step ? 'bg-white' : 'bg-gray-600'}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-between mt-3">
        <button onClick={handleSkip} className="text-xs text-gray-400">건너뛰기</button>
        <button onClick={handleNext} className="text-xs text-white font-medium">
          {step < STEPS.length - 1 ? '다음 →' : '시작하기'}
        </button>
      </div>
    </div>
  );
}
