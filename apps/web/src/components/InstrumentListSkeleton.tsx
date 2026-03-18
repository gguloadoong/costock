export function InstrumentListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-100 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          {/* 아이콘 플레이스홀더 */}
          <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
          {/* 텍스트 */}
          <div className="flex-1">
            <div className="h-4 w-20 bg-gray-200 rounded mb-1.5" />
            <div className="h-3 w-14 bg-gray-100 rounded" />
          </div>
          {/* 가격 */}
          <div className="text-right">
            <div className="h-4 w-16 bg-gray-200 rounded mb-1.5" />
            <div className="h-3 w-12 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
