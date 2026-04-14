import Link from "next/link";
import type { Resource } from "@/lib/types/resource";
import { Card } from "@/components/ui/Card";

function categoryLabel(c: Resource["category"]): string {
  return c.replace(/_/g, " ");
}

interface ResourceCardProps {
  resource: Resource;
}

export function ResourceCard({ resource }: ResourceCardProps) {
  return (
    <Link
      href={`/dashboard/resources/${resource.slug}`}
      className="block group"
    >
      <Card className="h-full p-5 transition-all group-hover:shadow-md group-hover:border-border-strong/10">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-text-muted bg-surface-raised px-1.5 py-0.5 rounded">
            {categoryLabel(resource.category)}
          </span>
          <span className="font-mono text-[10px] text-text-muted">
            {resource.last_updated}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors leading-snug">
          {resource.title}
        </h3>
        <p className="mt-3 text-xs text-text-muted">
          Open resource &rarr;
        </p>
      </Card>
    </Link>
  );
}
