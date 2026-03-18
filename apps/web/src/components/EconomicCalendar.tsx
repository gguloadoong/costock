'use client';

interface EconomicEvent {
  date: string;      // MM/DD
  time?: string;     // HH:MM
  title: string;
  importance: 'high' | 'medium' | 'low';
  country: 'KR' | 'US' | 'CN';
}

const EVENTS_2026_03: EconomicEvent[] = [
  { date: '03/20', title: '한국은행 기준금리 결정', importance: 'high', country: 'KR' },
  { date: '03/21', time: '21:30', title: '미국 실업수당 청구건수', importance: 'medium', country: 'US' },
  { date: '03/25', title: '한국 수출입 동향', importance: 'medium', country: 'KR' },
  { date: '03/27', time: '22:30', title: '미국 GDP 최종치', importance: 'high', country: 'US' },
  { date: '03/28', time: '22:30', title: '미국 PCE 물가지수', importance: 'high', country: 'US' },
  { date: '04/01', title: '미국 ISM 제조업지수', importance: 'medium', country: 'US' },
  { date: '04/04', time: '21:30', title: '미국 비농업고용', importance: 'high', country: 'US' },
  { date: '04/10', time: '21:30', title: '미국 CPI', importance: 'high', country: 'US' },
];

const IMPORTANCE_COLOR = {
  high: 'bg-red-100 text-red-600',
  medium: 'bg-yellow-100 text-yellow-600',
  low: 'bg-gray-100 text-gray-500',
};

const COUNTRY_FLAG = { KR: '🇰🇷', US: '🇺🇸', CN: '🇨🇳' };

export function EconomicCalendar() {
  return (
    <div className="px-4 py-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">경제 일정</h3>
      <div className="space-y-2">
        {EVENTS_2026_03.map((event, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50">
            <div className="text-xs text-gray-400 w-12 flex-shrink-0">
              {event.date}
              {event.time && <div>{event.time}</div>}
            </div>
            <span className="text-base flex-shrink-0">{COUNTRY_FLAG[event.country]}</span>
            <span className="text-sm text-gray-700 flex-1">{event.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${IMPORTANCE_COLOR[event.importance]}`}>
              {event.importance === 'high' ? '중요' : event.importance === 'medium' ? '보통' : '낮음'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
