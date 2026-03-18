'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 이미 설치됨 or 무시한 경우 skip
    if (localStorage.getItem('pwa_install_dismissed')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_install_dismissed', '1');
    setDismissed(true);
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 bg-white border border-gray-200 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          CS
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">홈 화면에 추가</p>
          <p className="text-xs text-gray-400">CoStock을 앱처럼 사용하세요</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDismiss} className="text-xs text-gray-400 px-2 py-1">나중에</button>
          <button
            onClick={handleInstall}
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-xl font-medium"
          >
            설치
          </button>
        </div>
      </div>
    </div>
  );
}
