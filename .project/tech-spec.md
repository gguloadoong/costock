# CoStock 기술 스펙

**작성자**: 최재원 (BE) / 김민준 (FE)
**최종 수정**: 2026-03-19
**버전**: 2.1 — Next.js PWA 확정, 카피트레이딩 자동 실행 제거

---

## 변경 이력

| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| 2.0 | 2026-03-18 | 초기 기술 스펙 작성 (React Native 기반) |
| 2.1 | 2026-03-19 | 플랫폼 Next.js 14 PWA로 확정. React Native 제거. Web Push 추가. 증권사 자동 주문 API 항목 제거. |

---

## 1. 아키텍처 개요

```
┌──────────────────────────────────────────────────┐
│                   클라이언트                       │
│         Next.js 14 PWA (App Router)               │
│   WebSocket Client + REST Client + Service Worker │
└────────────┬────────────────────┬─────────────────┘
             │ HTTPS              │ WSS
             ▼                    ▼
┌─────────────────┐   ┌──────────────────────────────┐
│   REST API      │   │   WebSocket 서버              │
│   (Fastify)     │   │   (트레이딩 이벤트 브로드캐스트)│
└────────┬────────┘   └──────────┬───────────────────┘
         │                       │
         ▼                       ▼
┌──────────────────────────────────────────────────┐
│                  Apache Kafka                     │
│           (트레이딩 이벤트 스트림)                 │
└───────────────────┬──────────────────────────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
┌─────────────────┐   ┌──────────────────┐
│ AI 트레이더 엔진 │   │  TimescaleDB     │
│ (Python FastAPI)│   │  (가격/매매 이력) │
└──────┬──────────┘   └──────────────────┘
       │
┌──────┴────────────────────────────┐
│           외부 가격 API            │
│  업비트 | 바이낸스 | 한국투자증권  │
└───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Firebase FCM (Web Push 알림)    │
│  구독자 브라우저 → Service Worker │
└──────────────────────────────────┘
```

---

## 2. 기술 스택

### Frontend

| 항목 | 기술 | 버전 | 이유 |
|------|------|------|------|
| 프레임워크 | Next.js | 14 | App Router, SSR, Vercel 즉시 배포 |
| UI 라이브러리 | React | 18 | Concurrent Features |
| 언어 | TypeScript | 5.x | 금융 도메인 타입 안전성 |
| 상태 관리 | Zustand | 4.x | 경량, 심플 |
| 서버 상태 | React Query (TanStack Query) | 5.x | 캐싱, 실시간 동기화 |
| 스타일 | Tailwind CSS | 3.x | 빠른 개발 |
| 차트 | TradingView Lightweight Charts | 4.x | 금융 차트 특화 |
| 테스트 | Vitest + Playwright | - | 빠른 단위 + E2E |
| PWA | next-pwa (Workbox) | - | Service Worker, 오프라인, 홈 화면 추가 |
| 푸시 알림 | Firebase FCM Web Push API | - | Web Push Protocol, Service Worker 수신 |
| 배포 | Vercel | - | Next.js 최적화, 즉시 배포, Preview URL |

**플랫폼 결정**: React Native 없음. Next.js PWA 단일 코드베이스. 앱스토어 배포 없음.

### Backend

| 항목 | 기술 | 버전 | 이유 |
|------|------|------|------|
| API 서버 | Node.js + Fastify | 20 LTS | 고성능, TypeScript |
| AI 트레이더 엔진 | Python + FastAPI | 3.11 | 금융/퀀트 라이브러리 풍부 (pandas, numpy, ta-lib) |
| 메시지 큐 | Apache Kafka | 3.x | 트레이딩 이벤트 스트리밍 |
| 주 DB | PostgreSQL | 15 | ACID, JSON 지원 |
| 시계열 DB | TimescaleDB | - | 가격 이력 최적화 |
| 캐시 | Redis | 7.x | 현재가 캐시, 세션, 구독자 목록 |
| 인프라 | AWS ECS Fargate | - | 서버리스 컨테이너 |
| 알림 | Firebase Admin SDK | - | FCM Web Push 발송 |

---

## 3. PWA 구성

### manifest.json 핵심 설정

```json
{
  "name": "CoStock — AI 트레이더 알림",
  "short_name": "CoStock",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#0F172A",
  "background_color": "#0F172A",
  "start_url": "/",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker 역할

- Web Push 알림 수신 및 표시 (`push` 이벤트 핸들러)
- 알림 탭 시 딥링크 처리 (`notificationclick` 이벤트)
- 정적 에셋 캐싱 (Workbox `CacheFirst`)
- API 응답 캐싱 (Workbox `NetworkFirst`, TTL 60초)

### iOS 홈 화면 추가 안내

iOS Safari는 Web Push를 iOS 16.4 이상에서만 지원. 온보딩 시 홈 화면 추가(A2HS) 명시적 유도.

```
iOS: Safari → 공유 버튼 → 홈 화면에 추가
Android: Chrome → 메뉴 → 앱 설치 / 홈 화면에 추가
```

---

## 4. Web Push 알림 아키텍처

### 알림 발송 흐름

```
AI 트레이더 엔진
  → 매매 신호 발생
  → Kafka 이벤트 발행 (topic: trading-events)
  → Fastify API 서버 (Kafka Consumer)
  → 구독자 목록 조회 (Redis + PostgreSQL)
  → 알림 설정 필터링 (매수/매도 ON/OFF, 방해 금지 시간대)
  → Firebase Admin SDK → FCM
  → 브라우저 Service Worker → Web Push 알림 표시
  → 사용자 탭 → 딥링크 이동
```

### 알림 페이로드 포맷

```typescript
interface PushPayload {
  traderId: string;         // "alpha" | "beta" | "gamma"
  traderName: string;       // "AI-알파"
  action: 'buy' | 'sell';
  symbol: string;           // "005930"
  symbolName: string;       // "삼성전자"
  assetType: 'stock_kr' | 'stock_us' | 'coin';
  price: number;            // 매매 체결가
  rationale: string;        // "RSI 28, 기관 순매수 포착" (1줄)
  deeplink: string;         // "/traders/alpha/feed"
  timestamp: number;        // Unix ms
}
```

### 알림 발송 SLA

- AI 매매 신호 발생 → Web Push 발송: **5초 이내**
- 발송 실패 시 재시도: 지수 백오프 (1s → 2s → 4s), 최대 3회

---

## 5. 실시간 데이터 처리

### WebSocket 아키텍처

```
클라이언트 → WS 서버 (트레이더 피드 구독)
                ↓
           Redis Pub/Sub (트레이더별 채널)
                ↓
           Kafka Consumer (트레이딩 이벤트 수신)
                ↓
           클라이언트에 브로드캐스트 (피드 카드 갱신)
```

### 트레이딩 이벤트 메시지 포맷

```typescript
interface TradingEvent {
  eventId: string;
  traderId: string;
  action: 'buy' | 'sell';
  symbol: string;
  symbolName: string;
  assetType: 'stock_kr' | 'stock_us' | 'coin';
  price: number;
  quantity: number;
  rationale: string;          // LLM 생성 텍스트
  portfolioReturn: number;    // 해당 트레이더의 현재 누적 수익률 (%)
  positionReturn?: number;    // 매도 시: 해당 포지션 실현 수익률
  timestamp: number;
}
```

### 가격 메시지 포맷

```typescript
interface PriceUpdate {
  symbol: string;        // "005930" (주식) | "BTC-KRW" (코인)
  assetType: 'stock_kr' | 'stock_us' | 'coin';
  price: number;
  change: number;        // 전일 대비 변동액
  changeRate: number;    // 전일 대비 변동률 (%)
  volume: number;
  timestamp: number;     // Unix ms
}
```

### 장애 처리

- WebSocket 끊김: 지수 백오프 재연결 (1s → 2s → 4s → max 30s)
- API 장애: Circuit Breaker (5분 내 5회 실패 → open)
- Stale 데이터: 30초 이상 업데이트 없으면 UI에 "연결 끊김" 배지 표시

---

## 6. 데이터베이스 스키마 (핵심)

### traders 테이블

```sql
CREATE TABLE traders (
  id            VARCHAR(20) PRIMARY KEY,   -- 'alpha' | 'beta' | 'gamma'
  name          VARCHAR(50) NOT NULL,      -- 'AI-알파'
  strategy      VARCHAR(50) NOT NULL,      -- '모멘텀' | '역추세' | '퀀트'
  asset_type    VARCHAR(20) NOT NULL,      -- 'stock_kr' | 'coin' | 'stock_us'
  description   TEXT,
  initial_capital DECIMAL(20, 2) DEFAULT 100000000,  -- 1억 원
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT true
);
```

### positions 테이블

```sql
CREATE TABLE positions (
  id            BIGSERIAL PRIMARY KEY,
  trader_id     VARCHAR(20) REFERENCES traders(id),
  symbol        VARCHAR(20) NOT NULL,
  symbol_name   VARCHAR(100),
  asset_type    VARCHAR(20) NOT NULL,
  entry_price   DECIMAL(20, 8) NOT NULL,
  quantity      DECIMAL(20, 8) NOT NULL,
  opened_at     TIMESTAMPTZ NOT NULL,
  closed_at     TIMESTAMPTZ,              -- NULL이면 보유 중
  exit_price    DECIMAL(20, 8),
  realized_pnl  DECIMAL(20, 8),
  status        VARCHAR(10) DEFAULT 'open'  -- 'open' | 'closed'
);
```

### trades 테이블 (매매 이벤트 이력)

```sql
CREATE TABLE trades (
  id            BIGSERIAL PRIMARY KEY,
  trader_id     VARCHAR(20) REFERENCES traders(id),
  position_id   BIGINT REFERENCES positions(id),
  action        VARCHAR(10) NOT NULL,     -- 'buy' | 'sell'
  symbol        VARCHAR(20) NOT NULL,
  symbol_name   VARCHAR(100),
  asset_type    VARCHAR(20) NOT NULL,
  price         DECIMAL(20, 8) NOT NULL,
  quantity      DECIMAL(20, 8) NOT NULL,
  slippage_rate DECIMAL(5, 4),            -- 0.001 (0.1%)
  rationale     TEXT,                    -- LLM 생성 매매 근거
  executed_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### subscriptions 테이블

```sql
CREATE TABLE subscriptions (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL,
  trader_id       VARCHAR(20) REFERENCES traders(id),
  notify_buy      BOOLEAN DEFAULT true,
  notify_sell     BOOLEAN DEFAULT true,
  quiet_start     TIME,                  -- 방해 금지 시작 시간 (예: 23:00)
  quiet_end       TIME,                  -- 방해 금지 종료 시간 (예: 07:00)
  fcm_token       TEXT,                  -- Web Push 토큰
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, trader_id)
);
```

### 가격 이력 (TimescaleDB)

```sql
CREATE TABLE price_history (
  symbol      VARCHAR(20) NOT NULL,
  time        TIMESTAMPTZ NOT NULL,
  open        DECIMAL(20, 8) NOT NULL,
  high        DECIMAL(20, 8) NOT NULL,
  low         DECIMAL(20, 8) NOT NULL,
  close       DECIMAL(20, 8) NOT NULL,
  volume      DECIMAL(30, 8) NOT NULL
);

SELECT create_hypertable('price_history', 'time');
CREATE INDEX ON price_history (symbol, time DESC);
```

---

## 7. API 설계 원칙

- RESTful + JSON:API 스펙 준수
- 페이지네이션: cursor 기반 (offset 금지)
- Rate Limiting: IP 기준 100 req/min
- 캐시: GET 요청에 Cache-Control 헤더 (현재 트레이더 성과: 30초, 가격 이력: 5분)
- 에러: RFC 7807 Problem Details 형식

### 핵심 엔드포인트 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/traders` | AI 트레이더 목록 (수익률/승률/포지션 수) |
| GET | `/traders/:id` | 트레이더 상세 (전략/성과 지표) |
| GET | `/traders/:id/feed` | 활동 피드 (매매 이벤트 목록, cursor 페이지네이션) |
| GET | `/traders/:id/positions` | 현재 보유 포지션 목록 |
| GET | `/traders/:id/pnl` | 실현손익 (월별 요약, `?year=&month=` 드릴다운) |
| GET | `/market/indices` | 주요 지수 (코스피/코스닥/S&P500/나스닥/BTC 도미넌스) |
| GET | `/news` | 최신 뉴스 목록 |
| POST | `/auth/kakao` | 카카오 소셜 로그인 |
| POST | `/subscriptions` | AI 트레이더 구독 (FCM 토큰 등록 포함) |
| DELETE | `/subscriptions/:traderId` | 구독 해제 |
| PATCH | `/subscriptions/:traderId` | 알림 설정 변경 (매수/매도 ON/OFF, 방해 금지) |
| GET | `/notifications` | 알림 이력 목록 |

---

## 8. 보안

- API 키: 환경변수 관리, 절대 코드 하드코딩 금지
- 인증: JWT (HS256, 24시간 만료, refresh token 7일)
- HTTPS 강제 (Vercel 기본 제공)
- SQL: 파라미터 바인딩 필수 (ORM/쿼리빌더 사용)
- Rate Limiting + DDoS 방어 (AWS WAF)
- FCM 토큰: DB 저장 시 사용자별 암호화 권장

---

## 9. 성능 목표

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 알림 발송 지연 | < 5초 | 매매 신호 발생 → FCM 발송 완료 |
| WebSocket 피드 지연 | < 3초 | 이벤트 발생 → 클라이언트 수신 |
| REST API p99 | < 500ms | Datadog APM |
| FCP (First Contentful Paint) | < 2초 | Lighthouse (모바일 4G 기준) |
| LCP (Largest Contentful Paint) | < 2.5초 | Lighthouse |
| WebSocket 동시 연결 | 1만 (Phase 0) → 10만 (Phase 1) | k6 부하 테스트 |
| 가용성 | 99.9% | Uptime Robot |

---

## 10. 개발 환경 및 배포

### 환경 구성

| 환경 | 용도 | 배포 방식 |
|------|------|----------|
| local | 개발, mock API 사용 | `npm run dev` |
| staging | PR Preview, 통합 테스트 | Vercel Preview URL (PR 자동 배포) |
| production | 베타 사용자 서비스 | Vercel Production (`main` 브랜치 머지 시) |

### 환경 변수 (.env.example)

```bash
# API
NEXT_PUBLIC_API_URL=https://api.costock.io
NEXT_PUBLIC_WS_URL=wss://ws.costock.io

# Firebase (Web Push)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=

# 서버 사이드 (노출 금지)
DATABASE_URL=
REDIS_URL=
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
JWT_SECRET=
OPENAI_API_KEY=
FIREBASE_ADMIN_SERVICE_ACCOUNT=
```
