import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DetailSkeleton } from '@/components/detail/DetailSkeleton';
import { DetailPage } from '@/components/detail/DetailPage';

// 주식 종목명 매핑
const STOCK_NAMES: Record<string, string> = {
  '005930': '삼성전자',
  '000660': 'SK하이닉스',
  '035720': '카카오',
  '035420': 'NAVER',
  '051910': 'LG화학',
};

export async function generateMetadata({ params }: { params: { symbol: string } }): Promise<Metadata> {
  const symbol = params.symbol;
  const name = STOCK_NAMES[symbol] ?? symbol;

  return {
    title: `${name} 주가`,
    description: `${name}(${symbol}) 실시간 주가, 차트, 뉴스 정보를 CoStock에서 확인하세요.`,
    keywords: [name, symbol, '주가', '실시간 시세', '차트'],
    openGraph: {
      title: `${name} 주가 | CoStock`,
      description: `${name} 실시간 시세와 차트를 확인하세요.`,
      type: 'website',
      locale: 'ko_KR',
      url: `https://costock.app/stock/${symbol}`,
      images: [
        {
          url: 'https://costock.app/og-image.png',
          width: 1200,
          height: 630,
          alt: `${name} 주가`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} 주가`,
      description: `${name} 실시간 시세를 확인하세요.`,
      images: ['https://costock.app/twitter-image.png'],
    },
  };
}

export default function StockDetailRoute({ params }: { params: { symbol: string } }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<DetailSkeleton />}>
        <DetailPage symbol={params.symbol} assetType="stock" />
      </Suspense>
    </ErrorBoundary>
  );
}
