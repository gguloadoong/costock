export function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-white animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200" />
        <div className="flex-1">
          <div className="h-4 w-24 bg-gray-200 rounded mb-1" />
          <div className="h-3 w-16 bg-gray-100 rounded" />
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-200" />
      </div>

      {/* Price Hero */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="h-10 w-40 bg-gray-200 rounded mb-2" />
        <div className="h-5 w-28 bg-gray-100 rounded" />
      </div>

      {/* Chart placeholder */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex gap-2 mb-3">
          {['1D','1W','1M','3M'].map(p => (
            <div key={p} className="h-7 w-10 bg-gray-100 rounded-full" />
          ))}
        </div>
        <div className="h-48 w-full bg-gray-100 rounded-xl" />
      </div>

      {/* Stats grid */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({length: 6}).map((_, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3">
              <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-20 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* News placeholder */}
      <div className="px-4 py-4">
        <div className="h-5 w-20 bg-gray-200 rounded mb-3" />
        {Array.from({length: 3}).map((_, i) => (
          <div key={i} className="py-3 border-b border-gray-100">
            <div className="h-4 w-full bg-gray-100 rounded mb-1" />
            <div className="h-3 w-2/3 bg-gray-100 rounded mb-2" />
            <div className="h-3 w-24 bg-gray-50 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default DetailSkeleton;
