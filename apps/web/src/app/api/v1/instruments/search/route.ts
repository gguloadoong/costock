import { NextResponse } from 'next/server';

interface Instrument {
  symbol: string;
  name: string;
  nameEn: string;
  assetType: string;
  exchange: string;
  price: number;
  changeRate: number;
}

const INSTRUMENTS: Instrument[] = [
  { symbol: '005930', name: '삼성전자', nameEn: 'Samsung Electronics', assetType: 'stock_kr', exchange: 'KOSPI', price: 65400, changeRate: 0.0054 },
  { symbol: '000660', name: 'SK하이닉스', nameEn: 'SK Hynix', assetType: 'stock_kr', exchange: 'KOSPI', price: 187500, changeRate: 0.0122 },
  { symbol: '035420', name: 'NAVER', nameEn: 'NAVER Corp', assetType: 'stock_kr', exchange: 'KOSPI', price: 198000, changeRate: -0.0025 },
  { symbol: '051910', name: 'LG화학', nameEn: 'LG Chem', assetType: 'stock_kr', exchange: 'KOSPI', price: 342000, changeRate: 0.0088 },
  { symbol: '005380', name: '현대차', nameEn: 'Hyundai Motor', assetType: 'stock_kr', exchange: 'KOSPI', price: 215000, changeRate: 0.0046 },
  { symbol: '035720', name: '카카오', nameEn: 'Kakao Corp', assetType: 'stock_kr', exchange: 'KOSPI', price: 47850, changeRate: -0.0031 },
  { symbol: '068270', name: '셀트리온', nameEn: 'Celltrion', assetType: 'stock_kr', exchange: 'KOSPI', price: 175000, changeRate: 0.0114 },
  { symbol: '373220', name: 'LG에너지솔루션', nameEn: 'LG Energy Solution', assetType: 'stock_kr', exchange: 'KOSPI', price: 312000, changeRate: -0.0064 },
  { symbol: '069500', name: 'KODEX 200', nameEn: 'KODEX 200 ETF', assetType: 'etf_kr', exchange: 'KOSPI', price: 31250, changeRate: 0.005 },
  { symbol: '114800', name: 'KODEX 인버스', nameEn: 'KODEX Inverse', assetType: 'etf_kr', exchange: 'KOSPI', price: 4125, changeRate: -0.005 },
  { symbol: 'KRW-BTC', name: '비트코인', nameEn: 'Bitcoin', assetType: 'crypto', exchange: 'Upbit', price: 94500000, changeRate: 0.0161 },
  { symbol: 'KRW-ETH', name: '이더리움', nameEn: 'Ethereum', assetType: 'crypto', exchange: 'Upbit', price: 5120000, changeRate: 0.0094 },
  { symbol: 'KRW-SOL', name: '솔라나', nameEn: 'Solana', assetType: 'crypto', exchange: 'Upbit', price: 198000, changeRate: -0.0213 },
  { symbol: 'KRW-XRP', name: '리플', nameEn: 'XRP', assetType: 'crypto', exchange: 'Upbit', price: 3250, changeRate: 0.0378 },
  { symbol: 'KRW-DOGE', name: '도지코인', nameEn: 'Dogecoin', assetType: 'crypto', exchange: 'Upbit', price: 285, changeRate: 0.0521 },
  { symbol: 'NVDA', name: 'NVIDIA', nameEn: 'NVIDIA Corp', assetType: 'stock_us', exchange: 'NASDAQ', price: 875.32, changeRate: 0.0221 },
  { symbol: 'AAPL', name: '애플', nameEn: 'Apple Inc', assetType: 'stock_us', exchange: 'NASDAQ', price: 214.56, changeRate: 0.0087 },
  { symbol: 'MSFT', name: '마이크로소프트', nameEn: 'Microsoft Corp', assetType: 'stock_us', exchange: 'NASDAQ', price: 415.23, changeRate: 0.0043 },
  { symbol: 'TSLA', name: '테슬라', nameEn: 'Tesla Inc', assetType: 'stock_us', exchange: 'NASDAQ', price: 187.64, changeRate: -0.0312 },
  { symbol: 'META', name: '메타', nameEn: 'Meta Platforms', assetType: 'stock_us', exchange: 'NASDAQ', price: 512.88, changeRate: 0.0156 },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim().toLowerCase();
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), INSTRUMENTS.length);

  if (!query) {
    return NextResponse.json({ data: INSTRUMENTS.slice(0, limit) });
  }

  const filtered = INSTRUMENTS.filter(
    (inst) =>
      inst.symbol.toLowerCase().includes(query) ||
      inst.name.toLowerCase().includes(query) ||
      inst.nameEn.toLowerCase().includes(query),
  ).slice(0, limit);

  return NextResponse.json({ data: filtered });
}
