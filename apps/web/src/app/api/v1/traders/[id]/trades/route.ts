import { NextResponse } from 'next/server';
import { TRADERS } from '../../_data';

interface Trade {
  id: string;
  traderId: string;
  symbol: string;
  symbolName: string;
  assetType: string;
  action: 'buy' | 'sell';
  price: number;
  quantity: number;
  amount: number;
  realizedPnl: number | null;
  reason: string;
  timestamp: string;
  isSimulated: boolean;
}

const TRADES_MAP: Record<string, Trade[]> = {
  alpha: [
    { id: 'a1', traderId: 'alpha', symbol: '005930', symbolName: '삼성전자', assetType: 'stock_kr', action: 'buy', price: 62000, quantity: 5, amount: 310000, realizedPnl: null, reason: '52주 신고가 돌파, 모멘텀 진입', timestamp: '2026-03-19T09:15:00.000Z', isSimulated: true },
    { id: 'a2', traderId: 'alpha', symbol: '000660', symbolName: 'SK하이닉스', assetType: 'stock_kr', action: 'buy', price: 178000, quantity: 3, amount: 534000, realizedPnl: null, reason: 'HBM 수요 급증 기대, 모멘텀 신호', timestamp: '2026-03-18T10:30:00.000Z', isSimulated: true },
    { id: 'a3', traderId: 'alpha', symbol: '035420', symbolName: 'NAVER', assetType: 'stock_kr', action: 'sell', price: 205000, quantity: 2, amount: 410000, realizedPnl: 14000, reason: '목표가 달성, 차익 실현', timestamp: '2026-03-17T14:20:00.000Z', isSimulated: true },
    { id: 'a4', traderId: 'alpha', symbol: '005930', symbolName: '삼성전자', assetType: 'stock_kr', action: 'buy', price: 61500, quantity: 5, amount: 307500, realizedPnl: null, reason: '20일 이동평균선 지지, 추가 매수', timestamp: '2026-03-16T09:05:00.000Z', isSimulated: true },
    { id: 'a5', traderId: 'alpha', symbol: '035720', symbolName: '카카오', assetType: 'stock_kr', action: 'sell', price: 49000, quantity: 4, amount: 196000, realizedPnl: -4800, reason: '손절 기준 도달, 리스크 관리', timestamp: '2026-03-15T11:45:00.000Z', isSimulated: true },
    { id: 'a6', traderId: 'alpha', symbol: '051910', symbolName: 'LG화학', assetType: 'stock_kr', action: 'buy', price: 335000, quantity: 1, amount: 335000, realizedPnl: null, reason: '배터리 섹터 모멘텀 상승', timestamp: '2026-03-14T09:30:00.000Z', isSimulated: true },
    { id: 'a7', traderId: 'alpha', symbol: '068270', symbolName: '셀트리온', assetType: 'stock_kr', action: 'sell', price: 180000, quantity: 3, amount: 540000, realizedPnl: 15000, reason: '바이오 섹터 단기 고점, 이익 실현', timestamp: '2026-03-13T15:00:00.000Z', isSimulated: true },
    { id: 'a8', traderId: 'alpha', symbol: '005380', symbolName: '현대차', assetType: 'stock_kr', action: 'buy', price: 210000, quantity: 2, amount: 420000, realizedPnl: null, reason: '친환경차 수출 호조, 신규 진입', timestamp: '2026-03-12T09:45:00.000Z', isSimulated: true },
    { id: 'a9', traderId: 'alpha', symbol: '373220', symbolName: 'LG에너지솔루션', assetType: 'stock_kr', action: 'sell', price: 320000, quantity: 1, amount: 320000, realizedPnl: 8000, reason: '목표가 도달, 차익 실현', timestamp: '2026-03-11T13:20:00.000Z', isSimulated: true },
    { id: 'a10', traderId: 'alpha', symbol: '000660', symbolName: 'SK하이닉스', assetType: 'stock_kr', action: 'buy', price: 175000, quantity: 2, amount: 350000, realizedPnl: null, reason: 'AI 반도체 수요 모멘텀 초기 진입', timestamp: '2026-03-10T09:30:00.000Z', isSimulated: true },
  ],
  beta: [
    { id: 'b1', traderId: 'beta', symbol: 'KRW-BTC', symbolName: '비트코인', assetType: 'crypto', action: 'buy', price: 88000000, quantity: 0.05, amount: 4400000, realizedPnl: null, reason: '공포지수 고점, 역추세 매수', timestamp: '2026-03-19T14:00:00.000Z', isSimulated: true },
    { id: 'b2', traderId: 'beta', symbol: 'KRW-ETH', symbolName: '이더리움', assetType: 'crypto', action: 'buy', price: 4850000, quantity: 0.5, amount: 2425000, realizedPnl: null, reason: '과매도 구간 진입, 반등 기대', timestamp: '2026-03-18T16:30:00.000Z', isSimulated: true },
    { id: 'b3', traderId: 'beta', symbol: 'KRW-SOL', symbolName: '솔라나', assetType: 'crypto', action: 'sell', price: 215000, quantity: 2, amount: 430000, realizedPnl: 34000, reason: 'RSI 과매수, 역추세 매도', timestamp: '2026-03-17T10:00:00.000Z', isSimulated: true },
    { id: 'b4', traderId: 'beta', symbol: 'KRW-XRP', symbolName: '리플', assetType: 'crypto', action: 'buy', price: 2900, quantity: 500, amount: 1450000, realizedPnl: null, reason: '급락 후 반등 신호 포착', timestamp: '2026-03-16T12:00:00.000Z', isSimulated: true },
    { id: 'b5', traderId: 'beta', symbol: 'KRW-BTC', symbolName: '비트코인', assetType: 'crypto', action: 'sell', price: 96000000, quantity: 0.03, amount: 2880000, realizedPnl: 120000, reason: '단기 과매수, 부분 차익 실현', timestamp: '2026-03-15T09:00:00.000Z', isSimulated: true },
    { id: 'b6', traderId: 'beta', symbol: 'KRW-DOGE', symbolName: '도지코인', assetType: 'crypto', action: 'buy', price: 250, quantity: 5000, amount: 1250000, realizedPnl: null, reason: '커뮤니티 과대 공포, 역추세 진입', timestamp: '2026-03-14T15:00:00.000Z', isSimulated: true },
    { id: 'b7', traderId: 'beta', symbol: 'KRW-ETH', symbolName: '이더리움', assetType: 'crypto', action: 'sell', price: 5300000, quantity: 0.3, amount: 1590000, realizedPnl: 135000, reason: '목표 수익률 달성, 일부 청산', timestamp: '2026-03-13T11:00:00.000Z', isSimulated: true },
    { id: 'b8', traderId: 'beta', symbol: 'KRW-SOL', symbolName: '솔라나', assetType: 'crypto', action: 'buy', price: 185000, quantity: 3, amount: 555000, realizedPnl: null, reason: '볼린저밴드 하단 터치, 매수', timestamp: '2026-03-12T08:30:00.000Z', isSimulated: true },
    { id: 'b9', traderId: 'beta', symbol: 'KRW-XRP', symbolName: '리플', assetType: 'crypto', action: 'sell', price: 3500, quantity: 300, amount: 1050000, realizedPnl: 180000, reason: '단기 급등 후 차익 실현', timestamp: '2026-03-11T14:00:00.000Z', isSimulated: true },
    { id: 'b10', traderId: 'beta', symbol: 'KRW-BTC', symbolName: '비트코인', assetType: 'crypto', action: 'buy', price: 85000000, quantity: 0.02, amount: 1700000, realizedPnl: null, reason: '200일 이동평균 지지, 역추세 매수', timestamp: '2026-03-10T10:00:00.000Z', isSimulated: true },
  ],
  gamma: [
    { id: 'g1', traderId: 'gamma', symbol: 'NVDA', symbolName: 'NVIDIA', assetType: 'stock_us', action: 'buy', price: 820.0, quantity: 5, amount: 4100.0, realizedPnl: null, reason: 'AI 수요 퀀트 모델 강력 신호', timestamp: '2026-03-19T15:30:00.000Z', isSimulated: true },
    { id: 'g2', traderId: 'gamma', symbol: 'AAPL', symbolName: '애플', assetType: 'stock_us', action: 'buy', price: 205.0, quantity: 10, amount: 2050.0, realizedPnl: null, reason: '매출 성장률 퀀트 팩터 상위권', timestamp: '2026-03-18T16:00:00.000Z', isSimulated: true },
    { id: 'g3', traderId: 'gamma', symbol: 'TSLA', symbolName: '테슬라', assetType: 'stock_us', action: 'sell', price: 200.0, quantity: 5, amount: 1000.0, realizedPnl: -62.0, reason: '모멘텀 팩터 약화, 리밸런싱', timestamp: '2026-03-17T15:45:00.000Z', isSimulated: true },
    { id: 'g4', traderId: 'gamma', symbol: 'MSFT', symbolName: '마이크로소프트', assetType: 'stock_us', action: 'buy', price: 405.0, quantity: 3, amount: 1215.0, realizedPnl: null, reason: '클라우드 수익성 지표 개선', timestamp: '2026-03-16T14:30:00.000Z', isSimulated: true },
    { id: 'g5', traderId: 'gamma', symbol: 'META', symbolName: '메타', assetType: 'stock_us', action: 'sell', price: 530.0, quantity: 2, amount: 1060.0, realizedPnl: 34.0, reason: 'PER 고평가, 퀀트 매도 신호', timestamp: '2026-03-15T15:00:00.000Z', isSimulated: true },
    { id: 'g6', traderId: 'gamma', symbol: 'NVDA', symbolName: 'NVIDIA', assetType: 'stock_us', action: 'buy', price: 790.0, quantity: 3, amount: 2370.0, realizedPnl: null, reason: '실적 서프라이즈 후 모멘텀 가속', timestamp: '2026-03-14T16:00:00.000Z', isSimulated: true },
    { id: 'g7', traderId: 'gamma', symbol: 'AAPL', symbolName: '애플', assetType: 'stock_us', action: 'sell', price: 220.0, quantity: 5, amount: 1100.0, realizedPnl: 75.0, reason: '목표 수익률 달성, 부분 청산', timestamp: '2026-03-13T15:30:00.000Z', isSimulated: true },
    { id: 'g8', traderId: 'gamma', symbol: 'MSFT', symbolName: '마이크로소프트', assetType: 'stock_us', action: 'buy', price: 395.0, quantity: 2, amount: 790.0, realizedPnl: null, reason: 'Azure 성장률 퀀트 팩터 진입', timestamp: '2026-03-12T14:45:00.000Z', isSimulated: true },
    { id: 'g9', traderId: 'gamma', symbol: 'TSLA', symbolName: '테슬라', assetType: 'stock_us', action: 'buy', price: 175.0, quantity: 8, amount: 1400.0, realizedPnl: null, reason: '과매도 후 반등 퀀트 신호', timestamp: '2026-03-11T15:00:00.000Z', isSimulated: true },
    { id: 'g10', traderId: 'gamma', symbol: 'META', symbolName: '메타', assetType: 'stock_us', action: 'buy', price: 495.0, quantity: 3, amount: 1485.0, realizedPnl: null, reason: 'AI 광고 수익 팩터 상승', timestamp: '2026-03-10T15:30:00.000Z', isSimulated: true },
  ],
  delta: [
    { id: 'd1', traderId: 'delta', symbol: '069500', symbolName: 'KODEX 200', assetType: 'etf_kr', action: 'buy', price: 30200, quantity: 20, amount: 604000, realizedPnl: null, reason: '월말 리밸런싱, 코스피 비중 확대', timestamp: '2026-03-19T09:00:00.000Z', isSimulated: true },
    { id: 'd2', traderId: 'delta', symbol: '114800', symbolName: 'KODEX 인버스', assetType: 'etf_kr', action: 'sell', price: 4200, quantity: 50, amount: 210000, realizedPnl: 3500, reason: '헤지 비중 축소, 시장 상승 전망', timestamp: '2026-03-18T09:30:00.000Z', isSimulated: true },
    { id: 'd3', traderId: 'delta', symbol: '069500', symbolName: 'KODEX 200', assetType: 'etf_kr', action: 'buy', price: 30500, quantity: 30, amount: 915000, realizedPnl: null, reason: '글로벌 지수 상승 연동 매수', timestamp: '2026-03-15T09:00:00.000Z', isSimulated: true },
    { id: 'd4', traderId: 'delta', symbol: '069500', symbolName: 'KODEX 200', assetType: 'etf_kr', action: 'sell', price: 31000, quantity: 10, amount: 310000, realizedPnl: 8000, reason: '단기 목표 도달, 분할 매도', timestamp: '2026-03-12T14:00:00.000Z', isSimulated: true },
    { id: 'd5', traderId: 'delta', symbol: '114800', symbolName: 'KODEX 인버스', assetType: 'etf_kr', action: 'buy', price: 4300, quantity: 30, amount: 129000, realizedPnl: null, reason: '단기 조정 헤지 포지션 설정', timestamp: '2026-03-10T09:15:00.000Z', isSimulated: true },
    { id: 'd6', traderId: 'delta', symbol: '069500', symbolName: 'KODEX 200', assetType: 'etf_kr', action: 'buy', price: 29800, quantity: 25, amount: 745000, realizedPnl: null, reason: '저점 매수, 장기 자산배분 전략', timestamp: '2026-03-07T09:00:00.000Z', isSimulated: true },
    { id: 'd7', traderId: 'delta', symbol: '114800', symbolName: 'KODEX 인버스', assetType: 'etf_kr', action: 'sell', price: 4150, quantity: 20, amount: 83000, realizedPnl: -3000, reason: '헤지 조기 청산, 상승장 대응', timestamp: '2026-03-06T10:00:00.000Z', isSimulated: true },
    { id: 'd8', traderId: 'delta', symbol: '069500', symbolName: 'KODEX 200', assetType: 'etf_kr', action: 'buy', price: 30100, quantity: 15, amount: 451500, realizedPnl: null, reason: '분기 초 정기 리밸런싱', timestamp: '2026-03-05T09:00:00.000Z', isSimulated: true },
    { id: 'd9', traderId: 'delta', symbol: '114800', symbolName: 'KODEX 인버스', assetType: 'etf_kr', action: 'buy', price: 4250, quantity: 40, amount: 170000, realizedPnl: null, reason: '변동성 확대 대비 헤지', timestamp: '2026-03-04T09:30:00.000Z', isSimulated: true },
    { id: 'd10', traderId: 'delta', symbol: '069500', symbolName: 'KODEX 200', assetType: 'etf_kr', action: 'sell', price: 30800, quantity: 20, amount: 616000, realizedPnl: 14000, reason: '목표가 도달, 분할 차익 실현', timestamp: '2026-03-03T14:00:00.000Z', isSimulated: true },
  ],
  epsilon: [
    { id: 'e1', traderId: 'epsilon', symbol: '005930', symbolName: '삼성전자', assetType: 'stock_kr', action: 'buy', price: 63500, quantity: 5, amount: 317500, realizedPnl: null, reason: '코스피-나스닥 스프레드 수렴 신호', timestamp: '2026-03-19T09:15:00.000Z', isSimulated: true },
    { id: 'e2', traderId: 'epsilon', symbol: 'KRW-BTC', symbolName: '비트코인', assetType: 'crypto', action: 'buy', price: 92000000, quantity: 0.02, amount: 1840000, realizedPnl: null, reason: '달러-비트코인 상관관계 차익', timestamp: '2026-03-18T11:00:00.000Z', isSimulated: true },
    { id: 'e3', traderId: 'epsilon', symbol: '000660', symbolName: 'SK하이닉스', assetType: 'stock_kr', action: 'sell', price: 190000, quantity: 3, amount: 570000, realizedPnl: 36000, reason: '반도체-AI 크로스에셋 스프레드 축소', timestamp: '2026-03-17T14:30:00.000Z', isSimulated: true },
    { id: 'e4', traderId: 'epsilon', symbol: 'KRW-ETH', symbolName: '이더리움', assetType: 'crypto', action: 'sell', price: 5200000, quantity: 0.3, amount: 1560000, realizedPnl: 105000, reason: 'ETH-주식 상관관계 이탈, 차익 실현', timestamp: '2026-03-16T10:00:00.000Z', isSimulated: true },
    { id: 'e5', traderId: 'epsilon', symbol: '005930', symbolName: '삼성전자', assetType: 'stock_kr', action: 'buy', price: 62800, quantity: 4, amount: 251200, realizedPnl: null, reason: '환율 헤지 연계 매수', timestamp: '2026-03-15T09:30:00.000Z', isSimulated: true },
    { id: 'e6', traderId: 'epsilon', symbol: 'KRW-BTC', symbolName: '비트코인', assetType: 'crypto', action: 'sell', price: 95000000, quantity: 0.01, amount: 950000, realizedPnl: 30000, reason: '글로벌 리스크온 피크, 차익 실현', timestamp: '2026-03-14T15:00:00.000Z', isSimulated: true },
    { id: 'e7', traderId: 'epsilon', symbol: '035420', symbolName: 'NAVER', assetType: 'stock_kr', action: 'buy', price: 195000, quantity: 2, amount: 390000, realizedPnl: null, reason: '테크 크로스에셋 수렴 포지션', timestamp: '2026-03-13T09:45:00.000Z', isSimulated: true },
    { id: 'e8', traderId: 'epsilon', symbol: 'KRW-SOL', symbolName: '솔라나', assetType: 'crypto', action: 'buy', price: 188000, quantity: 1, amount: 188000, realizedPnl: null, reason: '알트코인 스프레드 전략 진입', timestamp: '2026-03-12T13:00:00.000Z', isSimulated: true },
    { id: 'e9', traderId: 'epsilon', symbol: '000660', symbolName: 'SK하이닉스', assetType: 'stock_kr', action: 'buy', price: 182000, quantity: 2, amount: 364000, realizedPnl: null, reason: 'NVDA-SK하이닉스 스프레드 차익', timestamp: '2026-03-11T09:30:00.000Z', isSimulated: true },
    { id: 'e10', traderId: 'epsilon', symbol: 'KRW-ETH', symbolName: '이더리움', assetType: 'crypto', action: 'buy', price: 4780000, quantity: 0.4, amount: 1912000, realizedPnl: null, reason: '크로스에셋 비율 재조정 매수', timestamp: '2026-03-10T11:00:00.000Z', isSimulated: true },
  ],
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const trader = TRADERS.find((t) => t.id === params.id);

  if (!trader) {
    return NextResponse.json({ error: '트레이더를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 10);
  const trades = (TRADES_MAP[params.id] ?? []).slice(0, limit);

  return NextResponse.json({ data: trades });
}
