import { ResourceMarkdown } from "@/lib/resource-markdown";
import type { ResourceCategory } from "@/lib/types/resource";

interface ResourceContentProps {
  markdown: string;
  category?: ResourceCategory;
  title?: string;
}

export function ResourceContent({
  markdown,
  category,
  title,
}: ResourceContentProps) {
  return (
    <div className="prose prose-resource max-w-none">
      <ResourceMarkdown markdown={markdown} category={category} title={title} />
    </div>
  );
}
