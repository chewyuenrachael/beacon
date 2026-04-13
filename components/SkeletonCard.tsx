export default function SkeletonCard() {
  return (
    <div className="bg-white border border-cream-200 rounded-lg p-4 animate-beacon">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-14 bg-cream-200 rounded-full" />
        <div className="h-4 w-10 bg-cream-100 rounded" />
        <div className="h-4 w-16 bg-cream-100 rounded ml-auto" />
      </div>
      <div className="h-5 w-3/4 bg-cream-200 rounded mb-2" />
      <div className="flex items-center gap-3 mb-2">
        <div className="h-4 w-20 bg-cream-100 rounded" />
        <div className="flex gap-1">
          <div className="h-3 w-3 bg-cream-200 rounded-full" />
          <div className="h-3 w-3 bg-cream-200 rounded-full" />
          <div className="h-3 w-3 bg-cream-200 rounded-full" />
        </div>
        <div className="flex gap-1">
          <div className="h-3 w-3 bg-cream-200 rounded-full" />
          <div className="h-3 w-3 bg-cream-200 rounded-full" />
          <div className="h-3 w-3 bg-cream-200 rounded-full" />
        </div>
      </div>
      <div className="h-4 w-2/3 bg-cream-100 rounded" />
    </div>
  );
}
