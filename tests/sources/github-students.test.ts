import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { discoverFromGitHubStudents } from "@/lib/sources/github-students";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("discoverFromGitHubStudents", () => {
  const originalFetch = globalThis.fetch;
  const observedAt = "2026-05-03T00:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(observedAt));
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns a draft when profile, commit volume, and popular-repo signals pass", async () => {
    let searchCalls = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.includes("/search/users")) {
        searchCalls++;
        if (searchCalls === 1) {
          return jsonResponse({ items: [{ login: "alice" }] });
        }
        return jsonResponse({ items: [] });
      }

      if (url.endsWith("/users/alice") && !url.includes("/events")) {
        return jsonResponse({
          login: "alice",
          name: "Alice Student",
          bio: "HCI @ MIT",
          location: "MIT",
          email: null,
        });
      }

      if (url.includes("/users/alice/events")) {
        const events = Array.from({ length: 11 }, (_, i) => ({
          type: "PushEvent",
          created_at: `2026-04-${String(i + 18).padStart(2, "0")}T10:00:00Z`,
          repo: { name: `org/repo-${i}`, id: 1000 + i },
          payload: { size: 5, push_id: i },
        }));
        return jsonResponse(events);
      }

      if (url.includes("/repos/org/repo-")) {
        const isHit = url.includes("/repos/org/repo-0");
        return jsonResponse({
          full_name: isHit ? "org/repo-0" : `org/repo-fallback`,
          stargazers_count: isHit ? 150 : 5,
        });
      }

      return jsonResponse({}, 404);
    }) as typeof fetch;

    const p = discoverFromGitHubStudents();
    await vi.runAllTimersAsync();
    const drafts = await p;

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      institution_id: "mit",
      name: "Alice Student",
      github_username: "alice",
      primary_source: "github",
    });
    expect(drafts[0].source_urls[0].url).toBe("https://github.com/alice");
    expect(drafts[0].source_urls.some((u) => u.url.includes("org/repo-0"))).toBe(true);
  });

  it("skips users without enough commits in the last 12 months", async () => {
    let searchCalls = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.includes("/search/users")) {
        searchCalls++;
        if (searchCalls === 1) {
          return jsonResponse({ items: [{ login: "bob" }] });
        }
        return jsonResponse({ items: [] });
      }

      if (url.endsWith("/users/bob") && !url.includes("/events")) {
        return jsonResponse({
          login: "bob",
          name: "Bob",
          bio: null,
          location: "MIT",
          email: null,
        });
      }

      if (url.includes("/users/bob/events")) {
        return jsonResponse([
          {
            type: "PushEvent",
            created_at: "2026-04-20T10:00:00Z",
            repo: { name: "org/small", id: 1 },
            payload: { size: 3, push_id: 1 },
          },
        ]);
      }

      return jsonResponse({}, 404);
    }) as typeof fetch;

    const p = discoverFromGitHubStudents();
    await vi.runAllTimersAsync();
    const drafts = await p;

    expect(drafts).toHaveLength(0);
  });

  it("skips users who never touch a 100+ star repo in-window", async () => {
    let searchCalls = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.includes("/search/users")) {
        searchCalls++;
        if (searchCalls === 1) {
          return jsonResponse({ items: [{ login: "carol" }] });
        }
        return jsonResponse({ items: [] });
      }

      if (url.endsWith("/users/carol") && !url.includes("/events")) {
        return jsonResponse({
          login: "carol",
          name: "Carol",
          bio: null,
          location: "MIT",
          email: null,
        });
      }

      if (url.includes("/users/carol/events")) {
        return jsonResponse([
          {
            type: "PushEvent",
            created_at: "2026-04-20T10:00:00Z",
            repo: { name: "org/tiny", id: 1 },
            payload: { size: 50, push_id: 1 },
          },
        ]);
      }

      if (url.includes("/repos/org/tiny")) {
        return jsonResponse({ stargazers_count: 12 });
      }

      return jsonResponse({}, 404);
    }) as typeof fetch;

    const p = discoverFromGitHubStudents();
    await vi.runAllTimersAsync();
    const drafts = await p;

    expect(drafts).toHaveLength(0);
  });

  it("retries search on 429 with exponential-style backoff", async () => {
    let searchAttempts = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.includes("/search/users")) {
        searchAttempts++;
        if (searchAttempts === 1) {
          return new Response(null, {
            status: 429,
            headers: { "retry-after": "0" },
          });
        }
        return jsonResponse({ items: [] });
      }

      return jsonResponse({}, 404);
    }) as typeof fetch;

    const p = discoverFromGitHubStudents();
    await vi.runAllTimersAsync();
    await p;

    expect(searchAttempts).toBeGreaterThanOrEqual(2);
  });
});
