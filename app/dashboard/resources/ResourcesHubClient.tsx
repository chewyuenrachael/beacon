"use client";

import { useMemo, useState } from "react";
import type { Resource, ResourceCategory } from "@/lib/types/resource";
import { ResourceCard } from "@/components/resources/ResourceCard";

const CATEGORY_ORDER: ResourceCategory[] = [
  "event_playbook",
  "workshop_curriculum",
  "faq",
  "training_video",
  "slide_template",
  "social_template",
];

function categoryHeading(c: ResourceCategory): string {
  return c.replace(/_/g, " ");
}

interface ResourcesHubClientProps {
  resources: Resource[];
}

export function ResourcesHubClient({ resources }: ResourcesHubClientProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return resources;
    return resources.filter((r) => r.title.toLowerCase().includes(t));
  }, [resources, query]);

  const grouped = useMemo(() => {
    const m = new Map<ResourceCategory, Resource[]>();
    for (const c of CATEGORY_ORDER) m.set(c, []);
    for (const r of filtered) {
      const list = m.get(r.category) ?? [];
      list.push(r);
      m.set(r.category, list);
    }
    return m;
  }, [filtered]);

  return (
    <div className="space-y-10 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary font-sans">
            Enablement resources
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Playbooks and FAQs for ambassadors — filesystem-backed, always
            current after deploy.
          </p>
        </div>
        <label className="block w-full sm:w-72">
          <span className="sr-only">Search by title</span>
          <input
            type="search"
            placeholder="Search by title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No resources match that title.
        </p>
      ) : (
        CATEGORY_ORDER.map((cat) => {
          const list = grouped.get(cat) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={cat}>
              <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                {categoryHeading(cat)}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((r) => (
                  <ResourceCard key={r.slug} resource={r} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
