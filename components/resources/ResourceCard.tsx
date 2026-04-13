import Link from "next/link";
import type { Resource } from "@/lib/types/resource";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const categoryVariant: Record<
  Resource["category"],
  "blue" | "purple" | "green" | "amber" | "gray"
> = {
  event_playbook: "blue",
  training_video: "purple",
  slide_template: "green",
  social_template: "amber",
  workshop_curriculum: "purple",
  faq: "gray",
};

function categoryLabel(c: Resource["category"]): string {
  return c.replace(/_/g, " ");
}

interface ResourceCardProps {
  resource: Resource;
}

export function ResourceCard({ resource }: ResourceCardProps) {
  return (
    <Link href={`/dashboard/resources/${resource.slug}`} className="block group">
      <Card className="h-full p-4 transition-shadow group-hover:shadow-md group-hover:border-cream-300">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant={categoryVariant[resource.category]} size="sm">
            {categoryLabel(resource.category)}
          </Badge>
          <span className="text-[10px] text-ink-400 uppercase tracking-wide">
            Updated {resource.last_updated}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-ink-900 font-display group-hover:text-accent-terracotta transition-colors">
          {resource.title}
        </h3>
        <p className="mt-2 text-xs text-ink-400">Open resource</p>
      </Card>
    </Link>
  );
}
