import { describe, expect, it } from "vitest";
import {
  rankWorkqueueCandidates,
} from "@/lib/workqueue";
import type { WorkqueueCandidate } from "@/lib/types/intelligence";

function c(
  partial: Partial<WorkqueueCandidate> & Pick<WorkqueueCandidate, "id" | "priority_score">
): WorkqueueCandidate {
  return {
    title: partial.title ?? "T",
    description: partial.description ?? "D",
    action_url: partial.action_url ?? "/dashboard",
    action_label: partial.action_label ?? "Go",
    source_feature: partial.source_feature ?? "coverage",
    mark_complete: partial.mark_complete ?? {
      entity_type: "institution",
      entity_id: "mit",
    },
    ...partial,
  };
}

describe("rankWorkqueueCandidates", () => {
  it("orders by priority_score descending", () => {
    const ranked = rankWorkqueueCandidates(
      [
        c({ id: "a", priority_score: 10 }),
        c({ id: "b", priority_score: 50 }),
        c({ id: "c", priority_score: 30 }),
      ],
      10
    );
    expect(ranked.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties using source_feature order then id", () => {
    const ranked = rankWorkqueueCandidates(
      [
        c({
          id: "z-discount",
          priority_score: 50,
          source_feature: "discount",
        }),
        c({
          id: "m-ambassador",
          priority_score: 50,
          source_feature: "ambassador",
        }),
      ],
      10
    );
    expect(ranked[0]!.id).toBe("z-discount");
    expect(ranked[1]!.id).toBe("m-ambassador");
  });

  it("uses id when score and source tie", () => {
    const ranked = rankWorkqueueCandidates(
      [
        c({ id: "b", priority_score: 1, source_feature: "events" }),
        c({ id: "a", priority_score: 1, source_feature: "events" }),
      ],
      10
    );
    expect(ranked.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("returns at most 10 when more candidates exist", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      c({ id: `x-${i}`, priority_score: i })
    );
    const ranked = rankWorkqueueCandidates(many, 10);
    expect(ranked).toHaveLength(10);
    expect(ranked[0]!.id).toBe("x-24");
  });

  it("returns fewer than 10 when fewer candidates exist", () => {
    const ranked = rankWorkqueueCandidates(
      [c({ id: "only", priority_score: 1 })],
      10
    );
    expect(ranked).toHaveLength(1);
  });

  it("returns empty when no candidates", () => {
    expect(rankWorkqueueCandidates([], 10)).toEqual([]);
  });
});
