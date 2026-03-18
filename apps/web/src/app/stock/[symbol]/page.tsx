import { DetailPage } from '@/components/detail/DetailPage';

export default function StockDetailRoute({ params }: { params: { symbol: string } }) {
  return <DetailPage symbol={params.symbol} assetType="stock" />;
}
