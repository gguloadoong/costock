#!/usr/bin/env bash
# CoStock 로컬 개발 서버 빠른 시작
# 실행: bash scripts/start-dev.sh
set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 색상 출력
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }

info "🚀 CoStock 로컬 개발 서버 시작..."
echo ""

# Docker 인프라 상태 확인
if ! docker compose -f "$ROOT_DIR/docker-compose.yml" ps | grep -q "postgres.*running"; then
  info "⏳ Docker 인프라 시작 중 (PostgreSQL, Redis)..."
  docker compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres redis
  sleep 2
  info "✅ 인프라 준비 완료"
else
  info "✅ Docker 인프라 이미 실행 중"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  CoStock 개발 서버 준비 완료${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "  📍 API: http://localhost:3101"
echo "  📍 Web: http://localhost:3100"
echo ""
echo -e "${YELLOW}다음 명령어로 서버를 실행하세요:${NC}"
echo ""
echo "  📌 터미널 1 (API 서버):"
echo "     cd apps/api && npm run dev"
echo ""
echo "  📌 터미널 2 (Web 클라이언트):"
echo "     cd apps/web && npm run dev"
echo ""
echo -e "${YELLOW}선택사항:${NC}"
echo "  🔧 Kafka UI:        http://localhost:8080"
echo "  🔧 pgAdmin:         docker compose --profile tools up -d"
echo "                      http://localhost:5050"
echo ""
