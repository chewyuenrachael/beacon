'use client';

interface FireMention {
  id: string;
  summary: string | null;
  title: string | null;
  recommended_action: string | null;
  source: string;
  source_url: string;
  engagement_score: number | null;
}

export default function FiresTable({ fires }: { fires: FireMention[] }) {
  if (fires.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
        <p className="text-emerald-700 text-sm font-medium">
          All clear — no fires in the last 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-cream-200 rounded-lg overflow-hidden">
      <div className="grid grid-cols-[16px,1fr,280px] gap-3 border-b border-cream-200 bg-cream-100 px-5 py-2.5">
        <span />
        <span className="text-xs font-medium uppercase tracking-wider text-ink-300">Issue</span>
        <span className="text-xs font-medium uppercase tracking-wider text-ink-300">Action</span>
      </div>
      {fires.map((fire, i) => {
        const score = fire.engagement_score ?? 0;
        const dotColor = score >= 20 ? 'bg-red-500' : score >= 5 ? 'bg-amber-500' : 'bg-gray-300';
        return (
          <div
            key={fire.id}
            className={`grid grid-cols-[16px,1fr,280px] gap-3 px-5 py-4 ${
              i < fires.length - 1 ? 'border-b border-cream-200' : ''
            } hover:bg-red-50/30 transition-colors`}
          >
            <div className="flex items-start pt-1.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
            </div>
            <div className="pr-4">
              <p className="text-sm font-medium text-ink-900 leading-relaxed">
                {fire.summary ?? fire.title ?? 'Untitled'}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-ink-300 uppercase">{fire.source}</span>
                <span className="text-xs text-cream-300">&middot;</span>
                <span className="text-xs text-ink-300">
                  {score} engagements
                </span>
                <a
                  href={fire.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-terracotta hover:opacity-80"
                >
                  View source &#8599;
                </a>
              </div>
            </div>
            <div className="flex items-start">
              <p className="text-sm text-ink-500 leading-relaxed">
                {fire.recommended_action ?? 'Review urgently'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
