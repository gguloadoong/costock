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
import { OfflineBanner } from '@/components/OfflineBanner';

export const metadata: Metadata = {
  title: {
    default: 'CoStock — 주식·코인 통합 투자정보',
    template: '%s | CoStock',
  },
  description: '주식과 코인을 하나의 앱에서. 실시간 가격, 통합 포트폴리오, 크로스에셋 인사이트.',
  keywords: ['주식', '코인', '비트코인', '삼성전자', '투자', '실시간 시세'],
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
  openGraph: {
    title: 'CoStock — 주식·코인 통합 투자정보',
    description: '주식과 코인을 하나의 앱에서 확인하세요. 실시간 가격, 통합 포트폴리오, 크로스에셋 인사이트.',
    type: 'website',
    locale: 'ko_KR',
    url: 'https://costock.app',
    siteName: 'CoStock',
    images: [
      {
        url: 'https://costock.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CoStock',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CoStock',
    description: '주식과 코인을 하나의 앱에서 확인하세요.',
    images: ['https://costock.app/twitter-image.png'],
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
      <head>
        <link rel="stylesheet" as="style" crossOrigin="anonymous" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css" />
      </head>
      <body style={{ background: '#F8FAFC', margin: 0, padding: 0 }}>
        <ServiceWorkerRegistrar />
        <OfflineBanner />
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
                paddingBottom: 'calc(56px + 52px + env(safe-area-inset-bottom))',
              }}
            >
              {children}
            </main>

            {/* 면책 고지 — BottomNavigation 위, safe-area 고려 */}
            <footer
              style={{
                position: 'fixed',
                bottom: 'calc(56px + env(safe-area-inset-bottom))',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100%',
                maxWidth: '430px',
                padding: '6px 16px',
                background: 'rgba(248, 250, 252, 0.95)',
                borderTop: '1px solid #E2E8F0',
                zIndex: 19,
              }}
            >
              <p
                style={{
                  fontSize: '11px',
                  color: '#9CA3AF',
                  margin: 0,
                  lineHeight: 1.5,
                  textAlign: 'center',
                }}
              >
                본 서비스는 투자 정보 제공을 목적으로 하며, 투자 권유가 아닙니다.
                모든 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
              </p>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
