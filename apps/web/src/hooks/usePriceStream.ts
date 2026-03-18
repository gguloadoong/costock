/**
 * usePriceStream — WebSocket 기반 실시간 가격 스트림 훅
 *
 * 기능:
 *   - WebSocket 연결/해제 관리
 *   - 심볼 구독: { type: "subscribe", symbols: [...] }
 *   - stale 감지: 5초 미수신 시 status → 'stale'
 *   - 재연결: 지수 백오프 (1s, 2s, 4s, ... 최대 30s)
 *   - 컴포넌트 언마운트 시 자동 정리
 *
 * 사용 예:
 *   const { prices, status } = usePriceStream(['005930', 'BTC-KRW']);
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { LiveStatus } from '@/design-system';
import type { PriceData, WsInboundMessage, WsOutboundMessage } from '@/types/market';
import { validatePriceUpdate } from '../design-system/utils/validatePriceUpdate';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

// 환경변수로 관리 — 절대 하드코딩 금지
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3101/ws/prices';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface PriceStreamState {
  /** symbol → 최신 가격 데이터 맵 */
  prices: Map<string, PriceData>;
  /** WebSocket 연결 상태 */
  status: LiveStatus;
}

export interface UsePriceStreamOptions {
  /** 비활성화 플래그 (페이지 숨김 시 등) */
  enabled?: boolean;
}

// ─── 훅 ───────────────────────────────────────────────────────────────────────

export function usePriceStream(
  symbols: string[],
  options: UsePriceStreamOptions = {}
): PriceStreamState {
  const { enabled = true } = options;

  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [status, setStatus] = useState<LiveStatus>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const symbolsRef = useRef<string[]>(symbols);
  const mountedRef = useRef(true);

  // symbols 레퍼런스를 최신으로 유지 (재연결 시 참조용)
  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  // ─── stale 타이머 리셋 ────────────────────────────────────────────────────

  const resetStaleTimer = useCallback(() => {
    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current);
    }
    staleTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setStatus('stale');
      }
    }, STALE_THRESHOLD_MS);
  }, []);

  // ─── 구독 전송 ────────────────────────────────────────────────────────────

  const sendSubscribe = useCallback((ws: WebSocket, syms: string[]) => {
    if (ws.readyState !== WebSocket.OPEN || syms.length === 0) return;
    const msg: WsOutboundMessage = { type: 'subscribe', symbols: syms };
    ws.send(JSON.stringify(msg));
  }, []);

  // ─── 연결 ─────────────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // 기존 소켓 정리
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      reconnectAttemptRef.current = 0;
      setStatus('live');
      resetStaleTimer();
      sendSubscribe(ws, symbolsRef.current);
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      if (!mountedRef.current) return;

      let parsed: WsInboundMessage;
      try {
        parsed = JSON.parse(event.data) as WsInboundMessage;
      } catch {
        // 파싱 실패 — 무시 (메시지 형식 오류)
        return;
      }

      resetStaleTimer();
      setStatus('live');

      if (parsed.type === 'price_update') {
        const update = parsed.data;
        const validation = validatePriceUpdate({
          price: update.price,
          previousClose: undefined, // WebSocket 메시지에 previousClose 없음
          timestamp: update.timestamp ?? Date.now(),
        });
        if (!validation.valid) {
          console.warn('[usePriceStream] 이상값 수신 — 무시:', update.symbol, validation.reason);
          return;
        }
        setPrices((prev) => {
          const next = new Map(prev);
          next.set(update.symbol, update);
          return next;
        });
      }
      // heartbeat는 stale 타이머 리셋만 처리 (위에서 이미 처리됨)
    };

    ws.onerror = () => {
      // 에러 상세는 서버 로그에서 확인 — 클라이언트에 내부 정보 노출 금지
      if (!mountedRef.current) return;
      setStatus('disconnected');
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      scheduleReconnect();
    };
  }, [resetStaleTimer, sendSubscribe]);

  // ─── 지수 백오프 재연결 ───────────────────────────────────────────────────

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt),
      MAX_RECONNECT_DELAY_MS
    );
    reconnectAttemptRef.current = attempt + 1;

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, delay);
  }, [connect]);

  // ─── 심볼 변경 시 재구독 ──────────────────────────────────────────────────

  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && symbols.length > 0) {
      sendSubscribe(ws, symbols);
    }
  }, [symbols, sendSubscribe]);

  // ─── 연결 생명주기 ────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      connect();
    }

    return () => {
      mountedRef.current = false;

      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // connect는 최초 마운트 시에만 실행 (enabled 토글 대응)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { prices, status };
}
