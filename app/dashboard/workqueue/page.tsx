import Link from "next/link";
import { generateWorkqueue } from "@/lib/workqueue";
import { WorkqueueItem } from "@/components/intelligence/WorkqueueItem";

export default async function WorkqueuePage() {
  const items = await generateWorkqueue();

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-2">
      <header className="space-y-1">
        <p className="text-xs text-text-tertiary uppercase tracking-wide">
          <Link href="/dashboard" className="hover:text-text-secondary">
            Campus intelligence
          </Link>
        </p>
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Monday workqueue
        </h1>
        <p className="text-sm text-text-secondary">
          Top ten ranked actions synthesized from ambassadors, discount
          verification, faculty signal, events, and coverage gaps.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No actions at the moment — seed data or run enrichment to populate
          signals.
        </p>
      ) : (
        <ol className="space-y-4">
          {items.map((item, i) => (
            <li key={item.id}>
              <WorkqueueItem rank={i + 1} item={item} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
