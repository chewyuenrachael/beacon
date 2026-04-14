import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkSectionize from "remark-sectionize";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { visit } from "unist-util-visit";
import type { ComponentPropsWithoutRef } from "react";
import type { ResourceCategory } from "@/lib/types/resource";

/* ---------- remark plugin: directive → callout nodes ---------- */

function remarkCallouts() {
  return (tree: any) => {
    visit(tree, (node: any) => {
      if (
        node.type === "containerDirective" &&
        ["note", "tip", "warning"].includes(node.name)
      ) {
        const data = node.data || (node.data = {});
        data.hName = "div";
        data.hProperties = {
          className: `callout callout-${node.name}`,
          "data-callout": node.name,
        };
      }
    });
  };
}

/* ---------- component overrides ---------- */

const CALLOUT_STYLES: Record<string, { border: string; label: string }> = {
  note: { border: "border-l-[var(--border-strong)]", label: "" },
  tip: { border: "border-l-[var(--accent)]", label: "Tip" },
  warning: { border: "border-l-[#C2410C]", label: "Warning" },
};

function Callout({
  variant,
  children,
}: {
  variant: string;
  children: React.ReactNode;
}) {
  const s = CALLOUT_STYLES[variant] ?? CALLOUT_STYLES.note;
  return (
    <div
      className={`my-6 rounded-md border-l-2 ${s.border} bg-surface-raised px-5 py-4`}
    >
      {s.label && (
        <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-text-muted">
          {s.label}
        </p>
      )}
      {children}
    </div>
  );
}

function makeComponents(category?: ResourceCategory) {
  const isFaq = category === "faq";

  const components: Record<string, React.FC<any>> = {
    section: ({ children, ...rest }: ComponentPropsWithoutRef<"section">) => (
      <section className="resource-section" {...rest}>
        {children}
      </section>
    ),

    h2: ({ children, id, ...rest }: ComponentPropsWithoutRef<"h2">) => (
      <h2
        id={id}
        className={`scroll-mt-24 ${isFaq ? "text-[1.35rem] font-semibold text-text-primary" : ""}`}
        {...rest}
      >
        {children}
        {id && (
          <a href={`#${id}`} className="heading-anchor" aria-hidden="true">
            #
          </a>
        )}
      </h2>
    ),

    h3: ({ children, id, ...rest }: ComponentPropsWithoutRef<"h3">) => (
      <h3 id={id} className="scroll-mt-24" {...rest}>
        {children}
        {id && (
          <a href={`#${id}`} className="heading-anchor" aria-hidden="true">
            #
          </a>
        )}
      </h3>
    ),

    table: ({ children, ...rest }: ComponentPropsWithoutRef<"table">) => (
      <div className="my-6 overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full" {...rest}>
          {children}
        </table>
      </div>
    ),

    blockquote: ({
      children,
      ...rest
    }: ComponentPropsWithoutRef<"blockquote">) => (
      <Callout variant="note">{children}</Callout>
    ),

    div: ({
      children,
      className,
      ...rest
    }: ComponentPropsWithoutRef<"div"> & { "data-callout"?: string }) => {
      const calloutType = (rest as any)["data-callout"];
      if (calloutType && CALLOUT_STYLES[calloutType]) {
        return <Callout variant={calloutType}>{children}</Callout>;
      }
      return (
        <div className={className} {...rest}>
          {children}
        </div>
      );
    },

    a: ({ children, href, ...rest }: ComponentPropsWithoutRef<"a">) => (
      <a
        href={href}
        {...rest}
        className="underline underline-offset-[3px] decoration-border-subtle hover:text-accent hover:decoration-accent transition-colors"
      >
        {children}
      </a>
    ),
  };

  return components;
}

/* ---------- public component ---------- */

interface ResourceMarkdownProps {
  markdown: string;
  category?: ResourceCategory;
  title?: string;
}

export function ResourceMarkdown({
  markdown,
  category,
}: ResourceMarkdownProps) {
  const components = makeComponents(category);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkDirective, remarkCallouts, remarkSectionize]}
      rehypePlugins={[
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          { behavior: "append", properties: { className: "heading-anchor" } },
        ],
      ]}
      components={components}
    >
      {markdown}
    </ReactMarkdown>
  );
}
