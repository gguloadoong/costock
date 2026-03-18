/**
 * LiveIndicator — WebSocket connection status indicator.
 *
 * Three states:
 *   live         — connected, data is fresh (green dot, pulses)
 *   stale        — connected but no update for >5s (amber dot)
 *   disconnected — WebSocket is closed (red dot)
 *
 * Accessibility: status role with descriptive aria-label.
 */

'use client';

import React from 'react';
import { Box } from '@coinbase/cds-web/layout';
import { Text } from '@coinbase/cds-web/typography';

export type LiveStatus = 'live' | 'stale' | 'disconnected';

export interface LiveIndicatorProps {
  status: LiveStatus;
  /** Show text label alongside dot (default: true) */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const statusConfig: Record<
  LiveStatus,
  { dotColor: string; label: string; ariaLabel: string; pulse: boolean }
> = {
  live: {
    dotColor: '#10B981',
    label: 'LIVE',
    ariaLabel: '실시간 연결됨 — 데이터가 최신 상태입니다',
    pulse: true,
  },
  stale: {
    dotColor: '#F59E0B',
    label: '지연',
    ariaLabel: '데이터 지연 — 5초 이상 업데이트가 없습니다',
    pulse: false,
  },
  disconnected: {
    dotColor: '#EF4444',
    label: '연결 끊김',
    ariaLabel: '연결 끊김 — 실시간 데이터를 수신하지 못하고 있습니다',
    pulse: false,
  },
};

export function LiveIndicator({
  status,
  showLabel = true,
  className = '',
}: LiveIndicatorProps): React.ReactElement {
  const config = statusConfig[status];

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      className={className}
      role="status"
      aria-label={config.ariaLabel}
      aria-live="polite"
    >
      {/* Dot with optional pulse ring */}
      <span style={{ position: 'relative', display: 'flex', width: '8px', height: '8px', flexShrink: 0 }}>
        {config.pulse && (
          <span
            style={{
              position: 'absolute',
              display: 'inline-flex',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: config.dotColor,
              opacity: 0.75,
              animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite',
            }}
            aria-hidden="true"
          />
        )}
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: config.dotColor,
          }}
          aria-hidden="true"
        />
      </span>

      {showLabel && (
        <span
          style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}
          aria-hidden="true"
        >
          {config.label}
        </span>
      )}
    </span>
  );
}

export default LiveIndicator;
