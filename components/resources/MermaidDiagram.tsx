"use client";

import { useEffect, useRef, useState } from "react";

let mermaidLoaded = false;

export function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      if (!mermaidLoaded) {
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          fontFamily: "var(--font-sans), system-ui, sans-serif",
        });
        mermaidLoaded = true;
      }
      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
      const { svg: rendered } = await mermaid.render(id, chart);
      if (!cancelled) setSvg(rendered);
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (!svg) {
    return (
      <div className="my-6 rounded-lg border border-border-subtle bg-surface-raised p-6 text-center text-sm text-text-muted">
        Loading diagram…
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="my-6 overflow-x-auto rounded-lg border border-border-subtle bg-surface p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
