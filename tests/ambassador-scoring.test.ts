import { describe, expect, it } from "vitest";
import {
  computeAmbassadorScoreFromApplicationData,
} from "@/lib/ambassador-scoring";
import {
  computeHealthScoreFromSignals,
} from "@/lib/ambassador-health";
import {
  isLegalStageTransition,
} from "@/lib/ambassador-pipeline";
import type { AmbassadorApplicationData } from "@/lib/types";

describe("computeAmbassadorScoreFromApplicationData", () => {
  it("scores all four dimensions between 0 and 100", () => {
    const data: AmbassadorApplicationData = {
      why_cursor:
        "I work on LLMs, code generation, and Cursor-based teaching in a top CS program.",
      past_community_work:
        "Led the ACM chapter as president; organized hackathons and mentored contributors.",
      proposed_events:
        "Workshop series, hackathon sponsorship, and monthly Cafe Cursor meetups.",
      expected_reach: "350 students",
    };
    const s = computeAmbassadorScoreFromApplicationData(data);
    expect(s.research_alignment).toBeGreaterThanOrEqual(0);
    expect(s.research_alignment).toBeLessThanOrEqual(100);
    expect(s.student_reach).toBeGreaterThanOrEqual(0);
    expect(s.student_reach).toBeLessThanOrEqual(100);
    expect(s.adoption_signal).toBeGreaterThanOrEqual(0);
    expect(s.adoption_signal).toBeLessThanOrEqual(100);
    expect(s.network_influence).toBeGreaterThanOrEqual(0);
    expect(s.network_influence).toBeLessThanOrEqual(100);
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
  });

  it("produces lower totals for sparse applications", () => {
    const weak: AmbassadorApplicationData = {
      why_cursor: "idk",
      past_community_work: "",
      proposed_events: "",
      expected_reach: "",
    };
    const strong: AmbassadorApplicationData = {
      why_cursor:
        "Deep research on large language models, Cursor, and developer productivity in software engineering courses.",
      past_community_work:
        "Organized regional hackathons and led the AI club as president for two years.",
      proposed_events:
        "Weekly workshops, sponsored hackathon, lab demos, and professor talks each term.",
      expected_reach: "800",
    };
    const ws = computeAmbassadorScoreFromApplicationData(weak);
    const ss = computeAmbassadorScoreFromApplicationData(strong);
    expect(ss.total).toBeGreaterThan(ws.total);
  });

  it("weights dimensions into total (rough sanity check)", () => {
    const data: AmbassadorApplicationData = {
      why_cursor: "x".repeat(120),
      past_community_work: "x".repeat(120),
      proposed_events: "x".repeat(120),
      expected_reach: "100",
    };
    const s = computeAmbassadorScoreFromApplicationData(data);
    const manual =
      0.3 * s.research_alignment +
      0.25 * s.student_reach +
      0.25 * s.adoption_signal +
      0.2 * s.network_influence;
    expect(s.total).toBe(Math.round(manual));
  });
});

describe("isLegalStageTransition", () => {
  it("rejects skipping pipeline stages", () => {
    expect(isLegalStageTransition("applied", "active")).toBe(false);
    expect(isLegalStageTransition("applied", "under_review")).toBe(true);
  });

  it("allows review outcomes", () => {
    expect(isLegalStageTransition("under_review", "accepted")).toBe(true);
    expect(isLegalStageTransition("under_review", "rejected")).toBe(true);
  });

  it("blocks transitions from terminal stages", () => {
    expect(isLegalStageTransition("rejected", "applied")).toBe(false);
    expect(isLegalStageTransition("inactive", "active")).toBe(false);
  });
});

describe("computeHealthScoreFromSignals", () => {
  it("scores a new ambassador with no last_active lower than an engaged one", () => {
    const engaged = computeHealthScoreFromSignals({
      observationsLast90Days: 8,
      eventsLast90Days: 2,
      daysSinceLastActive: 4,
    });
    const fresh = computeHealthScoreFromSignals({
      observationsLast90Days: 2,
      eventsLast90Days: 0,
      daysSinceLastActive: null,
    });
    expect(engaged).toBeGreaterThan(fresh);
  });

  it("penalizes long-inactive ambassadors", () => {
    const recent = computeHealthScoreFromSignals({
      observationsLast90Days: 5,
      eventsLast90Days: 0,
      daysSinceLastActive: 5,
    });
    const stale = computeHealthScoreFromSignals({
      observationsLast90Days: 1,
      eventsLast90Days: 0,
      daysSinceLastActive: 120,
    });
    expect(recent).toBeGreaterThan(stale);
    expect(stale).toBeLessThan(50);
  });

  it("returns an integer 0-100", () => {
    const h = computeHealthScoreFromSignals({
      observationsLast90Days: 3,
      eventsLast90Days: 1,
      daysSinceLastActive: 20,
    });
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(100);
  });
});
