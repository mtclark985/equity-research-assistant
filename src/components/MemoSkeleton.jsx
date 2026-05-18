function SkeletonBlock({ titleWidth = 'w-2/3', lines = 3 }) {
  return (
    <div className="mb-10">
      <div className={`h-6 ${titleWidth} bg-stone-200 rounded animate-pulse mb-4`} />
      <div className="space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={`h-4 bg-stone-200 rounded animate-pulse ${i % 2 === 0 ? 'w-full' : 'w-5/6'}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function MemoSkeleton() {
  return (
    <div className="max-w-document mx-auto px-6 py-10">
      {/* Title */}
      <div className="mb-10">
        <div className="h-8 w-2/3 bg-stone-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-1/4 bg-stone-200 rounded animate-pulse mb-4" />
        <div className="h-6 w-24 bg-stone-200 rounded-full animate-pulse mb-4" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-stone-200 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-stone-200 rounded animate-pulse" />
          <div className="h-4 w-4/5 bg-stone-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Sections */}
      <SkeletonBlock titleWidth="w-1/3" lines={4} />
      <SkeletonBlock titleWidth="w-2/5" lines={5} />
      <SkeletonBlock titleWidth="w-1/3" lines={4} />
      <SkeletonBlock titleWidth="w-1/4" lines={3} />
      <SkeletonBlock titleWidth="w-1/5" lines={4} />
    </div>
  );
}
