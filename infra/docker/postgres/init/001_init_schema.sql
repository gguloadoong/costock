-- CoStock PostgreSQL 초기화 스크립트
-- TimescaleDB 확장 활성화 후 기본 스키마 생성

-- ─────────────────────────────────────────────
-- 확장
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- 종목명 검색 (LIKE 최적화)

-- ─────────────────────────────────────────────
-- ENUM 타입
-- ─────────────────────────────────────────────
CREATE TYPE asset_type AS ENUM ('stock', 'crypto');
CREATE TYPE price_source AS ENUM ('krx', 'upbit', 'bithumb', 'kis');  -- 한국투자증권

-- ─────────────────────────────────────────────
-- 종목 마스터 테이블
-- ─────────────────────────────────────────────
CREATE TABLE assets (
    id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol      VARCHAR(20)   NOT NULL,   -- 내부 정규화 심볼 (KR_005930, UPBIT_BTC)
    raw_symbol  VARCHAR(20)   NOT NULL,   -- 원본 코드 (005930, KRW-BTC)
    name        VARCHAR(100)  NOT NULL,
    asset_type  asset_type    NOT NULL,
    source      price_source  NOT NULL,
    is_active   BOOLEAN       NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (symbol)
);

CREATE INDEX idx_assets_symbol     ON assets (symbol);
CREATE INDEX idx_assets_name_trgm  ON assets USING GIN (name gin_trgm_ops);
CREATE INDEX idx_assets_type       ON assets (asset_type) WHERE is_active = true;

-- ─────────────────────────────────────────────
-- 가격 틱 데이터 하이퍼테이블 (TimescaleDB 핵심)
-- ─────────────────────────────────────────────
CREATE TABLE price_ticks (
    ts          TIMESTAMPTZ   NOT NULL,
    symbol      VARCHAR(20)   NOT NULL,
    asset_type  asset_type    NOT NULL,
    price       NUMERIC(18,4) NOT NULL,
    volume      NUMERIC(24,4),
    source      price_source  NOT NULL,
    -- 이상값 필터 통과 여부 (±30% 초과 시 false)
    is_valid    BOOLEAN       NOT NULL DEFAULT true
);

-- TimescaleDB 하이퍼테이블 변환
-- chunk_time_interval: 1시간 (틱 데이터 특성상 단위 작게)
SELECT create_hypertable(
    'price_ticks', 'ts',
    partitioning_column => 'symbol',
    number_partitions => 8,
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- 압축 정책: 1시간 지난 청크 압축 (저장 공간 70-90% 절약)
ALTER TABLE price_ticks SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol, asset_type',
    timescaledb.compress_orderby = 'ts DESC'
);
SELECT add_compression_policy('price_ticks', INTERVAL '1 hour');

-- 보존 정책: 7일 이상 틱 데이터 삭제
SELECT add_retention_policy('price_ticks', INTERVAL '7 days');

CREATE INDEX idx_price_ticks_symbol_ts
    ON price_ticks (symbol, ts DESC);

-- ─────────────────────────────────────────────
-- 연속 집계 (Continuous Aggregates) — OHLCV 캔들
-- ─────────────────────────────────────────────

-- 1분봉
CREATE MATERIALIZED VIEW candles_1m
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
    time_bucket('1 minute', ts) AS bucket,
    symbol,
    asset_type,
    first(price, ts)  AS open,
    max(price)        AS high,
    min(price)        AS low,
    last(price, ts)   AS close,
    sum(volume)       AS volume,
    count(*)          AS tick_count
FROM price_ticks
WHERE is_valid = true
GROUP BY bucket, symbol, asset_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_1m',
    start_offset => INTERVAL '10 minutes',
    end_offset   => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);

-- 1시간봉 (1분봉에서 롤업)
CREATE MATERIALIZED VIEW candles_1h
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
    time_bucket('1 hour', bucket) AS bucket,
    symbol,
    asset_type,
    first(open, bucket)  AS open,
    max(high)            AS high,
    min(low)             AS low,
    last(close, bucket)  AS close,
    sum(volume)          AS volume
FROM candles_1m
GROUP BY time_bucket('1 hour', bucket), symbol, asset_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_1h',
    start_offset => INTERVAL '2 hours',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

-- 1일봉
CREATE MATERIALIZED VIEW candles_1d
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
    time_bucket('1 day', bucket) AS bucket,
    symbol,
    asset_type,
    first(open, bucket)  AS open,
    max(high)            AS high,
    min(low)             AS low,
    last(close, bucket)  AS close,
    sum(volume)          AS volume
FROM candles_1h
GROUP BY time_bucket('1 day', bucket), symbol, asset_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_1d',
    start_offset => INTERVAL '2 days',
    end_offset   => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day'
);

-- 1분봉: 90일 보존
SELECT add_retention_policy('candles_1m', INTERVAL '90 days');
-- 1시간봉: 2년 보존
SELECT add_retention_policy('candles_1h', INTERVAL '730 days');
-- 1일봉: 영구 보존 (정책 미설정)

-- ─────────────────────────────────────────────
-- 사용자 테이블 (인증)
-- ─────────────────────────────────────────────
CREATE TABLE users (
    id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       VARCHAR(255)  NOT NULL UNIQUE,
    -- 비밀번호 평문 절대 금지: bcrypt 해시 저장
    password_hash VARCHAR(72) NOT NULL,
    nickname    VARCHAR(50),
    is_active   BOOLEAN       NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);

-- ─────────────────────────────────────────────
-- 포트폴리오
-- ─────────────────────────────────────────────
CREATE TABLE portfolios (
    id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100)  NOT NULL DEFAULT '내 포트폴리오',
    is_default  BOOLEAN       NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolios_user_id ON portfolios (user_id);

CREATE TABLE portfolio_holdings (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id    UUID          NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    symbol          VARCHAR(20)   NOT NULL,
    asset_type      asset_type    NOT NULL,
    quantity        NUMERIC(24,8) NOT NULL CHECK (quantity > 0),
    avg_buy_price   NUMERIC(18,4) NOT NULL CHECK (avg_buy_price > 0),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (portfolio_id, symbol)
);

CREATE INDEX idx_holdings_portfolio ON portfolio_holdings (portfolio_id);

-- ─────────────────────────────────────────────
-- updated_at 자동 갱신 트리거
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_portfolios_updated_at
    BEFORE UPDATE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_holdings_updated_at
    BEFORE UPDATE ON portfolio_holdings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
