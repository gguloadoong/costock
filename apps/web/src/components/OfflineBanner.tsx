'use client';

import { useState, useEffect } from 'react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '430px',
        background: '#374151',
        color: '#F9FAFB',
        fontSize: '13px',
        textAlign: 'center',
        padding: '8px 16px',
        zIndex: 9999,
      }}
    >
      오프라인 상태입니다. 일부 데이터가 오래됐을 수 있습니다.
    </div>
  );
}
