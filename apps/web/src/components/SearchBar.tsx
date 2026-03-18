/**
 * SearchBar — 통합 종목 검색 UI
 *
 * 기능:
 *   - 주식 + 코인 통합 검색 (GET /api/v1/instruments/search?q={query})
 *   - 결과 드롭다운: [주식] / [코인] 배지 혼합 표시
 *   - 최근 검색어 localStorage 저장 (최대 10개)
 *   - 디바운스 300ms
 *   - 키보드 접근성 (ESC 닫기, 방향키 탐색)
 *
 * 보안: 사용자 검색어 서버 로그 출력 금지
 */

'use client';

import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import type { AssetType } from '@/design-system';
import { getAssetBadgeStyle, getAssetBadgeLabel } from '@/design-system';
import type { SearchResult, RecentSearch } from '@/types/market';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const MAX_RECENT_SEARCHES = 10;
const RECENT_SEARCHES_KEY = 'costock:recent-searches';
const DEBOUNCE_MS = 300;
const SEARCH_API_BASE = '/api/v1/instruments/search';

// ─── 인기 종목 (Phase 1 하드코딩) ─────────────────────────────────────────────

interface PopularSymbol {
  symbol: string;
  name: string;
  type: AssetType;
}

const POPULAR_SYMBOLS: PopularSymbol[] = [
  { symbol: 'KRW-BTC', name: '비트코인', type: 'coin' as AssetType },
  { symbol: '005930', name: '삼성전자', type: 'stock' as AssetType },
  { symbol: 'KRW-ETH', name: '이더리움', type: 'coin' as AssetType },
  { symbol: '000660', name: 'SK하이닉스', type: 'stock' as AssetType },
  { symbol: 'KRW-SOL', name: '솔라나', type: 'coin' as AssetType },
  { symbol: '035420', name: 'NAVER', type: 'stock' as AssetType },
];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function loadRecentSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentSearch[];
  } catch {
    return [];
  }
}

function saveRecentSearch(item: Omit<RecentSearch, 'searchedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadRecentSearches().filter((r) => r.symbol !== item.symbol);
    const updated: RecentSearch[] = [
      { ...item, searchedAt: Date.now() },
      ...existing,
    ].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // localStorage 접근 실패 시 무시 (시크릿 모드 등)
  }
}

function removeRecentSearch(symbol: string): void {
  if (typeof window === 'undefined') return;
  try {
    const updated = loadRecentSearches().filter((r) => r.symbol !== symbol);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // 무시
  }
}

// ─── 자산 타입 배지 ───────────────────────────────────────────────────────────

function AssetBadge({ type }: { type: AssetType }): React.ReactElement {
  const label = getAssetBadgeLabel(type);
  return (
    <span
      style={{
        flexShrink: 0,
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 500,
        ...getAssetBadgeStyle(type),
      }}
      aria-label={`자산 유형: ${label}`}
    >
      [{label}]
    </span>
  );
}

// ─── 검색 결과 아이템 ─────────────────────────────────────────────────────────

interface ResultItemProps {
  item: SearchResult;
  isActive: boolean;
  onSelect: (item: SearchResult) => void;
  id: string;
}

function ResultItem({ item, isActive, onSelect, id }: ResultItemProps): React.ReactElement {
  return (
    <button
      id={id}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        background: isActive ? '#F1F5F9' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onClick={() => onSelect(item)}
      role="option"
      aria-selected={isActive}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#0F172A',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </span>
        <span style={{ fontSize: '12px', fontFamily: 'Menlo, Consolas, monospace', color: '#64748B' }}>
          {item.symbol}
        </span>
      </div>
      <AssetBadge type={item.type} />
    </button>
  );
}

// ─── 최근 검색 아이템 ─────────────────────────────────────────────────────────

interface RecentItemProps {
  item: RecentSearch;
  isActive: boolean;
  onSelect: (item: RecentSearch) => void;
  onRemove: (symbol: string) => void;
  id: string;
}

function RecentItem({ item, isActive, onSelect, onRemove, id }: RecentItemProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        background: isActive ? '#F1F5F9' : 'transparent',
      }}
    >
      <button
        id={id}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          padding: 0,
        }}
        onClick={() => onSelect(item)}
        role="option"
        aria-selected={isActive}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#0F172A',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.name}
          </span>
          <span style={{ fontSize: '12px', fontFamily: 'Menlo, Consolas, monospace', color: '#64748B' }}>
            {item.symbol}
          </span>
        </div>
        <AssetBadge type={item.type} />
      </button>
      <button
        style={{
          flexShrink: 0,
          padding: '4px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#94A3B8',
        }}
        onClick={() => onRemove(item.symbol)}
        aria-label={`${item.name} 최근 검색에서 삭제`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M1 1L11 11M11 1L1 11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

// ─── 인기 종목 아이템 ─────────────────────────────────────────────────────────

interface PopularItemProps {
  item: PopularSymbol;
  isActive: boolean;
  onSelect: (item: PopularSymbol) => void;
  id: string;
}

function PopularItem({ item, isActive, onSelect, id }: PopularItemProps): React.ReactElement {
  return (
    <button
      id={id}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        background: isActive ? '#F1F5F9' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onClick={() => onSelect(item)}
      role="option"
      aria-selected={isActive}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#0F172A',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </span>
        <span style={{ fontSize: '12px', fontFamily: 'Menlo, Consolas, monospace', color: '#64748B' }}>
          {item.symbol}
        </span>
      </div>
      <AssetBadge type={item.type} />
    </button>
  );
}

// ─── SearchBar ────────────────────────────────────────────────────────────────

export interface SearchBarProps {
  onSelect?: (symbol: string, name: string, type: AssetType) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  onSelect,
  placeholder = '종목명 또는 심볼 검색',
  className = '',
}: SearchBarProps): React.ReactElement {
  const instanceId = useId();
  const listboxId = `search-listbox-${instanceId}`;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState('60vh');

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 최근 검색어 초기 로드
  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  // 모바일 키보드 대응: 드롭다운 높이 동적 계산
  useEffect(() => {
    const updateHeight = () => {
      if (window.visualViewport) {
        const available = window.visualViewport.height - 160;
        setDropdownMaxHeight(`${Math.max(200, available)}px`);
      }
    };
    window.visualViewport?.addEventListener('resize', updateHeight);
    updateHeight();
    return () => window.visualViewport?.removeEventListener('resize', updateHeight);
  }, []);

  // ─── 검색 API 호출 ──────────────────────────────────────────────────────

  const fetchResults = useCallback(async (q: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    try {
      const url = `${SEARCH_API_BASE}?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        setResults([]);
        return;
      }
      const json = (await res.json()) as { data: Array<{ symbol: string; name: string; assetType: string; exchange: string }> } | SearchResult[];
      // API v1 returns { data, meta } — unwrap and normalize assetType → type
      const raw = Array.isArray(json) ? json : (json as { data: Array<{ symbol: string; name: string; assetType: string; exchange: string }> }).data;
      const normalized: SearchResult[] = (raw as Array<{ symbol: string; name: string; assetType: string; exchange: string; type?: AssetType }>).map((item) => ({
        symbol: item.symbol,
        name: item.name,
        type: (item.type ?? (item.assetType === 'crypto' ? 'coin' : 'stock')) as AssetType,
        exchange: item.exchange ?? '',
        matchedQuery: q,
      }));
      setResults(normalized);
      setActiveIndex(-1);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── 디바운스 검색 ──────────────────────────────────────────────────────

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      void fetchResults(trimmed);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, fetchResults]);

  // ─── 외부 클릭 닫기 ─────────────────────────────────────────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── 종목 선택 ──────────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (symbol: string, name: string, type: AssetType) => {
      saveRecentSearch({ symbol, name, type });
      setRecentSearches(loadRecentSearches());
      setQuery('');
      setIsOpen(false);
      setResults([]);
      onSelect?.(symbol, name, type);
    },
    [onSelect]
  );

  const handleResultSelect = useCallback(
    (item: SearchResult) => handleSelect(item.symbol, item.name, item.type),
    [handleSelect]
  );

  const handleRecentSelect = useCallback(
    (item: RecentSearch) => handleSelect(item.symbol, item.name, item.type),
    [handleSelect]
  );

  const handleRemoveRecent = useCallback((symbol: string) => {
    removeRecentSearch(symbol);
    setRecentSearches(loadRecentSearches());
  }, []);

  const handlePopularSelect = useCallback(
    (item: PopularSymbol) => handleSelect(item.symbol, item.name, item.type),
    [handleSelect]
  );

  // ─── 키보드 탐색 ────────────────────────────────────────────────────────

  // 빈 쿼리 상태: 최근 검색어 + 인기 종목 순서로 탐색
  const dropdownItems: Array<RecentSearch | SearchResult | PopularSymbol> = query.trim()
    ? results
    : [...recentSearches, ...POPULAR_SYMBOLS];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => Math.min(prev + 1, dropdownItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < dropdownItems.length) {
            const item = dropdownItems[activeIndex];
            if ('searchedAt' in item) {
              handleRecentSelect(item as RecentSearch);
            } else if ('matchedQuery' in item) {
              handleResultSelect(item as SearchResult);
            } else {
              handlePopularSelect(item as PopularSymbol);
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, dropdownItems, activeIndex, handleResultSelect, handleRecentSelect, handlePopularSelect]
  );

  // 빈 쿼리: 최근 검색어 또는 인기 종목이 있으면 드롭다운 표시
  const showDropdown = isOpen && (query.trim() ? results.length > 0 || isLoading : true);

  return (
    <div ref={containerRef} style={{ position: 'relative' }} className={className}>
      {/* 입력창 */}
      <div style={{ position: 'relative' }}>
        {/* 돋보기 아이콘 */}
        <div
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5" stroke="#94A3B8" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            width: '100%',
            height: '44px',
            paddingLeft: '36px',
            paddingRight: '16px',
            borderRadius: '12px',
            background: '#F1F5F9',
            border: '1px solid transparent',
            fontSize: '14px',
            color: '#0F172A',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-item-${activeIndex}` : undefined
          }
          aria-label="종목 검색"
          aria-autocomplete="list"
          autoComplete="off"
        />

        {/* 로딩 스피너 */}
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            <svg
              style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px', color: '#94A3B8' }}
              viewBox="0 0 24 24"
              fill="none"
              aria-label="검색 중"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      {/* 드롭다운 */}
      {showDropdown && (
        <div
          id={listboxId}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            zIndex: 50,
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            maxHeight: dropdownMaxHeight,
            overflowY: 'auto',
          }}
          role="listbox"
          aria-label={query.trim() ? '검색 결과' : '최근 검색어 및 인기 종목'}
        >
          {query.trim() ? (
            <>
              {/* 검색 결과 섹션 헤더 */}
              <div style={{ padding: '8px 16px', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#94A3B8' }}>검색 결과</span>
              </div>
              {results.map((item, i) => (
                <ResultItem
                  key={item.symbol}
                  id={`${listboxId}-item-${i}`}
                  item={item}
                  isActive={activeIndex === i}
                  onSelect={handleResultSelect}
                />
              ))}
            </>
          ) : (
            <>
              {/* 최근 검색어 섹션 */}
              {recentSearches.length > 0 && (
                <>
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#94A3B8' }}>최근 검색</span>
                  </div>
                  {recentSearches.map((item, i) => (
                    <RecentItem
                      key={item.symbol}
                      id={`${listboxId}-item-${i}`}
                      item={item}
                      isActive={activeIndex === i}
                      onSelect={handleRecentSelect}
                      onRemove={handleRemoveRecent}
                    />
                  ))}
                </>
              )}

              {/* 인기 종목 섹션 */}
              <div
                style={{
                  padding: '8px 16px',
                  borderBottom: '1px solid #F1F5F9',
                  borderTop: recentSearches.length > 0 ? '1px solid #E2E8F0' : undefined,
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#94A3B8' }}>인기 종목 🔥</span>
              </div>
              {POPULAR_SYMBOLS.map((item, i) => {
                const globalIndex = recentSearches.length + i;
                return (
                  <PopularItem
                    key={item.symbol}
                    id={`${listboxId}-item-${globalIndex}`}
                    item={item}
                    isActive={activeIndex === globalIndex}
                    onSelect={handlePopularSelect}
                  />
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
