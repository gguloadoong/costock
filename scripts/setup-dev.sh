#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# CoStock Phase 0 — 로컬 개발 환경 초기화 스크립트
# 실행: bash scripts/setup-dev.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 색상 출력
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ─── 사전 조건 확인 ─────────────────────────────────────────────
info "사전 조건 확인 중..."

command -v docker  >/dev/null 2>&1 || error "Docker가 설치되어 있지 않습니다."
command -v node    >/dev/null 2>&1 || error "Node.js가 설치되어 있지 않습니다."
command -v python3 >/dev/null 2>&1 || error "Python 3이 설치되어 있지 않습니다."

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  error "Node.js 20 이상이 필요합니다. 현재: $(node -v)"
fi

PYTHON_VERSION=$(python3 -c "import sys; print(sys.version_info.minor)")
if [ "$PYTHON_VERSION" -lt 11 ]; then
  warn "Python 3.11 이상 권장. 현재: $(python3 --version)"
fi

info "사전 조건 확인 완료"

# ─── .env 파일 생성 ─────────────────────────────────────────────
if [ ! -f ".env" ]; then
  info ".env 파일 생성 중..."
  cp .env.example .env

  # JWT_SECRET 자동 생성
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^JWT_SECRET=$/JWT_SECRET=${JWT_SECRET}/" .env
  else
    sed -i "s/^JWT_SECRET=$/JWT_SECRET=${JWT_SECRET}/" .env
  fi

  info ".env 파일 생성 완료 (JWT_SECRET 자동 생성됨)"
  warn ".env 파일을 검토하고 필요한 API 키를 입력하세요."
else
  info ".env 파일이 이미 존재합니다. 건너뜀."
fi

# ─── Docker 인프라 기동 ─────────────────────────────────────────
info "Docker 인프라 기동 중... (PostgreSQL, Redis, Kafka)"
docker compose up -d postgres redis zookeeper kafka

info "서비스 헬스체크 대기 중..."
WAIT=0
MAX_WAIT=60

until docker compose exec -T postgres pg_isready -U costock -q 2>/dev/null; do
  WAIT=$((WAIT + 2))
  if [ $WAIT -ge $MAX_WAIT ]; then
    error "PostgreSQL 헬스체크 타임아웃 (${MAX_WAIT}초)"
  fi
  sleep 2
done
info "PostgreSQL 준비 완료"

until docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; do
  WAIT=$((WAIT + 2))
  if [ $WAIT -ge $MAX_WAIT ]; then
    error "Redis 헬스체크 타임아웃 (${MAX_WAIT}초)"
  fi
  sleep 2
done
info "Redis 준비 완료"

# Kafka 토픽 초기화
info "Kafka 토픽 초기화 중..."
docker compose run --rm kafka-init
info "Kafka 토픽 생성 완료"

# ─── Node.js 패키지 설치 ────────────────────────────────────────
info "API 서버 패키지 설치 중..."
cd apps/api && npm install --silent
cd "$ROOT_DIR"

# ─── Python 가상환경 ────────────────────────────────────────────
info "Python 수집 서비스 가상환경 설정 중..."
cd apps/collector
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet websockets aiokafka fastapi uvicorn pydantic python-dotenv
deactivate
cd "$ROOT_DIR"

# ─── 완료 ───────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}  CoStock Phase 0 개발 환경 셋업 완료!${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo ""
echo "  API 서버 실행:      cd apps/api && npm run dev"
echo "  수집 서비스 실행:   cd apps/collector && source .venv/bin/activate"
echo "                      && python src/upbit_collector.py"
echo "  Kafka UI:           http://localhost:8080"
echo "  pgAdmin (선택):     docker compose --profile tools up -d"
echo "                      http://localhost:5050"
echo ""
echo -e "${YELLOW}주의: .env 파일의 외부 API 키를 확인하세요.${NC}"
