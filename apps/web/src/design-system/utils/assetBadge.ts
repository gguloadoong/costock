/**
 * assetBadge — 자산 유형 배지 스타일 유틸리티
 *
 * PriceCard, SearchBar 등 여러 컴포넌트에서 공유하는 배지 스타일/레이블.
 */

import type React from 'react';

export type AssetType = 'stock' | 'coin';

export function getAssetBadgeStyle(type: AssetType): React.CSSProperties {
  return type === 'stock'
    ? { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }
    : { background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' };
}

export function getAssetBadgeLabel(type: AssetType): string {
  return type === 'stock' ? '주식' : '코인';
}
