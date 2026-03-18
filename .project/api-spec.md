# CoStock API 스펙

**작성자**: 최재원 (BE)
**최종 수정**: 2026-03-18

---

## 1. 기본 규칙

```
Base URL:     https://api.costock.kr/v1
Auth:         Authorization: Bearer <JWT>
Content-Type: application/json
```

### 공통 에러 형식 (RFC 7807)
```json
{
  "type": "https://api.costock.kr/errors/not-found",
  "title": "종목을 찾을 수 없습니다",
  "status": 404,
  "detail": "symbol 'AAPL'은 지원하지 않는 종목입니다",
  "instance": "/v1/instruments/AAPL"
}
```

---

## 2. 종목 (Instruments)

### 종목 검색
```
GET /v1/instruments/search?q={query}&type={stock|coin|all}
```

**응답**
```json
{
  "data": [
    {
      "symbol": "005930",
      "name": "삼성전자",
      "type": "stock",
      "exchange": "KOSPI",
      "currentPrice": 85400,
      "changeRate": 1.43,
      "change": 1200
    },
    {
      "symbol": "BTC-KRW",
      "name": "비트코인",
      "type": "coin",
      "exchange": "UPBIT",
      "currentPrice": 142850000,
      "changeRate": -0.89,
      "change": -1285000
    }
  ],
  "meta": { "total": 2, "query": "삼성" }
}
```

### 종목 상세
```
GET /v1/instruments/{symbol}
```

**응답**
```json
{
  "data": {
    "symbol": "005930",
    "name": "삼성전자",
    "type": "stock",
    "exchange": "KOSPI",
    "currency": "KRW",
    "currentPrice": 85400,
    "change": 1200,
    "changeRate": 1.43,
    "open": 84200,
    "high": 85800,
    "low": 83900,
    "volume": 12345678,
    "marketCap": 509726000000000,
    "updatedAt": "2026-03-18T09:35:00Z"
  }
}
```

---

## 3. 가격 이력 (Price History)

### 캔들 데이터
```
GET /v1/instruments/{symbol}/candles?interval={1m|5m|15m|1h|1d|1w}&limit={int}&before={timestamp}
```

**응답**
```json
{
  "data": [
    {
      "time": "2026-03-18T09:00:00Z",
      "open": 84200,
      "high": 85800,
      "low": 83900,
      "close": 85400,
      "volume": 1234567
    }
  ],
  "meta": {
    "symbol": "005930",
    "interval": "1d",
    "cursor": "eyJ0aW1lIjoxNzQyMjgwMDAwfQ=="
  }
}
```

---

## 4. 시장 지수 (Market Indices)

```
GET /v1/market/indices
```

**응답**
```json
{
  "data": {
    "kospi": { "value": 2834.56, "change": 12.34, "changeRate": 0.44 },
    "kosdaq": { "value": 854.23, "change": -3.21, "changeRate": -0.37 },
    "btcDominance": { "value": 52.3, "change": 0.8, "changeRate": 1.55 }
  },
  "updatedAt": "2026-03-18T09:35:00Z"
}
```

---

## 5. 뉴스 (News)

### 종목 관련 뉴스
```
GET /v1/news?symbols={comma-separated}&page={cursor}&limit={int}
```

**응답**
```json
{
  "data": [
    {
      "id": "news-001",
      "title": "삼성전자, AI 반도체 신규 수주 계약 체결",
      "source": "한국경제",
      "url": "https://...",
      "publishedAt": "2026-03-18T08:30:00Z",
      "relatedSymbols": ["005930", "000660"]
    }
  ],
  "meta": { "nextCursor": "eyJpZCI6Im5ld3MtMDUwIn0=" }
}
```

---

## 6. 사용자 관심종목 (Watchlist)

# MVP 범위 외 — localStorage 기반으로 서버 저장 불필요

```
GET    /v1/watchlist            # 목록 조회
POST   /v1/watchlist            # 추가 { "symbol": "005930" }
DELETE /v1/watchlist/{symbol}   # 삭제
```

---

## 7. WebSocket API

### 연결
```
WSS wss://ws.costock.kr/v1/realtime
Authorization: Bearer <JWT>
```

### 구독 (클라이언트 → 서버)
```json
{
  "type": "subscribe",
  "symbols": ["005930", "000660", "BTC-KRW"]
}
```

### 가격 업데이트 (서버 → 클라이언트)
```json
{
  "type": "price",
  "symbol": "005930",
  "price": 85400,
  "change": 1200,
  "changeRate": 1.43,
  "volume": 12345678,
  "timestamp": 1742278500000
}
```

### 연결 유지
```json
// 클라이언트가 30초마다 ping
{ "type": "ping" }
// 서버 응답
{ "type": "pong", "timestamp": 1742278530000 }
```

---

## 8. Rate Limiting
| 엔드포인트 | 제한 | 초과 시 |
|-----------|------|--------|
| 검색 API | 30 req/min | 429 |
| 가격 이력 | 60 req/min | 429 |
| WebSocket | 연결당 1000 구독 | 에러 메시지 |
| 일반 GET | 100 req/min | 429 |
