import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DetailSkeleton } from '@/components/detail/DetailSkeleton';
import { DetailPage } from '@/components/detail/DetailPage';

export default function CoinDetailRoute({ params }: { params: { symbol: string } }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<DetailSkeleton />}>
        <DetailPage symbol={params.symbol} assetType="coin" />
      </Suspense>
    </ErrorBoundary>
  );
}
