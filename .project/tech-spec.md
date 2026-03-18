# CoStock 기술 스펙

**작성자**: 최재원 (BE) / 김민준 (FE)
**최종 수정**: 2026-03-18

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────┐
│                   클라이언트                      │
│           Next.js 14 (App Router)                │
│        WebSocket Client + REST Client            │
└────────────┬───────────────────┬─────────────────┘
             │ HTTPS             │ WSS
             ▼                   ▼
┌─────────────────┐   ┌─────────────────────────────┐
│   REST API      │   │   WebSocket 서버             │
│   (Fastify)     │   │   (실시간 가격 브로드캐스트)  │
└────────┬────────┘   └──────────┬──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────────────┐
│                  Apache Kafka                    │
│            (실시간 가격 이벤트 스트림)             │
└────────────────┬────────────────────────────────┘
                 │
         ┌───────┴───────┐
         ▼               ▼
┌─────────────┐   ┌──────────────────┐
│ 데이터 수집  │   │  TimescaleDB     │
│ 서비스      │   │  (시계열 주가)   │
│ (Python)   │   └──────────────────┘
└──────┬──────┘
       │
┌──────┴────────────────────────────────┐
│           외부 API                     │
│  KRX | 업비트 | 빗썸 | 한국투자증권   │
└───────────────────────────────────────┘
```

---

## 2. 기술 스택

### Frontend
| 항목 | 기술 | 버전 | 이유 |
|------|------|------|------|
| 프레임워크 | Next.js | 14 | App Router, SSR, 성능 |
| UI 라이브러리 | React | 18 | Concurrent Features |
| 언어 | TypeScript | 5.x | 금융 도메인 타입 안전성 |
| 상태 관리 | Zustand | 4.x | 경량, 심플 |
| 서버 상태 | React Query | 5.x | 캐싱, 실시간 동기화 |
| 스타일 | Tailwind CSS | 3.x | 빠른 개발 |
| 차트 | TradingView Lightweight Charts | 4.x | 금융 차트 특화 |
| 테스트 | Vitest + Playwright | - | 빠른 단위 + E2E |

### Backend
| 항목 | 기술 | 버전 | 이유 |
|------|------|------|------|
| API 서버 | Node.js + Fastify | 20 LTS | 고성능, TypeScript |
| 데이터 수집 | Python + FastAPI | 3.11 | 금융 라이브러리 풍부 |
| 메시지 큐 | Apache Kafka | 3.x | 실시간 스트리밍 |
| 주 DB | PostgreSQL | 15 | ACID, JSON 지원 |
| 시계열 DB | TimescaleDB | - | 주가 이력 최적화 |
| 캐시 | Redis Cluster | 7.x | 현재가 캐시, 세션 |
| 인프라 | AWS ECS Fargate | - | 서버리스 컨테이너 |

---

## 3. 실시간 데이터 처리

### WebSocket 아키텍처
```
클라이언트 → WS 서버 (구독 요청: 종목 리스트)
                ↓
           Redis Pub/Sub (종목별 채널)
                ↓
           Kafka Consumer (가격 업데이트 수신)
                ↓
           클라이언트에 브로드캐스트
```

### 메시지 포맷
```typescript
interface PriceUpdate {
  symbol: string;        // "005930" (주식) | "BTC-KRW" (코인)
  type: 'stock' | 'coin';
  price: number;
  change: number;        // 전일 대비 변동액
  changeRate: number;    // 전일 대비 변동률 (%)
  volume: number;
  timestamp: number;     // Unix timestamp (ms)
}
```

### 장애 처리
- WebSocket 끊김: 지수 백오프 재연결 (1s → 2s → 4s → max 30s)
- API 장애: Circuit Breaker (5분 내 5회 실패 → open)
- Stale 데이터: 5초 이상 업데이트 없으면 UI에 "지연" 표시

---

## 4. 데이터베이스 스키마 (핵심)

### 종목 테이블
```sql
CREATE TABLE instruments (
  symbol      VARCHAR(20) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(10) NOT NULL,  -- 'stock' | 'coin'
  exchange    VARCHAR(20) NOT NULL,  -- 'KOSPI' | 'KOSDAQ' | 'UPBIT'
  currency    VARCHAR(5) DEFAULT 'KRW',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
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
```

---

## 5. API 설계 원칙
- RESTful + JSON:API 스펙 준수
- 페이지네이션: cursor 기반 (offset 금지)
- Rate Limiting: IP 기준 100 req/min
- 캐시: GET 요청에 Cache-Control 헤더 (현재가: 3초, 이력: 5분)
- 에러: RFC 7807 Problem Details 형식

---

## 6. 보안
- API 키: 환경변수 관리, 절대 코드 하드코딩 금지
- 인증: JWT (HS256, 24시간 만료, refresh token 7일)
- HTTPS 강제 (HTTP → HTTPS 리다이렉트)
- SQL: 파라미터 바인딩 필수 (ORM/쿼리빌더 사용)
- Rate Limiting + DDoS 방어 (AWS WAF)

---

## 7. 성능 목표
| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 가격 업데이트 지연 | < 3초 | WebSocket 수신 → UI 반영 |
| REST API p99 | < 500ms | Datadog APM |
| LCP | < 2.5초 | Lighthouse |
| WebSocket 동시 연결 | 10만 | k6 부하 테스트 |
| 가용성 | 99.9% | Uptime Robot |
