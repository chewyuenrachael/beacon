import Link from "next/link";
import { notFound } from "next/navigation";
import { getResource } from "@/lib/resource-content";
import { ResourceContent } from "@/components/resources/ResourceContent";
import { ResourceViewLogger } from "@/components/resources/ResourceViewLogger";
import { ResourceToc } from "@/components/resources/ResourceToc";
import {
  stripLeadingTitle,
  estimateReadTime,
  extractHeadings,
} from "@/lib/resource-display";

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resource = await getResource(slug);
  if (!resource) notFound();

  const displayBody = stripLeadingTitle(resource.body, resource.title);
  const readTime = estimateReadTime(resource.body);
  const headings = extractHeadings(displayBody);

  return (
    <div className="relative max-w-6xl mx-auto">
      <ResourceViewLogger slug={slug} />

      {/* back link */}
      <div className="mb-8">
        <Link
          href="/dashboard/resources"
          className="text-sm text-text-muted hover:text-accent transition-colors"
        >
          &larr; All resources
        </Link>
      </div>

      <div className="xl:grid xl:grid-cols-[1fr_240px] xl:gap-12">
        {/* article column */}
        <article className="min-w-0 max-w-3xl">
          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="font-mono text-xs font-medium uppercase tracking-wider text-text-muted">
                {resource.category.replace(/_/g, " ")}
              </span>
              <span className="text-text-muted">&middot;</span>
              <span className="font-mono text-xs text-text-muted">
                {resource.last_updated}
              </span>
              <span className="text-text-muted">&middot;</span>
              <span className="font-mono text-xs text-text-muted">
                {readTime}
              </span>
            </div>
            <h1 className="text-[2rem] leading-tight font-semibold text-text-primary font-sans tracking-tight">
              {resource.title}
            </h1>
          </header>

          {/* mobile ToC */}
          <div className="xl:hidden mb-8">
            <ResourceToc headings={headings} mobile />
          </div>

          <ResourceContent
            markdown={displayBody}
            category={resource.category}
            title={resource.title}
          />
        </article>

        {/* desktop ToC rail */}
        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <ResourceToc headings={headings} />
          </div>
        </aside>
      </div>
    </div>
  );
}
