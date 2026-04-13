import Link from "next/link";
import { notFound } from "next/navigation";
import { getResource } from "@/lib/resource-content";
import { ResourceContent } from "@/components/resources/ResourceContent";
import { ResourceViewLogger } from "@/components/resources/ResourceViewLogger";
import { Badge } from "@/components/ui/Badge";

const categoryVariant = {
  event_playbook: "blue" as const,
  training_video: "purple" as const,
  slide_template: "green" as const,
  social_template: "amber" as const,
  workshop_curriculum: "purple" as const,
  faq: "gray" as const,
};

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resource = await getResource(slug);
  if (!resource) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <ResourceViewLogger slug={slug} />
      <div>
        <Link
          href="/dashboard/resources"
          className="text-sm text-ink-500 hover:text-accent-terracotta transition-colors"
        >
          ← All resources
        </Link>
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={categoryVariant[resource.category]} size="md">
            {resource.category.replace(/_/g, " ")}
          </Badge>
          <span className="text-xs text-ink-400 uppercase tracking-wide">
            Last updated {resource.last_updated}
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-ink-900 font-display">
          {resource.title}
        </h1>
      </header>

      <ResourceContent markdown={resource.body} />
    </div>
  );
}
