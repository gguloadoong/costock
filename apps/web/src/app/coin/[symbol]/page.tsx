import { DetailPage } from '@/components/detail/DetailPage';

export default function CoinDetailRoute({ params }: { params: { symbol: string } }) {
  return <DetailPage symbol={params.symbol} assetType="coin" />;
}
