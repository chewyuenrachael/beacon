import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  listResourcesFromDisk,
  parseResourceFile,
} from "@/lib/resource-content-core";
import { ResourceMarkdown } from "@/lib/resource-markdown";
import { parseResourceViewPostBody } from "@/app/api/resources/[slug]/view/schemas";

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
  it("renders markdown without throwing", () => {
    const md = "# Title\n\n- a\n- **b**\n\n|h1|h2|\n|-|-|\n|1|2|\n";
    const html = renderToStaticMarkup(
      React.createElement(ResourceMarkdown, { markdown: md })
    );
    expect(html.length).toBeGreaterThan(20);
    expect(html).toContain("Title");
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
