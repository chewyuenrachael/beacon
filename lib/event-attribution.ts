/**
 * Post-event activation attribution (populate event_attendees.activated_at).
 * Telemetry and SheerID-style matching are not wired in this slice — hooks only.
 */

export interface AttributionInput {
  attendeeEmail: string;
  eventId: string;
  /** e.g. first Cursor usage timestamp from telemetry */
  activatedAt?: string;
}

export interface AttributionResult {
  /** When true, caller should set activated_at on the attendee row */
  shouldMarkActivated: boolean;
  activatedAt: string | null;
}

/**
 * Placeholder: returns shouldMarkActivated when activatedAt is provided.
 * Future: match email against verified student / telemetry events.
 */
export function evaluateActivationAttribution(
  input: AttributionInput
): AttributionResult {
  if (!input.activatedAt?.trim()) {
    return { shouldMarkActivated: false, activatedAt: null };
  }
  return {
    shouldMarkActivated: true,
    activatedAt: input.activatedAt.trim(),
  };
}
