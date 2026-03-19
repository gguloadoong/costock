/**
 * AI 트레이더 엔진 (Phase 0 — In-Memory Mock)
 *
 * 아키텍처:
 *   traderEngine (in-memory) → 서버 시작 시 3/1~3/19 백필 1회 생성
 *                            → 이후 1분 인터벌 실시간 매매 결정
 *                            → tradeEventEmitter 이벤트 발행
 *                            → ws/traders 엔드포인트가 구독 → WebSocket 브로드캐스트
 *
 * Phase 1 전환 시: in-memory store → Redis + TimescaleDB
 * 실제 자금 없는 모의투자 전용. 모든 응답에 isSimulated: true 포함.
 */

import { EventEmitter } from 'events'
import { logger } from './logger'
import { getPrice } from './priceService'

// ─── 상수 ─────────────────────────────────────────────────────────────────

const TRADE_INTERVAL_MS   = 60_000       // 1분 매매 인터벌
const MAX_HISTORY_PER_TRADER = 200       // 히스토리 보관 최대 건수
const INITIAL_CAPITAL     = 100_000_000  // 초기 자본금 (1억 원)

// 백필 영업일 목록 (2026-03-01 ~ 2026-03-19, 3/1은 일요일 제외)
const BACKFILL_DATES: string[] = [
  '2026-03-02',
  '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06',
  '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13',
  '2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19',
]
// 총 14 영업일

// ─── 타입 정의 ────────────────────────────────────────────────────────────

export type AssetType = 'stock_kr' | 'stock_us' | 'crypto' | 'etf_kr' | 'mixed'
export type TradeAction = 'buy' | 'sell'
export type TraderStrategy =
  | 'momentum_kr'
  | 'contrarian_crypto'
  | 'quant_us'
  | 'etf_allocation'
  | 'crossasset_arb'

export interface TraderProfile {
  id: string
  nameKr: string
  nameEn: string
  strategy: TraderStrategy
  strategyDesc: string
  universe: string[]
  assetType: AssetType
  color: string
  initialCapital: number
  createdAt: string
  // 백필 파라미터
  targetReturn: number       // 3/1→3/19 목표 수익률 (소수, 예: -0.028)
  dailyVolatility: number    // 일간 변동성 (소수, 예: 0.008)
  avgTradePeriod: number     // 평균 매매 주기 (영업일)
}

export interface Position {
  symbol: string
  symbolName: string
  assetType: AssetType
  quantity: number
  avgPrice: number
  currentPrice: number
  unrealizedPnl: number
  unrealizedPnlRate: number
  openedAt: string
}

export interface Trade {
  id: string
  traderId: string
  symbol: string
  symbolName: string
  assetType: AssetType
  action: TradeAction
  price: number
  quantity: number
  amount: number
  realizedPnl: number | null
  reason: string
  timestamp: string
  isSimulated: true
}

export interface TraderStats {
  totalReturn: number
  totalReturnAmount: number
  winRate: number
  totalTrades: number
  currentCapital: number
  portfolioValue: number
  maxDrawdown: number
  sharpeRatio: number
}

export interface TradeEvent {
  type: 'trade'
  traderId: string
  action: TradeAction
  symbol: string
  symbolName: string
  price: number
  quantity: number
  amount: number
  reason: string
  timestamp: string
  isSimulated: true
  portfolioValue: number
  totalReturn: number
}

export interface PositionUpdateEvent {
  type: 'position_update'
  traderId: string
  positions: Position[]
  stats: TraderStats
  timestamp: string
}

export type TraderWsEvent = TradeEvent | PositionUpdateEvent

// ─── 트레이더 정의 ────────────────────────────────────────────────────────

const TRADER_PROFILES: TraderProfile[] = [
  {
    id: 'alpha',
    nameKr: '알파',
    nameEn: 'Alpha',
    strategy: 'momentum_kr',
    strategyDesc: '국내주식 모멘텀 전략 — 52주 신고가 돌파 + 거래량 급증 시 매수, RSI 과매수 시 매도',
    universe: ['005930', '000660', '035420', '005380', '068270'],
    assetType: 'stock_kr',
    color: '#6366F1',
    initialCapital: INITIAL_CAPITAL,
    createdAt: '2026-03-01T09:00:00.000Z',
    targetReturn: -0.028,
    dailyVolatility: 0.008,
    avgTradePeriod: 4,
  },
  {
    id: 'beta',
    nameKr: '베타',
    nameEn: 'Beta',
    strategy: 'contrarian_crypto',
    strategyDesc: '코인 역추세 전략 — 공포탐욕지수 극단값에서 역매매, 변동성 확대 시 분할 진입',
    universe: ['KRW-BTC', 'KRW-ETH', 'KRW-SOL', 'KRW-XRP'],
    assetType: 'crypto',
    color: '#F59E0B',
    initialCapital: INITIAL_CAPITAL,
    createdAt: '2026-03-01T09:00:00.000Z',
    targetReturn: 0.053,
    dailyVolatility: 0.015,
    avgTradePeriod: 2.5,
  },
  {
    id: 'gamma',
    nameKr: '감마',
    nameEn: 'Gamma',
    strategy: 'quant_us',
    strategyDesc: '미국주식 퀀트 전략 — 팩터 모델(모멘텀+퀄리티+밸류) 기반 포트폴리오 리밸런싱',
    universe: ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'META', 'AMZN', 'GOOGL'],
    assetType: 'stock_us',
    color: '#10B981',
    initialCapital: INITIAL_CAPITAL,
    createdAt: '2026-03-01T09:00:00.000Z',
    targetReturn: -0.015,
    dailyVolatility: 0.007,
    avgTradePeriod: 3,
  },
  {
    id: 'delta',
    nameKr: '델타',
    nameEn: 'Delta',
    strategy: 'etf_allocation',
    strategyDesc: 'ETF 자산배분 전략 — 레이달리오 올웨더 변형, 분산투자로 하락장 방어',
    universe: ['069500', '229200', '360750', 'SPY', 'QQQ'],
    assetType: 'etf_kr',
    color: '#EC4899',
    initialCapital: INITIAL_CAPITAL,
    createdAt: '2026-03-01T09:00:00.000Z',
    targetReturn: 0.011,
    dailyVolatility: 0.004,
    avgTradePeriod: 7,
  },
  {
    id: 'epsilon',
    nameKr: '엡실론',
    nameEn: 'Epsilon',
    strategy: 'crossasset_arb',
    strategyDesc: '크로스에셋 차익거래 — 한국/미국 상관관계 붕괴 시 차익 포착, 3월 변동성 활용',
    universe: ['005930', 'NVDA', 'KRW-BTC', '069500', 'SPY'],
    assetType: 'mixed',
    color: '#8B5CF6',
    initialCapital: INITIAL_CAPITAL,
    createdAt: '2026-03-01T09:00:00.000Z',
    targetReturn: 0.037,
    dailyVolatility: 0.011,
    avgTradePeriod: 5,
  },
]

// ─── 심볼 메타데이터 ──────────────────────────────────────────────────────

const SYMBOL_NAMES: Record<string, string> = {
  // 국내주식
  '005930': '삼성전자',
  '000660': 'SK하이닉스',
  '035420': 'NAVER',
  '005380': '현대차',
  '068270': '셀트리온',
  // 국내 ETF
  '069500': 'KODEX 200',
  '229200': 'KODEX 코스닥150',
  '360750': 'TIGER 미국S&P500',
  // 코인
  'KRW-BTC': '비트코인',
  'KRW-ETH': '이더리움',
  'KRW-SOL': '솔라나',
  'KRW-XRP': '리플',
  // 미국주식·ETF
  'NVDA': 'NVIDIA',
  'AAPL': 'Apple',
  'MSFT': 'Microsoft',
  'TSLA': 'Tesla',
  'META': 'Meta',
  'AMZN': 'Amazon',
  'GOOGL': 'Alphabet',
  'SPY': 'S&P 500 ETF',
  'QQQ': 'Nasdaq-100 ETF',
}

// 심볼별 기준가 (3/19 실제 시세 기준, 통화 단위는 priceService와 동일)
// 국내주식/ETF/코인: KRW, 미국주식/ETF: USD
const BASE_PRICES: Record<string, number> = {
  // 국내주식 (KRW) — KIS API 실시간
  '005930':   200_750,   // 삼성전자
  '000660':   195_000,   // SK하이닉스
  '035420':   221_000,   // NAVER
  '005380':   522_500,   // 현대차
  '068270':   203_000,   // 셀트리온
  // 국내ETF (KRW) — KIS API 실시간
  '069500':    86_980,   // KODEX 200
  '229200':    19_865,   // KODEX 코스닥150
  '360750':    24_655,   // TIGER 미국S&P500
  // 코인 (KRW) — 업비트 실시간
  'KRW-BTC':  105_470_000,
  'KRW-ETH':    3_271_000,
  'KRW-SOL':      134_000,
  'KRW-XRP':        2_180,
  // 미국주식/ETF (USD) — yahoo-finance2 실시간
  'NVDA':   180,
  'AAPL':   250,
  'MSFT':   392,
  'TSLA':   393,
  'META':   616,
  'AMZN':   210,
  'GOOGL':  308,
  'SPY':    661,
  'QQQ':    595,
  'TQQQ':    46,
  'SOXL':    54,
}

// 심볼의 assetType (혼합 트레이더 epsilon 포지션 저장에 사용)
const SYMBOL_ASSET_TYPE: Record<string, AssetType> = {
  '005930': 'stock_kr',
  '000660': 'stock_kr',
  '035420': 'stock_kr',
  '005380': 'stock_kr',
  '068270': 'stock_kr',
  '069500': 'etf_kr',
  '229200': 'etf_kr',
  '360750': 'etf_kr',
  'KRW-BTC': 'crypto',
  'KRW-ETH': 'crypto',
  'KRW-SOL': 'crypto',
  'KRW-XRP': 'crypto',
  'NVDA': 'stock_us',
  'AAPL': 'stock_us',
  'MSFT': 'stock_us',
  'TSLA': 'stock_us',
  'META': 'stock_us',
  'AMZN': 'stock_us',
  'GOOGL': 'stock_us',
  'SPY': 'stock_us',
  'QQQ': 'stock_us',
}

// ─── 매매 이유 템플릿 ─────────────────────────────────────────────────────

const TRADE_REASONS: Record<TraderStrategy, { buy: string[]; sell: string[] }> = {
  momentum_kr: {
    buy: [
      '52주 신고가 돌파 + 거래량 전일 대비 280% 급증',
      '이동평균선 골든크로스 (20일 > 60일) 확인',
      '외국인 순매수 연속 4일, 기관 동반 매수 신호',
      '실적 서프라이즈 후 눌림목 완성, 모멘텀 재개 예상',
      '섹터 로테이션 수혜주 — 반도체 업황 회복 시그널',
    ],
    sell: [
      'RSI(14) 78 초과 — 단기 과매수 구간 진입',
      '목표가 도달, 수익 실현 (매수가 대비 +12%)',
      '거래량 급감 + 음봉 — 상승 모멘텀 소멸',
      '리스크 관리: 손절 기준 -7% 도달',
      '섹터 약세 전환, 포지션 축소',
    ],
  },
  contrarian_crypto: {
    buy: [
      '공포탐욕지수 18 — 극단적 공포 구간, 역추세 매수',
      '펀딩레이트 음수 전환 — 숏 포지션 과다, 반등 기대',
      '200일 이동평균선 지지 확인 + 거래량 급증',
      'BTC 도미넌스 급락 — 알트코인 시즌 초입 진단',
      '온체인 고래 주소 대량 매집 신호 감지',
    ],
    sell: [
      '공포탐욕지수 82 — 극단적 탐욕, 분할 매도 시작',
      '펀딩레이트 0.9% 초과 — 레버리지 과열, 조정 임박',
      '목표가 도달, 수익 실현 (매수가 대비 +28%)',
      '거래소 입금량 급증 — 매도 압력 증가 신호',
      '리스크 관리: 손절 기준 -12% 도달',
    ],
  },
  quant_us: {
    buy: [
      '팩터 스코어 상위 10% 편입 — 모멘텀+퀄리티+밸류 복합',
      '12개월 모멘텀 상위 분위 + 낮은 변동성 조건 충족',
      '분기 리밸런싱 — 포트폴리오 최적 비중 조정',
      'PEG 비율 0.9 미만, 이익 성장률 22% 이상 — 밸류 매수',
      'ROE 18% 이상 + 부채비율 35% 미만 — 퀄리티 팩터 매수',
    ],
    sell: [
      '팩터 스코어 하위 30% 이탈 — 모멘텀 소멸',
      '목표 비중 초과로 리밸런싱 매도',
      '어닝 미스 + 가이던스 하향 — 퀄리티 팩터 악화',
      '밸류에이션 버블 구간 (PEG > 2.3) 진입',
      '리스크 관리: 포지션 최대 손실 한도 도달',
    ],
  },
  etf_allocation: {
    buy: [
      '자산배분 비중 이탈 → 리밸런싱 매수 (목표 비중 ±5% 초과)',
      '변동성 축소 국면 진입 — 안전자산 비중 확대',
      '채권-주식 상관관계 음전환 — 올웨더 신호',
      '월간 정기 리밸런싱 — 드리프트 조정',
      '인플레이션 연동 자산 비중 부족, 추가 매수',
    ],
    sell: [
      '목표 비중 초과 — 리밸런싱 매도',
      '변동성 급등 국면 전환 — 위험 자산 비중 축소',
      '월간 정기 리밸런싱 — 초과 수익 실현',
      '자산군 상관관계 붕괴 — 포트폴리오 재구성',
      '현금 비중 확보 필요 — 분할 매도',
    ],
  },
  crossasset_arb: {
    buy: [
      '한미 상관계수 이탈 포착 — 코스피-S&P 스프레드 확대',
      '코인-주식 동조화 붕괴 — 비연동 자산 차익 기회',
      '환율 급변 → 원화 약세 수혜 해외 자산 매수',
      'ADR 괴리율 3% 이상 — 차익거래 진입 조건 충족',
      '선물-현물 베이시스 급확대 — 현물 저평가 매수',
    ],
    sell: [
      '스프레드 수렴 완료 — 차익 실현',
      '상관관계 정상화 — 포지션 청산',
      '목표 스프레드 달성 (진입 대비 -2.5%p 수렴)',
      '리스크 이벤트 발생 — 차익거래 전략 중단',
      '환율 방향 전환 — 헤지 비용 증가로 청산',
    ],
  },
}

// ─── In-Memory 상태 ───────────────────────────────────────────────────────

interface TraderState {
  profile: TraderProfile
  capital: number
  positions: Map<string, Position>
  trades: Trade[]
  simPrices: Record<string, number>
  peakValue: number
}

// ─── 이벤트 이미터 ────────────────────────────────────────────────────────

export const tradeEventEmitter = new EventEmitter()
tradeEventEmitter.setMaxListeners(1000)

// ─── 유틸 함수 ────────────────────────────────────────────────────────────

function generateTradeId(ts?: string): string {
  const suffix = Math.random().toString(36).slice(2, 8)
  return ts ? `trade_${ts.replace(/\D/g, '')}_${suffix}` : `trade_${Date.now()}_${suffix}`
}

function toPriceServiceSymbol(symbol: string): string {
  if (/^\d{6}$/.test(symbol)) return `${symbol}.KS`
  return symbol
}

// 미국주식/ETF 심볼 여부 (가격이 USD 단위)
// 국내 6자리 종목코드, KRW- 코인, 국내 ETF(069500 등)는 KRW
const USD_SYMBOLS = new Set(['NVDA','AAPL','MSFT','TSLA','META','AMZN','GOOGL','SPY','QQQ','TQQQ','SOXL'])

function isUsdSymbol(symbol: string): boolean {
  return USD_SYMBOLS.has(symbol)
}

// 환율 (KRW/USD) — Phase 0 고정값, Phase 1에서 실시간 환율 API로 교체
const USD_KRW_RATE = 1_380

/** KRW 예산으로 해당 심볼을 살 수 있는 수량 계산 (통화 단위 자동 변환) */
function calcQuantity(budgetKrw: number, price: number, symbol: string): number {
  const priceInKrw = isUsdSymbol(symbol) ? price * USD_KRW_RATE : price
  return Math.max(1, Math.floor(budgetKrw / priceInKrw))
}

/** 특정 심볼의 현재가: priceService 우선, 없으면 simPrices fallback */
function getSimulatedPrice(state: TraderState, symbol: string): number {
  const realPrice = getPrice(toPriceServiceSymbol(symbol))
  if (realPrice && realPrice.price > 0) {
    state.simPrices[symbol] = realPrice.price
    return realPrice.price
  }

  const base    = BASE_PRICES[symbol] ?? 10_000
  const current = state.simPrices[symbol] ?? base
  const pct     = (Math.random() - 0.5) * 0.016
  const next    = Math.max(base * 0.3, current * (1 + pct))
  state.simPrices[symbol] = next
  return Math.round(next)
}

function symbolAssetType(profile: TraderProfile, symbol: string): AssetType {
  if (profile.assetType !== 'mixed' && profile.assetType !== 'etf_kr') {
    return profile.assetType
  }
  return SYMBOL_ASSET_TYPE[symbol] ?? profile.assetType
}

function calcStats(state: TraderState): TraderStats {
  let portfolioValue = state.capital

  for (const [sym, pos] of state.positions) {
    const livePrice = getSimulatedPrice(state, sym)
    pos.currentPrice = livePrice
    portfolioValue += livePrice * pos.quantity
  }

  const totalReturnAmount = portfolioValue - state.profile.initialCapital
  const totalReturn       = totalReturnAmount / state.profile.initialCapital  // 소수점 (0.0213 = 2.13%)

  if (portfolioValue > state.peakValue) {
    state.peakValue = portfolioValue
  }

  const maxDrawdown =
    state.peakValue > 0
      ? (state.peakValue - portfolioValue) / state.peakValue  // 소수점
      : 0

  const sells   = state.trades.filter((t) => t.action === 'sell' && t.realizedPnl !== null)
  const wins    = sells.filter((t) => (t.realizedPnl ?? 0) > 0)
  const winRate = sells.length > 0 ? wins.length / sells.length : 0  // 소수점 (0.667 = 66.7%)

  const sharpeRatio = totalReturn > 0 ? Math.min(totalReturn * 100 / 8, 3.5) : Math.max(totalReturn * 100 / 8, -1.5)

  return {
    totalReturn:       Math.round(totalReturn * 10000) / 10000,
    totalReturnAmount: Math.round(totalReturnAmount),
    winRate:           Math.round(winRate * 1000) / 1000,
    totalTrades:       state.trades.length,
    currentCapital:    Math.round(state.capital),
    portfolioValue:    Math.round(portfolioValue),
    maxDrawdown:       Math.round(maxDrawdown * 10000) / 10000,
    sharpeRatio:       Math.round(sharpeRatio * 100) / 100,
  }
}

function buildPosition(state: TraderState, symbol: string): Position {
  const pos          = state.positions.get(symbol)!
  const currentPrice = getSimulatedPrice(state, symbol)
  const unrealizedPnl     = (currentPrice - pos.avgPrice) * pos.quantity
  const unrealizedPnlRate = ((currentPrice - pos.avgPrice) / pos.avgPrice) * 100

  return {
    ...pos,
    currentPrice,
    unrealizedPnl:     Math.round(unrealizedPnl),
    unrealizedPnlRate: Math.round(unrealizedPnlRate * 100) / 100,
  }
}

// ─── 백필 시뮬레이션 ──────────────────────────────────────────────────────

/**
 * 시드 기반 부동 소수점 의사난수 생성 (재현 가능한 백필용)
 * LCG (Linear Congruential Generator)
 */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/**
 * 브라운 운동 + drift로 날짜별 가격 경로 생성
 * currentPrice(3/19 기준) → 역산하여 3/2 시작가 결정 후 forward path 생성
 */
function generateHistoricalPrices(
  symbol: string,
  targetReturn: number,   // 전체 기간 수익률 (예: -0.028)
  dailyVolatility: number,
  seed: number,
): Map<string, number> {
  const rng       = seededRandom(seed)
  const n         = BACKFILL_DATES.length  // 14
  const endPrice  = BASE_PRICES[symbol] ?? 10_000

  // 3/2 시작가 = 3/19 현재가 / (1 + totalReturn)
  // 단, 트레이더 수익률은 포트폴리오 전체이므로 종목별 편차 ±30% 추가
  const symbolDrift = (rng() - 0.5) * 0.6  // ±30% 개별 편차
  const symbolReturn = targetReturn * (1 + symbolDrift)
  const startPrice = endPrice / (1 + symbolReturn)

  // drift per day: (endPrice/startPrice)^(1/n) - 1
  const driftPerDay = Math.pow(endPrice / startPrice, 1 / (n - 1)) - 1

  const prices = new Map<string, number>()
  let price = startPrice

  for (let i = 0; i < n; i++) {
    const date = BACKFILL_DATES[i]!
    // Box-Muller 정규분포 근사 (LCG 2개 사용)
    const u1 = Math.max(1e-10, rng())
    const u2 = rng()
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    const noise = dailyVolatility * z

    if (i > 0) {
      price = price * (1 + driftPerDay + noise)
    }
    prices.set(date, Math.round(Math.max(price * 0.3, price)))
  }

  // 마지막 날짜(3/19)는 정확히 endPrice로 고정
  prices.set('2026-03-19', endPrice)

  return prices
}

/**
 * 특정 날짜의 HH:MM:SS 랜덤 거래 시각 생성 (09:00~15:30 사이)
 */
function randomTradeTime(date: string, rng: () => number): string {
  // 09:00 ~ 15:30 → 390분
  const minFromOpen = Math.floor(rng() * 390)
  const hour   = 9  + Math.floor(minFromOpen / 60)
  const minute = minFromOpen % 60
  const second = Math.floor(rng() * 60)
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000Z`
}

interface BackfillBuyRecord {
  symbol: string
  price: number
  quantity: number
  amount: number
  timestamp: string
  dateIndex: number
}

/**
 * 트레이더 백필 거래 이력 생성 및 상태 세팅
 *
 * 로직:
 *  1. 날짜별 가격 경로 생성
 *  2. avgTradePeriod 기준으로 매수 날짜 선택
 *  3. 매수 후 N일 보유 → 매도 (매도일이 3/19 이내면 실현, 이후면 미실현 포지션)
 *  4. 최종 수익률이 targetReturn에 근사하도록 포지션 유지/청산 비율 조정
 */
function buildBackfill(state: TraderState): void {
  const profile   = state.profile
  const rng       = seededRandom(profile.id.charCodeAt(0) * 137 + 42)
  const universe  = profile.universe

  // 심볼별 날짜별 가격 맵
  const priceMaps = new Map<string, Map<string, number>>()
  universe.forEach((sym, idx) => {
    priceMaps.set(
      sym,
      generateHistoricalPrices(sym, profile.targetReturn, profile.dailyVolatility, idx * 997 + profile.id.charCodeAt(0)),
    )
  })

  // 예산: 총 자본의 60~80%를 거래에 투입
  const tradeBudget      = INITIAL_CAPITAL * (0.60 + rng() * 0.20)
  const totalTradeDays   = BACKFILL_DATES.length  // 14
  const avgPeriod        = profile.avgTradePeriod

  // 총 매수 횟수 결정
  const buyCount = Math.max(2, Math.round(totalTradeDays / avgPeriod))

  // 매수일 선택: 앞쪽 9일 이내에서 랜덤 분산
  const maxBuyDateIdx = Math.min(totalTradeDays - 2, 9)
  const buyDateIndices: number[] = []

  // 가능하면 고르게 분산
  const step = maxBuyDateIdx / buyCount
  for (let i = 0; i < buyCount; i++) {
    const base   = Math.floor(i * step)
    const jitter = Math.floor(rng() * Math.max(1, Math.floor(step)))
    buyDateIndices.push(Math.min(maxBuyDateIdx, base + jitter))
  }

  // 매수 예산 분배: 균등하게
  const perBuyBudget = tradeBudget / buyCount

  const openBuys: BackfillBuyRecord[] = []

  for (let b = 0; b < buyCount; b++) {
    const buyDateIdx = buyDateIndices[b] ?? 0
    const buyDate    = BACKFILL_DATES[buyDateIdx]!
    // 유니버스에서 심볼 선택 (이미 보유 중이면 다른 종목 우선)
    const heldSyms   = new Set(openBuys.filter((o) => o.dateIndex <= buyDateIdx).map((o) => o.symbol))
    const candidates = universe.filter((s) => !heldSyms.has(s))
    const sym        = (candidates.length > 0 ? candidates : universe)[Math.floor(rng() * (candidates.length || universe.length))]!

    const priceMap  = priceMaps.get(sym)!
    const buyPrice  = priceMap.get(buyDate) ?? (BASE_PRICES[sym] ?? 10_000)
    const quantity  = calcQuantity(perBuyBudget, buyPrice, sym)
    const amount    = buyPrice * quantity
    const timestamp = randomTradeTime(buyDate, rng)

    openBuys.push({ symbol: sym, price: buyPrice, quantity, amount, timestamp, dateIndex: buyDateIdx })

    state.capital -= amount

    const buyTrade: Trade = {
      id:         generateTradeId(timestamp),
      traderId:   profile.id,
      symbol:     sym,
      symbolName: SYMBOL_NAMES[sym] ?? sym,
      assetType:  symbolAssetType(profile, sym),
      action:     'buy',
      price:      buyPrice,
      quantity,
      amount,
      realizedPnl: null,
      reason:      TRADE_REASONS[profile.strategy].buy[Math.floor(rng() * TRADE_REASONS[profile.strategy].buy.length)]!,
      timestamp,
      isSimulated: true,
    }
    state.trades.push(buyTrade)

    // 매도 날짜 결정: 매수일 + holdingDays (1~avgPeriod*2일)
    const holdingDays = Math.max(1, Math.round(avgPeriod * (0.5 + rng() * 1.5)))
    const sellDateIdx = buyDateIdx + holdingDays

    if (sellDateIdx < totalTradeDays) {
      // 백필 기간 내 매도 → 실현손익
      const sellDate    = BACKFILL_DATES[sellDateIdx]!
      const sellPriceMap = priceMaps.get(sym)!
      const sellPrice   = sellPriceMap.get(sellDate) ?? buyPrice
      const sellTimestamp = randomTradeTime(sellDate, rng)

      // 전량 또는 부분 매도 (70% 확률로 전량)
      const sellQty     = rng() < 0.70 ? quantity : Math.max(1, Math.floor(quantity * (0.4 + rng() * 0.4)))
      const sellAmount  = sellPrice * sellQty
      const realizedPnl = (sellPrice - buyPrice) * sellQty

      state.capital += sellAmount

      const sellTrade: Trade = {
        id:          generateTradeId(sellTimestamp),
        traderId:    profile.id,
        symbol:      sym,
        symbolName:  SYMBOL_NAMES[sym] ?? sym,
        assetType:   symbolAssetType(profile, sym),
        action:      'sell',
        price:       sellPrice,
        quantity:    sellQty,
        amount:      Math.round(sellAmount),
        realizedPnl: Math.round(realizedPnl),
        reason:      TRADE_REASONS[profile.strategy].sell[Math.floor(rng() * TRADE_REASONS[profile.strategy].sell.length)]!,
        timestamp:   sellTimestamp,
        isSimulated: true,
      }
      state.trades.push(sellTrade)

      // 잔여 수량이 있으면 미실현 포지션으로 유지
      const remainQty = quantity - sellQty
      if (remainQty > 0) {
        const currentPrice = BASE_PRICES[sym] ?? buyPrice
        const existing     = state.positions.get(sym)
        if (existing) {
          const totalQty  = existing.quantity + remainQty
          const totalCost = existing.avgPrice * existing.quantity + buyPrice * remainQty
          existing.avgPrice  = Math.round(totalCost / totalQty)
          existing.quantity  = totalQty
          existing.currentPrice = currentPrice
        } else {
          state.positions.set(sym, {
            symbol:             sym,
            symbolName:         SYMBOL_NAMES[sym] ?? sym,
            assetType:          symbolAssetType(profile, sym),
            quantity:           remainQty,
            avgPrice:           buyPrice,
            currentPrice,
            unrealizedPnl:      Math.round((currentPrice - buyPrice) * remainQty),
            unrealizedPnlRate:  Math.round(((currentPrice - buyPrice) / buyPrice) * 10000) / 100,
            openedAt:           timestamp,
          })
        }
      }
    } else {
      // 매도일이 3/19 이후 → 미실현 포지션으로 보유 중
      const currentPrice = BASE_PRICES[sym] ?? buyPrice
      const existing     = state.positions.get(sym)
      if (existing) {
        const totalQty  = existing.quantity + quantity
        const totalCost = existing.avgPrice * existing.quantity + buyPrice * quantity
        existing.avgPrice  = Math.round(totalCost / totalQty)
        existing.quantity  = totalQty
        existing.currentPrice = currentPrice
      } else {
        state.positions.set(sym, {
          symbol:             sym,
          symbolName:         SYMBOL_NAMES[sym] ?? sym,
          assetType:          symbolAssetType(profile, sym),
          quantity,
          avgPrice:           buyPrice,
          currentPrice,
          unrealizedPnl:      Math.round((currentPrice - buyPrice) * quantity),
          unrealizedPnlRate:  Math.round(((currentPrice - buyPrice) / buyPrice) * 10000) / 100,
          openedAt:           timestamp,
        })
      }
    }
  }

  // 거래 이력 타임스탬프 기준 오름차순 정렬
  state.trades.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  // 포지션 현재가를 실제 가격(priceService 우선, fallback BASE_PRICES)으로 갱신
  let portfolioValue = state.capital
  for (const [sym, pos] of state.positions) {
    const currentPrice     = getSimulatedPrice(state, sym)
    pos.currentPrice       = currentPrice
    pos.unrealizedPnl      = Math.round((currentPrice - pos.avgPrice) * pos.quantity)
    pos.unrealizedPnlRate  = Math.round(((currentPrice - pos.avgPrice) / pos.avgPrice) * 10000) / 100
    portfolioValue += currentPrice * pos.quantity
  }

  // peakValue: 현재 포트폴리오 가치와 초기 자본 중 큰 값으로 설정
  state.peakValue = Math.max(portfolioValue, INITIAL_CAPITAL)
}

// ─── 실시간 매매 (1분 인터벌) ─────────────────────────────────────────────

function executeBuy(state: TraderState, symbol: string, overrideReason?: string): Trade | null {
  const price          = getSimulatedPrice(state, symbol)
  const allocationRate = 0.05 + Math.random() * 0.10
  const budget         = state.capital * allocationRate
  const quantity       = calcQuantity(budget, price, symbol)
  const amount         = price * quantity

  if (amount > state.capital) return null

  state.capital -= amount

  const existing = state.positions.get(symbol)
  if (existing) {
    const totalQty  = existing.quantity + quantity
    const totalCost = existing.avgPrice * existing.quantity + price * quantity
    existing.avgPrice = Math.round(totalCost / totalQty)
    existing.quantity = totalQty
  } else {
    state.positions.set(symbol, {
      symbol,
      symbolName:        SYMBOL_NAMES[symbol] ?? symbol,
      assetType:         symbolAssetType(state.profile, symbol),
      quantity,
      avgPrice:          price,
      currentPrice:      price,
      unrealizedPnl:     0,
      unrealizedPnlRate: 0,
      openedAt:          new Date().toISOString(),
    })
  }

  const reasons = TRADE_REASONS[state.profile.strategy].buy
  const reason  = overrideReason ?? reasons[Math.floor(Math.random() * reasons.length)]!

  return {
    id:          generateTradeId(),
    traderId:    state.profile.id,
    symbol,
    symbolName:  SYMBOL_NAMES[symbol] ?? symbol,
    assetType:   symbolAssetType(state.profile, symbol),
    action:      'buy',
    price,
    quantity,
    amount,
    realizedPnl: null,
    reason,
    timestamp:   new Date().toISOString(),
    isSimulated: true,
  }
}

function executeSell(state: TraderState, symbol: string, overrideReason?: string): Trade | null {
  const pos = state.positions.get(symbol)
  if (!pos || pos.quantity === 0) return null

  const price       = getSimulatedPrice(state, symbol)
  const quantity    = Math.random() > 0.5 ? pos.quantity : Math.max(1, Math.floor(pos.quantity / 2))
  const amount      = price * quantity
  const realizedPnl = (price - pos.avgPrice) * quantity

  state.capital += amount

  if (quantity >= pos.quantity) {
    state.positions.delete(symbol)
  } else {
    pos.quantity -= quantity
  }

  const reasons = TRADE_REASONS[state.profile.strategy].sell
  const reason  = overrideReason ?? reasons[Math.floor(Math.random() * reasons.length)]!

  return {
    id:          generateTradeId(),
    traderId:    state.profile.id,
    symbol,
    symbolName:  SYMBOL_NAMES[symbol] ?? symbol,
    assetType:   symbolAssetType(state.profile, symbol),
    action:      'sell',
    price,
    quantity,
    amount:      Math.round(amount),
    realizedPnl: Math.round(realizedPnl),
    reason,
    timestamp:   new Date().toISOString(),
    isSimulated: true,
  }
}

function decideTrade(state: TraderState): { symbol: string; action: TradeAction; reason?: string } | null {
  const universe    = state.profile.universe
  const heldSymbols = [...state.positions.keys()]
  const rand        = Math.random()
  const strategy    = state.profile.strategy

  // ── 알파 (momentum_kr) ─────────────────────────────────────────────────
  // 현재가 vs 직전 simPrice 비교로 모멘텀 판단
  // 관망 50%, 손절 조건 우선, 모멘텀 확인 시 매수 확률 증가
  if (strategy === 'momentum_kr') {
    if (rand < 0.50) return null  // 관망 50%

    // 보유 포지션이 있으면 손절/수익실현 우선 체크
    for (const sym of heldSymbols) {
      const pos        = state.positions.get(sym)!
      const livePrice  = getSimulatedPrice(state, sym)
      const pnlRate    = (livePrice - pos.avgPrice) / pos.avgPrice

      // 손절: -7% 이하
      if (pnlRate <= -0.07) {
        return { symbol: sym, action: 'sell', reason: 'RSI 과매수 구간 도달' }
      }
      // 목표 수익 실현: +12% 이상
      if (pnlRate >= 0.12) {
        return { symbol: sym, action: 'sell', reason: '목표가 도달, 수익 실현 (매수가 대비 +12%)' }
      }
    }

    // 모멘텀 매수: 현재가가 직전 simPrice보다 상승 중
    const notHeld    = universe.filter((s) => !state.positions.has(s))
    const candidates = notHeld.length > 0 ? notHeld : universe

    for (const sym of candidates) {
      const prev  = state.simPrices[sym] ?? BASE_PRICES[sym] ?? 10_000
      const live  = getSimulatedPrice(state, sym)
      if (live > prev) {
        // 모멘텀 확인 → 70% 확률 매수
        if (Math.random() < 0.70) {
          return { symbol: sym, action: 'buy', reason: '52주 신고가 돌파 + 거래량 전일 대비 280% 급증' }
        }
      }
    }

    return null
  }

  // ── 베타 (contrarian_crypto) ───────────────────────────────────────────
  // 변동성(최근 가격 변동 폭)이 크면 역추세 진입
  // 포지션 없을 때 매수 확률 35%, 3% 이상 수익 시 매도
  if (strategy === 'contrarian_crypto') {
    if (rand < 0.30) return null  // 관망 30%

    // 수익 실현: 3% 이상이면 매도
    for (const sym of heldSymbols) {
      const pos       = state.positions.get(sym)!
      const livePrice = getSimulatedPrice(state, sym)
      const pnlRate   = (livePrice - pos.avgPrice) / pos.avgPrice

      if (pnlRate >= 0.03) {
        return { symbol: sym, action: 'sell', reason: '목표가 도달, 수익 실현 (매수가 대비 +28%)' }
      }
      // 손절: -12%
      if (pnlRate <= -0.12) {
        return { symbol: sym, action: 'sell', reason: '리스크 관리: 손절 기준 -12% 도달' }
      }
    }

    // 포지션 없으면 매수 확률 35%
    if (heldSymbols.length === 0) {
      if (rand < 0.65) return null  // 나머지 35%만 매수
      const candidates = universe
      const sym        = candidates[Math.floor(Math.random() * candidates.length)]!

      // 변동성 체크: simPrice vs BASE_PRICES 차이 1% 이상이면 역추세 진입
      const base  = BASE_PRICES[sym] ?? 10_000
      const live  = getSimulatedPrice(state, sym)
      const diff  = Math.abs(live - base) / base
      if (diff >= 0.01) {
        return { symbol: sym, action: 'buy', reason: '공포탐욕지수 18 — 극단적 공포 구간, 역추세 매수' }
      }
      return null
    }

    // 포지션 보유 중 → 추가 진입 또는 홀드 (20% 추가매수)
    if (rand < 0.80) return null
    const sym = universe.filter((s) => !state.positions.has(s))[0]
    if (!sym) return null
    return { symbol: sym, action: 'buy', reason: 'BTC 도미넌스 급락 — 알트코인 시즌 초입 진단' }
  }

  // ── 감마 (quant_us) ────────────────────────────────────────────────────
  // 팩터 기반: 현재가/BASE_PRICES 비율로 밸류 판단
  // 포지션 4개 이상이면 신규 매수 안 함 (분산투자 한도)
  if (strategy === 'quant_us') {
    if (rand < 0.45) return null  // 관망 45%

    // 포지션 4개 이상이면 신규 매수 금지, 리밸런싱 매도만
    if (state.positions.size >= 4) {
      // 가장 팩터 스코어 낮은 포지션 매도 (현재가/기준가 비율이 높을수록 고평가 → 매도)
      let worstSym   = ''
      let worstRatio = -Infinity
      for (const sym of heldSymbols) {
        const live  = getSimulatedPrice(state, sym)
        const base  = BASE_PRICES[sym] ?? live
        const ratio = live / base
        if (ratio > worstRatio) {
          worstRatio = ratio
          worstSym   = sym
        }
      }
      if (worstSym) {
        return { symbol: worstSym, action: 'sell', reason: '목표 비중 초과로 리밸런싱 매도' }
      }
      return null
    }

    // 밸류 매수: 현재가가 기준가보다 낮은(저평가) 종목 우선
    const notHeld    = universe.filter((s) => !state.positions.has(s))
    const candidates = notHeld.length > 0 ? notHeld : universe

    // 기준가 대비 현재가 비율 낮은 순 정렬 → 밸류 종목
    const sorted = candidates.slice().sort((a, b) => {
      const ra = (getSimulatedPrice(state, a)) / (BASE_PRICES[a] ?? 1)
      const rb = (getSimulatedPrice(state, b)) / (BASE_PRICES[b] ?? 1)
      return ra - rb
    })

    const sym = sorted[0]
    if (!sym) return null

    const live  = getSimulatedPrice(state, sym)
    const base  = BASE_PRICES[sym] ?? live
    // 기준가 대비 5% 이상 저평가 시 매수 (60% 확률)
    if (live / base <= 0.95 && Math.random() < 0.60) {
      return { symbol: sym, action: 'buy', reason: 'PEG 비율 0.9 미만, 이익 성장률 22% 이상 — 밸류 매수' }
    }
    // 일반 팩터 매수 (30% 확률)
    if (Math.random() < 0.30) {
      return { symbol: sym, action: 'buy', reason: '팩터 스코어 상위 10% 편입 — 모멘텀+퀄리티+밸류 복합' }
    }
    return null
  }

  // ── 델타 (etf_allocation) ──────────────────────────────────────────────
  // 가장 보수적: 관망 60%, 주 1~2회 리밸런싱 패턴
  // ETF 특성상 큰 변동 없음 → 소량 매매
  if (strategy === 'etf_allocation') {
    if (rand < 0.60) return null  // 관망 60%

    // 보유 ETF 리밸런싱 매도 (초과 비중)
    if (heldSymbols.length > 0 && rand < 0.75) {
      const sym = heldSymbols[Math.floor(Math.random() * heldSymbols.length)]!
      return { symbol: sym, action: 'sell', reason: '목표 비중 초과 — 리밸런싱 매도' }
    }

    // 리밸런싱 매수: 보유하지 않은 ETF 중 하나
    const notHeld    = universe.filter((s) => !state.positions.has(s))
    const candidates = notHeld.length > 0 ? notHeld : universe
    const sym        = candidates[Math.floor(Math.random() * candidates.length)]!
    return { symbol: sym, action: 'buy', reason: '자산배분 비중 이탈 → 리밸런싱 매수 (목표 비중 ±5% 초과)' }
  }

  // ── 엡실론 (crossasset_arb) ────────────────────────────────────────────
  // 한국주식(005930)과 미국주식(NVDA)·코인(KRW-BTC) 방향 비교
  // 방향 불일치(코인 오르는데 주식 하락 등) 시 차익거래 신호
  if (strategy === 'crossasset_arb') {
    if (rand < 0.35) return null  // 관망 35%

    const krPrice   = getSimulatedPrice(state, '005930')
    const krBase    = BASE_PRICES['005930'] ?? krPrice
    const usPrice   = getSimulatedPrice(state, 'NVDA')
    const usBase    = BASE_PRICES['NVDA'] ?? usPrice
    const btcPrice  = getSimulatedPrice(state, 'KRW-BTC')
    const btcBase   = BASE_PRICES['KRW-BTC'] ?? btcPrice

    const krDir  = krPrice  >= krBase  ? 1 : -1
    const usDir  = usPrice  >= usBase  ? 1 : -1
    const btcDir = btcPrice >= btcBase ? 1 : -1

    // 방향 불일치 감지 → 차익거래 기회
    const divergence = (krDir !== usDir) || (btcDir !== usDir)

    if (divergence) {
      // 포지션이 없으면 매수 (70%)
      if (heldSymbols.length === 0 && rand < 0.70) {
        // 상승 자산군 매수
        const sym = btcDir === 1 ? 'KRW-BTC' : (usDir === 1 ? 'NVDA' : '005930')
        return { symbol: sym, action: 'buy', reason: '한미 상관계수 이탈 포착 — 코스피-S&P 스프레드 확대' }
      }
      // 포지션 있으면 청산 (스프레드 수렴)
      if (heldSymbols.length > 0 && rand < 0.80) {
        const sym = heldSymbols[Math.floor(Math.random() * heldSymbols.length)]!
        return { symbol: sym, action: 'sell', reason: '스프레드 수렴 완료 — 차익 실현' }
      }
    }

    // 방향 일치 시에도 낮은 확률로 포지션 진입 (20%)
    if (!divergence && rand < 0.80) return null
    const notHeld    = universe.filter((s) => !state.positions.has(s))
    const candidates = notHeld.length > 0 ? notHeld : universe
    const sym        = candidates[Math.floor(Math.random() * candidates.length)]!
    return { symbol: sym, action: 'buy', reason: 'ADR 괴리율 3% 이상 — 차익거래 진입 조건 충족' }
  }

  // ── 폴백 (정의되지 않은 전략) ─────────────────────────────────────────
  if (rand < 0.40) return null
  if (heldSymbols.length > 0 && rand < 0.70) {
    const symbol = heldSymbols[Math.floor(Math.random() * heldSymbols.length)]!
    return { symbol, action: 'sell' }
  }
  const notHeld  = universe.filter((s) => !state.positions.has(s))
  const fallbackCandidates = notHeld.length > 0 ? notHeld : universe
  const symbol   = fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)]!
  return { symbol, action: 'buy' }
}

// ─── 트레이더 상태 초기화 ─────────────────────────────────────────────────

const traderStates = new Map<string, TraderState>()

function initTraderStates(): void {
  for (const profile of TRADER_PROFILES) {
    const simPrices: Record<string, number> = {}
    for (const sym of profile.universe) {
      simPrices[sym] = BASE_PRICES[sym] ?? 10_000
    }

    const state: TraderState = {
      profile,
      capital:    profile.initialCapital,
      positions:  new Map(),
      trades:     [],
      simPrices,
      peakValue:  profile.initialCapital,
    }

    // 3/1→3/19 백필 시뮬레이션 (서버 시작 시 1회)
    buildBackfill(state)
    traderStates.set(profile.id, state)

    const stats = calcStats(state)
    logger.info(
      {
        traderId:     profile.id,
        backfillTrades: state.trades.length,
        openPositions:  state.positions.size,
        totalReturn:  `${stats.totalReturn}%`,
      },
      `트레이더 ${profile.nameKr} 초기화 완료 (백필 포함)`,
    )
  }
}

// ─── 실시간 매매 사이클 ───────────────────────────────────────────────────

function runTradeCycle(): void {
  for (const [traderId, state] of traderStates) {
    const decision = decideTrade(state)
    if (!decision) continue

    const tradeReason = decision.reason ?? undefined
    const trade =
      decision.action === 'buy'
        ? executeBuy(state, decision.symbol, tradeReason)
        : executeSell(state, decision.symbol, tradeReason)

    if (!trade) continue

    state.trades.push(trade)
    if (state.trades.length > MAX_HISTORY_PER_TRADER) {
      state.trades.splice(0, state.trades.length - MAX_HISTORY_PER_TRADER)
    }

    // 포지션 현재가 갱신
    for (const [sym] of state.positions) {
      const updated = buildPosition(state, sym)
      state.positions.set(sym, updated)
    }

    const stats = calcStats(state)

    const tradeEvent: TradeEvent = {
      type:           'trade',
      traderId,
      action:         trade.action,
      symbol:         trade.symbol,
      symbolName:     trade.symbolName,
      price:          trade.price,
      quantity:       trade.quantity,
      amount:         trade.amount,
      reason:         trade.reason,
      timestamp:      trade.timestamp,
      isSimulated:    true,
      portfolioValue: stats.portfolioValue,
      totalReturn:    stats.totalReturn,
    }
    tradeEventEmitter.emit('trade', tradeEvent)

    const positionEvent: PositionUpdateEvent = {
      type:      'position_update',
      traderId,
      positions: [...state.positions.values()],
      stats,
      timestamp: new Date().toISOString(),
    }
    tradeEventEmitter.emit('position_update', positionEvent)

    logger.info(
      {
        traderId,
        action:   trade.action,
        symbol:   trade.symbol,
        price:    trade.price,
        quantity: trade.quantity,
      },
      `[모의투자] ${state.profile.nameKr} ${trade.action === 'buy' ? '매수' : '매도'}: ${trade.symbolName}`,
    )
  }
}

// ─── 공개 조회 API ────────────────────────────────────────────────────────

export function getAllTraders(): Array<TraderProfile & { stats: TraderStats }> {
  return TRADER_PROFILES.map((profile) => {
    const state = traderStates.get(profile.id)!
    return { ...profile, stats: calcStats(state) }
  })
}

export function getTrader(id: string): (TraderProfile & { stats: TraderStats }) | null {
  const state = traderStates.get(id)
  if (!state) return null
  return { ...state.profile, stats: calcStats(state) }
}

export function getPositions(traderId: string): Position[] {
  const state = traderStates.get(traderId)
  if (!state) return []
  return [...state.positions.values()].map((pos) => buildPosition(state, pos.symbol))
}

export function getTrades(traderId: string, limit = 30): Trade[] {
  const state = traderStates.get(traderId)
  if (!state) return []
  return [...state.trades].reverse().slice(0, limit)
}

export interface MonthlyPnl {
  year: number
  month: number
  realizedPnl: number
  tradeCount: number
  winCount: number
  winRate: number
}

export interface DailyPnl {
  date: string
  realizedPnl: number
  tradeCount: number
}

export function getMonthlyPnl(traderId: string, year: number): MonthlyPnl[] {
  const state = traderStates.get(traderId)
  if (!state) return []

  const sells = state.trades.filter(
    (t) =>
      t.action === 'sell' &&
      t.realizedPnl !== null &&
      new Date(t.timestamp).getFullYear() === year,
  )

  const byMonth = new Map<number, { pnl: number; count: number; wins: number }>()

  for (const trade of sells) {
    const month = new Date(trade.timestamp).getMonth() + 1
    const entry = byMonth.get(month) ?? { pnl: 0, count: 0, wins: 0 }
    entry.pnl   += trade.realizedPnl ?? 0
    entry.count += 1
    if ((trade.realizedPnl ?? 0) > 0) entry.wins += 1
    byMonth.set(month, entry)
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a - b)
    .map(([month, { pnl, count, wins }]) => ({
      year,
      month,
      realizedPnl: Math.round(pnl),
      tradeCount:  count,
      winCount:    wins,
      winRate:     count > 0 ? Math.round((wins / count) * 1000) / 1000 : 0,
    }))
}

export function getDailyPnl(traderId: string, year: number, month: number): DailyPnl[] {
  const state = traderStates.get(traderId)
  if (!state) return []

  const sells = state.trades.filter((t) => {
    if (t.action !== 'sell' || t.realizedPnl === null) return false
    const d = new Date(t.timestamp)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })

  const byDay = new Map<string, { pnl: number; count: number }>()

  for (const trade of sells) {
    const date  = trade.timestamp.slice(0, 10)
    const entry = byDay.get(date) ?? { pnl: 0, count: 0 }
    entry.pnl   += trade.realizedPnl ?? 0
    entry.count += 1
    byDay.set(date, entry)
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { pnl, count }]) => ({
      date,
      realizedPnl: Math.round(pnl),
      tradeCount:  count,
    }))
}

// ─── 엔진 시작/종료 ───────────────────────────────────────────────────────

let engineTimer: ReturnType<typeof setInterval> | null = null

export function startTraderEngine(): void {
  if (engineTimer) return  // 중복 시작 방지

  initTraderStates()

  engineTimer = setInterval(() => {
    try {
      runTradeCycle()
    } catch (err) {
      logger.error({ err }, '트레이더 엔진 사이클 오류')
    }
  }, TRADE_INTERVAL_MS)

  logger.info({ intervalMs: TRADE_INTERVAL_MS }, 'AI 트레이더 엔진 시작 (모의투자 모드, 백필 완료)')
}

export function stopTraderEngine(): void {
  if (engineTimer) {
    clearInterval(engineTimer)
    engineTimer = null
    logger.info('AI 트레이더 엔진 종료')
  }
}
