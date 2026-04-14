"use client";

import { useEffect, useState } from "react";
import type { TocHeading } from "@/lib/resource-display";

interface ResourceTocProps {
  headings: TocHeading[];
  mobile?: boolean;
}

export function ResourceToc({ headings, mobile }: ResourceTocProps) {
  const [activeSlug, setActiveSlug] = useState<string>("");

  useEffect(() => {
    const ids = headings.map((h) => h.slug);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveSlug(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  const list = (
    <nav aria-label="Table of contents">
      <ul className="space-y-1">
        {headings.map((h) => {
          const active = activeSlug === h.slug;
          return (
            <li key={h.slug}>
              <a
                href={`#${h.slug}`}
                aria-current={active ? "location" : undefined}
                className={`block text-[13px] leading-snug py-1 transition-colors border-l-2 ${
                  h.depth === 3 ? "pl-5" : "pl-3"
                } ${
                  active
                    ? "border-l-accent text-text-primary font-medium"
                    : "border-l-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  if (mobile) {
    return (
      <details className="rounded-xl bg-surface-raised p-4">
        <summary className="cursor-pointer font-mono text-xs font-medium uppercase tracking-wider text-text-muted select-none">
          Table of contents
        </summary>
        <div className="mt-3">{list}</div>
      </details>
    );
  }

  return (
    <div className="rounded-xl bg-surface-raised p-5">
      <p className="font-mono text-xs font-medium uppercase tracking-wider text-text-muted mb-4">
        Table of contents
      </p>
      {list}
    </div>
  );
}
