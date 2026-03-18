/**
 * watchlistStorage — 관심종목 영구 저장소
 *
 * 전략:
 *   1순위: IndexedDB (costock-db / watchlist store)
 *   2순위: localStorage 폴백 (costock:watchlist)
 *   시크릿 모드: try-catch로 저장 실패 시 조용히 처리
 *
 * 보안: 사용자 투자 데이터 로그 출력 금지
 */

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface WatchlistItem {
  id: string;       // "KR_005930" (주식) | "KRW-BTC" (코인)
  type: 'stock' | 'coin';
  name: string;
  addedAt: number;  // Unix timestamp ms
}

export interface WatchlistPreferences {
  theme: 'light' | 'dark';
  defaultTab: 'watchlist' | 'stock' | 'coin';
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const DB_NAME = 'costock-db';
const STORE_NAME = 'watchlist';
const DB_VERSION = 1;
const LS_KEY = 'costock:watchlist';
const LAST_VISIT_KEY = 'costock:last-visit';
const MAX_WATCHLIST_SIZE = 100;

// ─── 시크릿 모드 감지 ─────────────────────────────────────────────────────────

let _isPrivateMode: boolean | null = null;

export async function isPrivateMode(): Promise<boolean> {
  if (_isPrivateMode !== null) return _isPrivateMode;
  try {
    localStorage.setItem('__costock_probe__', '1');
    localStorage.removeItem('__costock_probe__');
    _isPrivateMode = false;
  } catch {
    _isPrivateMode = true;
  }
  return _isPrivateMode;
}

// ─── 방문 타임스탬프 갱신 ─────────────────────────────────────────────────────

function updateLastVisit(): void {
  try {
    localStorage.setItem(LAST_VISIT_KEY, Date.now().toString());
  } catch {
    // 시크릿 모드 등 — 무시
  }
}

// ─── IndexedDB 헬퍼 ───────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGetAll(): Promise<WatchlistItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result as WatchlistItem[]);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function idbPut(item: WatchlistItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(item);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function idbClear(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

// ─── localStorage 폴백 헬퍼 ───────────────────────────────────────────────────

function lsGetAll(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WatchlistItem[];
  } catch {
    return [];
  }
}

function lsSave(items: WatchlistItem[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    // 시크릿 모드 등 — 무시
  }
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 관심종목 목록 조회
 * addedAt 내림차순 (최근 추가순) 정렬
 */
export async function getWatchlist(): Promise<WatchlistItem[]> {
  updateLastVisit();

  // IndexedDB 시도
  try {
    const items = await idbGetAll();
    return items.sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    // localStorage 폴백
    return lsGetAll().sort((a, b) => b.addedAt - a.addedAt);
  }
}

/**
 * 관심종목 추가
 * @returns 'added' | 'duplicate' | 'limit_exceeded'
 */
export async function addToWatchlist(
  item: WatchlistItem
): Promise<'added' | 'duplicate' | 'limit_exceeded'> {
  // IndexedDB 시도
  try {
    const existing = await idbGetAll();

    if (existing.some((i) => i.id === item.id)) return 'duplicate';
    if (existing.length >= MAX_WATCHLIST_SIZE) return 'limit_exceeded';

    await idbPut(item);
    return 'added';
  } catch {
    // localStorage 폴백
    const existing = lsGetAll();

    if (existing.some((i) => i.id === item.id)) return 'duplicate';
    if (existing.length >= MAX_WATCHLIST_SIZE) return 'limit_exceeded';

    lsSave([...existing, item]);
    return 'added';
  }
}

/**
 * 관심종목 삭제
 */
export async function removeFromWatchlist(id: string): Promise<void> {
  try {
    await idbDelete(id);
  } catch {
    // localStorage 폴백
    const existing = lsGetAll();
    lsSave(existing.filter((i) => i.id !== id));
  }
}

/**
 * 관심종목 전체 삭제
 */
export async function clearWatchlist(): Promise<void> {
  try {
    await idbClear();
  } catch {
    // localStorage 폴백
    lsSave([]);
  }
}
