import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  listResourcesFromDisk,
  parseResourceFile,
} from "@/lib/resource-content-core";
import { ResourceMarkdown } from "@/lib/resource-markdown";
import { parseResourceViewPostBody } from "@/app/api/resources/[slug]/view/schemas";
import {
  stripLeadingTitle,
  estimateReadTime,
  extractHeadings,
} from "@/lib/resource-display";

const EXPECTED_SLUGS = [
  "cafe-cursor-playbook",
  "hackathon-sponsorship-playbook",
  "workshop-playbook",
  "lab-demo-playbook",
  "professor-talk-playbook",
  "faq-nightly-builds",
  "faq-academic-integrity",
  "faq-international-access",
];

describe("listResourcesFromDisk", () => {
  it("loads all eight catalog slugs from the filesystem", async () => {
    const resources = await listResourcesFromDisk();
    const slugs = resources.map((r) => r.slug).sort();
    expect(slugs).toEqual([...EXPECTED_SLUGS].sort());
  });

  it("assigns expected categories for playbooks and FAQs", async () => {
    const resources = await listResourcesFromDisk();
    const bySlug = Object.fromEntries(resources.map((r) => [r.slug, r]));
    expect(bySlug["workshop-playbook"]?.category).toBe("workshop_curriculum");
    expect(bySlug["faq-nightly-builds"]?.category).toBe("faq");
    expect(bySlug["cafe-cursor-playbook"]?.category).toBe("event_playbook");
  });
});

describe("parseResourceFile", () => {
  it("parses minimal frontmatter and body", () => {
    const raw = `---
title: Test Doc
category: faq
last_updated: 2026-01-15
---

# Hello

Body **here**.
`;
    const p = parseResourceFile(raw);
    expect(p.title).toBe("Test Doc");
    expect(p.category).toBe("faq");
    expect(p.last_updated).toBe("2026-01-15");
    expect(p.body).toContain("# Hello");
    expect(p.body).toContain("Body **here**.");
  });
});

describe("ResourceMarkdown", () => {
  it("renders markdown with section wrappers and heading ids", () => {
    const md = "## Section One\n\nBody text.\n\n### Sub heading\n\nMore text.\n";
    const html = renderToStaticMarkup(
      React.createElement(ResourceMarkdown, { markdown: md })
    );
    expect(html).toContain("Section One");
    expect(html).toContain("<section");
    expect(html).toContain('id="section-one"');
  });

  it("renders tables from GFM markdown", () => {
    const md = "|h1|h2|\n|-|-|\n|1|2|\n";
    const html = renderToStaticMarkup(
      React.createElement(ResourceMarkdown, { markdown: md })
    );
    expect(html).toContain("<table");
    expect(html).toContain("<td");
  });

  it("renders blockquotes as styled callout panels", () => {
    const md = "> Important note here.\n";
    const html = renderToStaticMarkup(
      React.createElement(ResourceMarkdown, { markdown: md })
    );
    expect(html).toContain("border-l-2");
    expect(html).toContain("bg-surface-raised");
    expect(html).toContain("Important note here.");
  });
});

describe("stripLeadingTitle", () => {
  it("removes h1 matching the resource title", () => {
    const md = "# My Resource Title\n\nBody text.";
    const result = stripLeadingTitle(md, "My Resource Title");
    expect(result).toBe("Body text.");
    expect(result).not.toContain("# My Resource Title");
  });

  it("keeps h1 when it does not match the title", () => {
    const md = "# Different Title\n\nBody text.";
    const result = stripLeadingTitle(md, "My Resource Title");
    expect(result).toContain("# Different Title");
  });

  it("handles em-dash normalization", () => {
    const md = "# FAQ \u2014 Academic Integrity\n\nBody.";
    const result = stripLeadingTitle(md, "FAQ \u2014 Academic Integrity");
    expect(result).toBe("Body.");
  });
});

describe("estimateReadTime", () => {
  it("returns at least 1 min for short content", () => {
    expect(estimateReadTime("Hello world")).toBe("1 min read");
  });

  it("calculates read time based on word count", () => {
    const words = new Array(450).fill("word").join(" ");
    expect(estimateReadTime(words)).toBe("2 min read");
  });
});

describe("extractHeadings", () => {
  it("extracts h2 and h3 headings with slugs", () => {
    const md =
      "## First Section\n\nText.\n\n### Sub Section\n\nMore.\n\n## Second Section\n";
    const headings = extractHeadings(md);
    expect(headings).toEqual([
      { depth: 2, text: "First Section", slug: "first-section" },
      { depth: 3, text: "Sub Section", slug: "sub-section" },
      { depth: 2, text: "Second Section", slug: "second-section" },
    ]);
  });

  it("strips bold markers from heading text", () => {
    const md = "## **Bold** heading\n";
    const headings = extractHeadings(md);
    expect(headings[0].text).toBe("Bold heading");
  });
});

describe("parseResourceViewPostBody", () => {
  it("accepts valid create payload", () => {
    const r = parseResourceViewPostBody({});
    expect(r.kind).toBe("create");
    if (r.kind === "create") expect(r.data.viewer_id).toBeUndefined();

    const r2 = parseResourceViewPostBody({ viewer_id: "amb-123" });
    expect(r2.kind).toBe("create");
    if (r2.kind === "create") expect(r2.data.viewer_id).toBe("amb-123");
  });

  it("accepts valid update payload", () => {
    const r = parseResourceViewPostBody({
      view_id: "550e8400-e29b-41d4-a716-446655440000",
      time_on_page_seconds: 42,
    });
    expect(r.kind).toBe("update");
    if (r.kind === "update") {
      expect(r.data.view_id).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(r.data.time_on_page_seconds).toBe(42);
    }
  });

  it("rejects invalid payloads", () => {
    expect(parseResourceViewPostBody(null).kind).toBe("invalid");
    expect(parseResourceViewPostBody("x").kind).toBe("invalid");
    expect(
      parseResourceViewPostBody({
        view_id: "not-a-uuid",
        time_on_page_seconds: 1,
      }).kind
    ).toBe("invalid");
    expect(
      parseResourceViewPostBody({
        view_id: "550e8400-e29b-41d4-a716-446655440000",
        time_on_page_seconds: -1,
      }).kind
    ).toBe("invalid");
  });
});
