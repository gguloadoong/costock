import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DetailSkeleton } from '@/components/detail/DetailSkeleton';
import { DetailPage } from '@/components/detail/DetailPage';

// 암호화폐 종목명 매핑
const COIN_NAMES: Record<string, string> = {
  'KRW-BTC': '비트코인',
  'KRW-ETH': '이더리움',
  'KRW-XRP': '리플',
  'KRW-SOL': '솔라나',
  'KRW-ADA': '에이다',
};

export async function generateMetadata({ params }: { params: { symbol: string } }): Promise<Metadata> {
  const symbol = params.symbol;
  const name = COIN_NAMES[symbol] ?? symbol;

  return {
    title: `${name} 시세`,
    description: `${name}(${symbol}) 실시간 시세, 차트, 정보를 CoStock에서 확인하세요.`,
    keywords: [name, symbol, '암호화폐', '실시간 시세', '차트'],
    openGraph: {
      title: `${name} 시세 | CoStock`,
      description: `${name} 실시간 시세와 차트를 확인하세요.`,
      type: 'website',
      locale: 'ko_KR',
      url: `https://costock.app/coin/${symbol}`,
      images: [
        {
          url: 'https://costock.app/og-image.png',
          width: 1200,
          height: 630,
          alt: `${name} 시세`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} 시세`,
      description: `${name} 실시간 시세를 확인하세요.`,
      images: ['https://costock.app/twitter-image.png'],
    },
  };
}

export default function CoinDetailRoute({ params }: { params: { symbol: string } }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<DetailSkeleton />}>
        <DetailPage symbol={params.symbol} assetType="coin" />
      </Suspense>
    </ErrorBoundary>
  );
}
