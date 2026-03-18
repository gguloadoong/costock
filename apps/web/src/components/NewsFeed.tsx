'use client';

import { useState, useEffect } from 'react';

interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  symbol?: string;
  category: '시황' | '기업' | '산업' | '글로벌';
}

// Mock 뉴스 데이터 (Phase 0)
const MOCK_NEWS: NewsItem[] = [
  { id: '1', title: '삼성전자, 2분기 실적 시장 예상치 상회... HBM 수요 급증', source: '한국경제', publishedAt: '2시간 전', url: '#', symbol: '005930', category: '기업' },
  { id: '2', title: '코스피 2,800선 회복... 외국인 순매수 전환', source: '매일경제', publishedAt: '3시간 전', url: '#', category: '시황' },
  { id: '3', title: '비트코인 9만 달러 돌파, 기관 매수세 지속', source: '코인데스크', publishedAt: '4시간 전', url: '#', symbol: 'BTC', category: '글로벌' },
  { id: '4', title: '2차전지 섹터 강세... POSCO홀딩스·에코프로 동반 상승', source: '연합뉴스', publishedAt: '5시간 전', url: '#', category: '산업' },
  { id: '5', title: '미 연준 금리 동결 시사... 원/달러 환율 하락', source: '서울경제', publishedAt: '6시간 전', url: '#', category: '글로벌' },
  { id: '6', title: 'NAVER, AI 검색 시장 점유율 확대... 광고 매출 급증', source: '이데일리', publishedAt: '7시간 전', url: '#', symbol: '035420', category: '기업' },
  { id: '7', title: '현대차 인도 법인 IPO 성공... 시가총액 30조원', source: 'KBS', publishedAt: '8시간 전', url: '#', symbol: '005380', category: '기업' },
  { id: '8', title: '이더리움 ETF 자금 유입 사상 최대', source: '블록미디어', publishedAt: '10시간 전', url: '#', symbol: 'ETH', category: '글로벌' },
];

const CATEGORY_COLORS: Record<NewsItem['category'], string> = {
  '시황': 'bg-blue-50 text-blue-600',
  '기업': 'bg-purple-50 text-purple-600',
  '산업': 'bg-green-50 text-green-600',
  '글로벌': 'bg-orange-50 text-orange-600',
};

interface NewsFeedProps {
  symbol?: string;  // 특정 종목 뉴스만 표시할 경우
  limit?: number;
}

export function NewsFeed({ symbol, limit = 10 }: NewsFeedProps) {
  const [filter, setFilter] = useState<'전체' | NewsItem['category']>('전체');
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    // Phase 0: mock 데이터 사용
    let items = symbol
      ? MOCK_NEWS.filter(n => !n.symbol || n.symbol === symbol)
      : MOCK_NEWS;
    if (filter !== '전체') items = items.filter(n => n.category === filter);
    setNews(items.slice(0, limit));
  }, [symbol, filter, limit]);

  const categories: Array<'전체' | NewsItem['category']> = ['전체', '시황', '기업', '산업', '글로벌'];

  return (
    <div>
      {/* 카테고리 필터 (symbol 없을 때만) */}
      {!symbol && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                filter === cat
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 뉴스 목록 */}
      <div className="divide-y divide-gray-100">
        {news.map(item => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 px-4 py-3 active:bg-gray-50 transition-colors"
          >
            {/* 이미지 플레이스홀더 */}
            <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
              <span className="text-2xl">{item.category === '시황' ? '📊' : item.category === '기업' ? '🏢' : item.category === '산업' ? '🏭' : '🌍'}</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2 mb-1">
                {item.title}
              </p>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${CATEGORY_COLORS[item.category]}`}>
                  {item.category}
                </span>
                <span className="text-xs text-gray-400">{item.source}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">{item.publishedAt}</span>
              </div>
            </div>

            <span className="flex-shrink-0 text-gray-300 text-xs mt-1">↗</span>
          </a>
        ))}
      </div>

      {news.length === 0 && (
        <div className="py-8 text-center text-sm text-gray-400">관련 뉴스가 없습니다</div>
      )}
    </div>
  );
}
