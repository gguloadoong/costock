'use client';

import { useOnlineStatus } from '@/lib/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gray-800 text-white text-xs text-center py-2 px-4 flex items-center justify-center gap-2">
      <span>📡</span>
      <span>오프라인 상태입니다 — 최신 데이터를 불러올 수 없어요</span>
    </div>
  );
}
