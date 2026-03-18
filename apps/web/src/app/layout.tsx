/**
 * Root Layout — Next.js App Router
 *
 * 모바일 375px 기준 최대 430px 중앙 정렬.
 * BottomNavigation 공간 확보를 위해 paddingBottom 56px 적용.
 */

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'CoStock — 주식·코인 통합 투자정보',
  description: '주식과 코인을 하나의 앱에서. 실시간 가격, 통합 포트폴리오.',
  applicationName: 'CoStock',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CoStock',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F172A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="ko">
      <body style={{ background: '#F8FAFC', margin: 0, padding: 0 }}>
        <ServiceWorkerRegistrar />
        <Providers>
          {/* 모바일 중앙 정렬 컨테이너 */}
          <div
            style={{
              position: 'relative',
              minHeight: '100vh',
              maxWidth: '430px',
              margin: '0 auto',
              background: '#F8FAFC',
              boxShadow: '0 0 40px rgba(0,0,0,0.06)',
            }}
          >
            {/* BottomNavigation 높이 + safe-area만큼 하단 여백 */}
            <main
              style={{
                paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
              }}
            >
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
