'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW 등록 실패는 무시 (sw.js 없어도 앱은 동작)
      });
    }
  }, []);

  return null;
}
