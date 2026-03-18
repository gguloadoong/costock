const STORAGE_KEY = 'costock_search_history';
const MAX_ITEMS = 10;

export interface SearchHistoryItem {
  symbol: string;
  name: string;
  type: 'stock' | 'coin';
  searchedAt: number;
}

export function getSearchHistory(): SearchHistoryItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? (JSON.parse(data) as SearchHistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function addToSearchHistory(item: Omit<SearchHistoryItem, 'searchedAt'>): void {
  const history = getSearchHistory().filter((h) => h.symbol !== item.symbol);
  const newHistory = [{ ...item, searchedAt: Date.now() }, ...history].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
}

export function clearSearchHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function removeFromSearchHistory(symbol: string): void {
  const history = getSearchHistory().filter((h) => h.symbol !== symbol);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}
