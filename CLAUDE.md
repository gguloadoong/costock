# CoStock — 주식+코인 통합 투자정보 플랫폼

## 프로젝트 개요
**CoStock**은 주식과 코인을 하나의 앱에서 확인할 수 있는 국내 최초 통합 투자정보 플랫폼입니다.

- **타겟**: 20대 코인 투자자 ↔ 4050 주식 투자자 (크로스에셋 정보 니즈)
- **포지셔닝**: 토스증권(주식 특화) + 업비트(코인 특화)의 공백 공략
- **핵심 가치**: 실시간 정확한 가격 + 통합된 포트폴리오 뷰

## 팀 구성

| 이름 | 역할 | 배경 | 에이전트 |
|------|------|------|---------|
| 이준혁 | PM | 토스증권 PM → 뱅크샐러드 CPO | `pm` |
| 박소연 | Designer | 업비트 UX → 카카오페이증권 디자인시스템 | `designer` |
| 김민준 | Frontend | 네이버파이낸셜 FE → 크래프톤 리드 | `fe` |
| 최재원 | Backend | 빗썸 서버팀 → 두나무(업비트) 인프라 | `be` |
| 정예린 | QA | 삼성증권 QA → 토스 QA Lead | `qa` |
| 한서준 | Strategist | 블룸버그 전략 → 뱅크샐러드 VP | `strategist` |

## 주요 문서
- [PRD](.project/PRD.md) — 제품 요구사항 및 경쟁사 분석
- [디자인 스펙](.project/design-spec.md) — UI/UX 가이드라인
- [기술 스펙](.project/tech-spec.md) — 아키텍처 및 기술 결정
- [API 스펙](.project/api-spec.md) — REST/WebSocket API 정의
- [데이터 소스](.project/data-sources.md) — 외부 금융 API 목록
- [결정 기록](.project/decisions.md) — ADR (Architecture Decision Records)
- [로드맵](.project/roadmap.md) — Phase 0~3 마일스톤
- [백로그](.project/backlog.md) — 기능 백로그
- [테스트 계획](.project/test-plan.md) — QA 전략 및 리스크

## 커맨드
- `/kickoff` — 프로젝트 킥오프 미팅
- `/team-meeting` — 팀 전체 주간 회의
- `/sprint` — 스프린트 계획 및 실행
- `/standup` — 일일 스탠드업
- `/design-review` — 디자인 리뷰 세션
- `/retro` — 스프린트 회고
- `/loop` — 반복 작업 실행
- `/create-agent` — 새 에이전트 추가

## 도메인 규칙 (필독)

### 가격 표시 관행 (한국 금융)
- 상승: **빨강** (`#E84040`)
- 하락: **파랑** (`#2563EB`)
- 보합: 회색 (`#6B7280`)
- 숫자: 천 단위 콤마, 소수점 2자리
- 변동률: `+2.34%` / `-1.56%` (부호 필수)

### 데이터 정확성 (최우선)
- 가격 데이터 오류는 사용자 신뢰 손상 → 즉시 수정 필수
- 실시간 연결 끊김 시 stale 데이터 명시 표시
- 이상값(0원, 음수, ±30% 급변) 필터링 후 알림

### 보안
- API 키는 환경변수로만 관리 (절대 코드에 하드코딩 금지)
- 사용자 투자 데이터 로그 출력 금지
- 외부 API 호출 타임아웃 5초 설정 필수

## 기술 스택 요약
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js (Fastify), Python (데이터 수집)
- **Database**: PostgreSQL, Redis, TimescaleDB
- **Realtime**: WebSocket (Kafka 기반 브로드캐스트)
- **Infra**: AWS ECS Fargate, RDS, ElastiCache
