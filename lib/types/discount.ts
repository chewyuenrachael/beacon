/**
 * @ownership Discount Provisioning agent
 * @see `.cursor/rules/data-contracts.md` — Type file ownership
 */

export type VerificationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "manual_review";

export type SheerIDResponseCode =
  | "success"
  | "country_unsupported"
  | "institution_not_found"
  | "email_domain_mismatch"
  | "expired_credentials";

/** Row shape for `verification_attempts` (SCHEMA.md). */
export interface VerificationAttempt {
  id: string;
  email: string;
  country: string | null;
  claimed_institution: string | null;
  sheerid_response_code: SheerIDResponseCode | string;
  status: VerificationStatus | string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
}

/** Result of mock SheerID before persistence. */
export interface SimulatedVerificationResult {
  sheerid_response_code: SheerIDResponseCode;
  status: VerificationStatus;
}
