# CoStock — 주식·코인 통합 투자정보 플랫폼

주식과 코인을 하나의 앱에서 확인하는 국내 최초 통합 투자정보 플랫폼.

## 기능
- 실시간 주식·코인 가격 (WebSocket)
- 관심 종목 관리 (IndexedDB)
- 상세 차트 (TradingView Lightweight Charts v5)
- 탐색 화면: 급등/급락/거래량 랭킹
- 시장 지수: KOSPI/KOSDAQ/BTC 도미넌스/환율

## 기술 스택
| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Fastify (Node.js), Python (데이터 수집) |
| DB | PostgreSQL + TimescaleDB, Redis |
| Realtime | WebSocket |
| Infra | AWS ECS Fargate, RDS, ElastiCache |

## 로컬 실행

### 사전 요구사항
- Node.js 20+
- pnpm 9+
- PostgreSQL 15+ (TimescaleDB 확장)
- Redis 7+

### 설치 및 실행

```bash
# 의존성 설치
pnpm install

# 환경변수 설정
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# 각 .env 파일을 편집하여 실제 값 입력

# 개발 서버 실행 (전체)
pnpm dev

# 개별 실행
pnpm --filter web dev   # http://localhost:3100
pnpm --filter api dev   # http://localhost:3101
```

## 환경변수

### apps/api/.env
| 변수 | 설명 | 기본값 |
|------|------|--------|
| PORT | API 포트 | 3101 |
| DATABASE_URL | PostgreSQL 연결 문자열 | — |
| REDIS_URL | Redis 연결 URL | redis://localhost:6379 |
| JWT_SECRET | JWT 서명 키 (32자+) | — |
| ALLOWED_ORIGINS | CORS 허용 오리진 | http://localhost:3100 |

### apps/web/.env.local
| 변수 | 설명 | 기본값 |
|------|------|--------|
| NEXT_PUBLIC_API_URL | API 서버 URL | http://localhost:3101 |
| NEXT_PUBLIC_WS_URL | WebSocket URL | ws://localhost:3101/ws/prices |

## 프로젝트 구조

```
CoStock/
├── apps/
│   ├── web/          # Next.js 14 프론트엔드
│   └── api/          # Fastify 백엔드
├── packages/
│   └── shared/       # 공유 타입·유틸리티
└── .project/         # 프로젝트 문서 (PRD, 스펙, 백로그)
```

## 팀

| 이름 | 역할 |
|------|------|
| 이준혁 | PM |
| 박소연 | Designer |
| 김민준 | Frontend |
| 최재원 | Backend |
| 정예린 | QA |
| 한서준 | Strategist |

## 도메인 규칙

- **상승**: 빨강 `#E84040` / **하락**: 파랑 `#2563EB` (한국 금융 관행)
- 실시간 연결 끊김 시 stale 데이터 명시
- 가격 이상값(0원, 음수, ±30%) 필터링 후 알림
