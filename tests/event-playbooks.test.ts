import { describe, expect, it } from "vitest";
import {
  getPlaybookForEventType,
  listEventTypesWithPlaybooks,
} from "@/lib/event-playbooks";
import { EVENT_TYPES, type EventType } from "@/lib/types/event";

describe("event-playbooks", () => {
  it("returns a non-empty checklist for every EventType", () => {
    for (const type of EVENT_TYPES) {
      const steps = getPlaybookForEventType(type);
      expect(steps.length).toBeGreaterThan(0);
    }
  });

  it("preserves stable ordering (snapshot of first step ids)", () => {
    const firstIds = EVENT_TYPES.map(
      (type) => getPlaybookForEventType(type)[0]?.id
    );
    expect(firstIds).toEqual([
      "venue",
      "contract",
      "outline",
      "pi_alignment",
      "abstract",
    ]);
  });

  it("has no duplicate step ids within each playbook", () => {
    for (const type of EVENT_TYPES) {
      const steps = getPlaybookForEventType(type);
      const ids = steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("listEventTypesWithPlaybooks matches EventType keys", () => {
    const listed = listEventTypesWithPlaybooks().slice().sort();
    const expected = (EVENT_TYPES as readonly EventType[]).slice().sort();
    expect(listed).toEqual(expected);
  });
});
