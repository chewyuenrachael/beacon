/**
 * Demo mock of SheerID verification — no real API calls.
 * Production replaces this module with the live SheerID client.
 */

import { logObservation } from "@/lib/observations";
import type {
  SheerIDResponseCode,
  SimulatedVerificationResult,
  VerificationStatus,
} from "@/lib/types/discount";

const COUNTRY_UNSUPPORTED = new Set(
  ["india", "romania", "italy"].map((c) => c.toLowerCase())
);

const MOCK_CONFIDENCE = 0.9;

/** Fixture host suffix for tests only (institution_not_found / expired_credentials). */
const FIXTURE_HOST = "test.cursor-beacon.fixture";

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at === -1) return "";
  return email.slice(at + 1).toLowerCase().trim();
}

function isGenericConsumerDomain(domain: string): boolean {
  return (
    domain === "gmail.com" ||
    domain === "yahoo.com" ||
    domain === "yahoo.co.uk" ||
    domain.endsWith(".gmail.com") ||
    domain.endsWith(".yahoo.com")
  );
}

function hostEndsWith(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

/**
 * Infer institution slug for observation `entity_id` (no DB FK; logical anchor).
 */
export function inferInstitutionEntityId(email: string): string {
  const host = emailDomain(email);
  if (!host) return "discount-unscoped";
  if (hostEndsWith(host, "edu")) {
    const base = host.endsWith(".edu") ? host.slice(0, -4) : host;
    const segments = base.split(".").filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1]! : "discount-unscoped";
  }
  if (hostEndsWith(host, "ac.uk")) {
    const segs = host.split(".");
    return segs[0] || "discount-unscoped";
  }
  if (hostEndsWith(host, "ac.jp")) {
    const segs = host.split(".");
    return segs[0] || "discount-unscoped";
  }
  return "discount-unscoped";
}

export function simulateVerification(
  email: string,
  country: string | null | undefined
): SimulatedVerificationResult {
  const trimmedEmail = email.trim();
  const domain = emailDomain(trimmedEmail);

  if (domain === FIXTURE_HOST) {
    const local = trimmedEmail.split("@")[0]?.toLowerCase() ?? "";
    if (local === "expired") {
      return { sheerid_response_code: "expired_credentials", status: "pending" };
    }
    if (local === "unknown") {
      return { sheerid_response_code: "institution_not_found", status: "pending" };
    }
  }

  const c = country?.trim().toLowerCase() ?? "";
  if (c && COUNTRY_UNSUPPORTED.has(c)) {
    return { sheerid_response_code: "country_unsupported", status: "pending" };
  }

  if (hostEndsWith(domain, "ac.uk") || hostEndsWith(domain, "ac.jp")) {
    return { sheerid_response_code: "success", status: "manual_review" };
  }

  if (hostEndsWith(domain, "edu")) {
    return { sheerid_response_code: "success", status: "approved" };
  }

  if (isGenericConsumerDomain(domain)) {
    return { sheerid_response_code: "email_domain_mismatch", status: "pending" };
  }

  return { sheerid_response_code: "institution_not_found", status: "pending" };
}

export async function logVerificationAttemptedObservation(params: {
  verification_attempt_id: string;
  email: string;
  country: string | null | undefined;
  claimed_institution: string | null | undefined;
  sheerid_response_code: SheerIDResponseCode;
  status: VerificationStatus;
}): Promise<void> {
  const entity_id = inferInstitutionEntityId(params.email);
  await logObservation({
    entity_type: "institution",
    entity_id,
    observation_type: "verification_attempted",
    payload: {
      verification_attempt_id: params.verification_attempt_id,
      email: params.email,
      country: params.country ?? null,
      claimed_institution: params.claimed_institution ?? null,
      sheerid_response_code: params.sheerid_response_code,
      status: params.status,
      sheerid_request_id: `mock-${params.verification_attempt_id}`,
    },
    source: "sheerid",
    confidence: MOCK_CONFIDENCE,
  });
}
