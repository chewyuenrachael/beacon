import { describe, expect, it } from "vitest";
import { simulateVerification } from "@/lib/sheerid-mock";

describe("simulateVerification", () => {
  it("returns success for .edu when country is not blocked", () => {
    const r = simulateVerification("student@stanford.edu", "United States");
    expect(r.sheerid_response_code).toBe("success");
    expect(r.status).toBe("approved");
  });

  it("returns country_unsupported for India regardless of domain", () => {
    const r = simulateVerification("student@stanford.edu", "India");
    expect(r.sheerid_response_code).toBe("country_unsupported");
    expect(r.status).toBe("pending");
  });

  it("treats multiple calls with the same email independently (no in-memory dedupe)", () => {
    const email = "repeat@stanford.edu";
    const a = simulateVerification(email, "United States");
    const b = simulateVerification(email, "United States");
    expect(a).toEqual(b);
    const c = simulateVerification(email, "India");
    expect(c.sheerid_response_code).toBe("country_unsupported");
    expect(a.sheerid_response_code).toBe("success");
  });

  it("fixture host supports expired_credentials and institution_not_found", () => {
    expect(
      simulateVerification("expired@test.cursor-beacon.fixture", "United States")
        .sheerid_response_code
    ).toBe("expired_credentials");
    expect(
      simulateVerification("unknown@test.cursor-beacon.fixture", "United States")
        .sheerid_response_code
    ).toBe("institution_not_found");
  });
});
