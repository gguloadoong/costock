"""
CoStock 업비트 실시간 ticker 수집기
WebSocket → Kafka producer

빗썸/업비트 운영 경험 기반:
- 원화마켓 전체 ticker 구독 (24시간 누적 거래량 포함)
- 재연결 전략: 지수 백오프 (1s → 2s → 4s → 최대 30s)
- ping/pong heartbeat 30초 간격으로 연결 끊김 감지
- 이상값 필터링 (0원, 음수, ±30% 급변 → anomaly 토픽 분리)
- 민감 정보 절대 로그 금지 (공개 WebSocket — API 키 미사용)
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field

import websockets
from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaConnectionError

logger = logging.getLogger("costock.collector.upbit")
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

UPBIT_WS_URL = "wss://api.upbit.com/websocket/v1"
KAFKA_TOPIC = "crypto.raw"
ANOMALY_TOPIC = "price.anomaly"
ANOMALY_THRESHOLD = 0.30  # ±30% 급변 필터

# 수집 대상 마켓 (환경변수로 주입 — 하드코딩 금지)
MARKETS: list[str] = os.environ.get(
    "UPBIT_MARKETS",
    "KRW-BTC,KRW-ETH,KRW-XRP,KRW-SOL,KRW-DOGE",
).split(",")

# 재연결 파라미터
RECONNECT_BASE_DELAY = 1.0   # 초기 대기 (초)
RECONNECT_MAX_DELAY  = 30.0  # 최대 대기 (초)

# WebSocket 연결 파라미터
WS_OPEN_TIMEOUT    = 5     # 연결 타임아웃 (초) — 아키텍처 원칙 최대 5초
WS_PING_INTERVAL   = 30    # heartbeat 간격 (초)
WS_PING_TIMEOUT    = 10    # pong 미수신 허용 시간 (초)
WS_CLOSE_TIMEOUT   = 5     # 닫힘 대기 (초)


@dataclass
class PriceState:
    """이상값 감지를 위한 직전 가격 상태 관리"""
    last_price: dict[str, float] = field(default_factory=dict)
    last_update: dict[str, float] = field(default_factory=dict)


price_state = PriceState()


def is_anomaly(symbol: str, price: float) -> bool:
    """
    이상값 판단 기준:
    - 0원 또는 음수 → 즉시 이상값
    - 직전 대비 ±30% 초과 급변 → 이상값

    정상 가격이면 상태 갱신 후 False 반환
    """
    if price <= 0:
        logger.warning("이상값 감지: %s 가격=%s (0 이하)", symbol, price)
        return True

    last = price_state.last_price.get(symbol)
    if last is None or last <= 0:
        # 최초 수신 — 기준값 등록 후 정상 처리
        price_state.last_price[symbol] = price
        price_state.last_update[symbol] = time.time()
        return False

    change_rate = abs(price - last) / last
    if change_rate > ANOMALY_THRESHOLD:
        logger.warning(
            "이상값 감지: %s 가격=%s 직전=%s 변동률=%.2f%%",
            symbol, price, last, change_rate * 100,
        )
        return True

    price_state.last_price[symbol] = price
    price_state.last_update[symbol] = time.time()
    return False


def build_kafka_payload(data: dict) -> dict:
    """
    업비트 ticker WebSocket 응답 → 표준 CoStock 메시지 포맷 변환

    업비트 ticker 필드:
      code             : 마켓 코드 (예: KRW-BTC)
      trade_price      : 현재가
      signed_change_price  : 전일 대비 변화액 (부호 포함)
      signed_change_rate   : 전일 대비 변동률 (부호 포함, 소수)
      acc_trade_volume_24h : 24시간 누적 거래량
      timestamp        : 체결 타임스탬프 (ms)
    """
    symbol: str = data.get("code", "")
    price: float = float(data.get("trade_price", 0))
    change: float = float(data.get("signed_change_price", 0))
    change_rate: float = float(data.get("signed_change_rate", 0))
    volume_24h: float = float(data.get("acc_trade_volume_24h", 0))
    timestamp: int = int(data.get("timestamp", int(time.time() * 1000)))

    return {
        "symbol": symbol,            # "BTC-KRW" 형식 유지 (API spec 기준)
        "price": price,
        "change": change,
        "changeRate": change_rate,
        "volume24h": volume_24h,
        "timestamp": timestamp,
        "source": "upbit",
    }


async def produce_message(
    producer: AIOKafkaProducer,
    payload: dict,
    anomaly: bool,
) -> None:
    """Kafka 발행 — 이상값은 anomaly 토픽으로 분리"""
    topic = ANOMALY_TOPIC if anomaly else KAFKA_TOPIC
    key = payload["symbol"].encode("utf-8")
    value = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    await producer.send_and_wait(topic, key=key, value=value)


async def run_collector(producer: AIOKafkaProducer) -> None:
    """
    업비트 WebSocket 연결 및 ticker 메시지 처리 루프

    재연결 전략: 지수 백오프
      1회 실패  → 1초 대기
      2회 실패  → 2초 대기
      3회 실패  → 4초 대기
      ...
      최대 30초 상한

    구독 타입: ticker (원화마켓 전체 현재가 + 24h 거래량)
    isOnlyRealtime: True → 최초 스냅샷 없이 실시간 변경 시만 수신
    """
    retry_count = 0

    # ticker 구독 페이로드
    subscribe_payload = json.dumps([
        {"ticket": "costock-upbit-collector"},
        {
            "type": "ticker",
            "codes": MARKETS,
            "isOnlyRealtime": True,
        },
    ])

    while True:
        try:
            logger.info("업비트 WebSocket 연결 시도 (retry=%d, markets=%d개)", retry_count, len(MARKETS))

            async with websockets.connect(
                UPBIT_WS_URL,
                open_timeout=WS_OPEN_TIMEOUT,
                ping_interval=WS_PING_INTERVAL,
                ping_timeout=WS_PING_TIMEOUT,
                close_timeout=WS_CLOSE_TIMEOUT,
            ) as ws:
                await ws.send(subscribe_payload)
                logger.info("업비트 ticker 구독 완료: %s", MARKETS)
                retry_count = 0  # 연결 성공 시 재시도 카운터 초기화

                async for raw_message in ws:
                    try:
                        data = json.loads(raw_message)
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        logger.warning("메시지 파싱 실패 — 건너뜀")
                        continue

                    # ticker 타입만 처리 (ping/pong 등 제외)
                    if data.get("type") != "ticker":
                        continue

                    symbol: str = data.get("code", "")
                    price: float = float(data.get("trade_price", 0))

                    if not symbol:
                        continue

                    anomaly = is_anomaly(symbol, price)
                    payload = build_kafka_payload(data)

                    await produce_message(producer, payload, anomaly)

                    if anomaly:
                        logger.warning(
                            "이상값 → anomaly 토픽 발행: symbol=%s price=%s",
                            symbol, price,
                        )

        except websockets.exceptions.ConnectionClosed as e:
            logger.warning(
                "WebSocket 연결 끊김 (code=%s reason=%s) — 재연결 준비",
                e.code, e.reason,
            )
        except asyncio.TimeoutError:
            logger.warning("WebSocket 연결 타임아웃 — 재연결 준비")
        except Exception as e:
            logger.error("예상치 못한 에러: %s: %s", type(e).__name__, e)

        # 지수 백오프: min(base * 2^retry, max)
        delay = min(RECONNECT_BASE_DELAY * (2 ** retry_count), RECONNECT_MAX_DELAY)
        retry_count += 1
        logger.info("%.1f초 후 재연결 시도 (retry=%d)", delay, retry_count)
        await asyncio.sleep(delay)


async def main() -> None:
    kafka_brokers = os.environ.get("KAFKA_BROKERS", "localhost:9092")

    producer = AIOKafkaProducer(
        bootstrap_servers=kafka_brokers,
        value_serializer=None,   # 직접 bytes 전달
        compression_type="gzip",
        max_batch_size=16384,
        linger_ms=5,             # 5ms 배치 대기 (처리량 vs 지연 트레이드오프)
        request_timeout_ms=5_000,
        retry_backoff_ms=100,
    )

    try:
        await producer.start()
        logger.info("Kafka producer 연결 완료: brokers=%s", kafka_brokers)
        await run_collector(producer)
    except KafkaConnectionError as e:
        logger.error("Kafka 연결 실패: %s", e)
        raise
    finally:
        await producer.stop()
        logger.info("Kafka producer 종료")


if __name__ == "__main__":
    asyncio.run(main())
