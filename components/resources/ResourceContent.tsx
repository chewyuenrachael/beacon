import { ResourceMarkdown } from "@/lib/resource-markdown";

interface ResourceContentProps {
  markdown: string;
}

export function ResourceContent({ markdown }: ResourceContentProps) {
  return (
    <div className="resource-prose prose prose-sm max-w-none text-ink-900 prose-headings:font-display prose-headings:text-ink-900 prose-a:text-accent-terracotta prose-code:text-ink-800 prose-pre:bg-cream-100 prose-pre:border prose-pre:border-cream-200">
      <ResourceMarkdown markdown={markdown} />
    </div>
  );
}
