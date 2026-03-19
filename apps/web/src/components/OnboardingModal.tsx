'use client';

import React from 'react';

interface OnboardingModalProps {
  onClose: () => void;
}

const BULLETS: string[] = [
  'AI 트레이더가 실시간 매매',
  '이유와 함께 피드에 공개',
  '알림 구독 시 즉시 알림',
];

export function OnboardingModal({ onClose }: OnboardingModalProps): React.ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '360px',
          width: '100%',
          boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
        }}
      >
        {/* 브랜드 */}
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#3B82F6',
            letterSpacing: '0.08em',
            marginBottom: '16px',
          }}
        >
          CoStock
        </div>

        {/* 핵심 메시지 */}
        <h1
          id="onboarding-title"
          style={{
            fontSize: '28px',
            fontWeight: 800,
            color: '#0F172A',
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
            margin: 0,
            marginBottom: '24px',
          }}
        >
          AI가 왜 샀는지
          <br />
          보여드립니다.
          <br />
          <span style={{ color: '#3B82F6' }}>판단은 당신이 합니다.</span>
        </h1>

        {/* 구분선 */}
        <div
          style={{
            borderTop: '1px solid #E2E8F0',
            marginBottom: '16px',
          }}
        />

        {/* 기능 목록 */}
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          {BULLETS.map((text) => (
            <li
              key={text}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                color: '#374151',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#0F172A',
                  flexShrink: 0,
                }}
              />
              {text}
            </li>
          ))}
        </ul>

        {/* 구분선 */}
        <div
          style={{
            borderTop: '1px solid #E2E8F0',
            marginBottom: '20px',
          }}
        />

        {/* 면책 고지 */}
        <p
          style={{
            fontSize: '11px',
            color: '#9CA3AF',
            textAlign: 'center',
            margin: 0,
            marginBottom: '20px',
            lineHeight: 1.5,
          }}
        >
          모의투자 기반 · 실제 투자 아님
        </p>

        {/* CTA 버튼 */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: '#0F172A',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            padding: '16px',
            fontSize: '16px',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          시작하기 →
        </button>
      </div>
    </div>
  );
}
