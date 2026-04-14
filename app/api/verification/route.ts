import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  inferInstitutionEntityId,
  logVerificationAttemptedObservation,
  simulateVerification,
} from "@/lib/sheerid-mock";
import { createVerificationBodySchema } from "./schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const parsed = createVerificationBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid body";
    return NextResponse.json({ error: msg, code: "VALIDATION" }, { status: 400 });
  }

  const { email, country, claimed_institution } = parsed.data;
  const sim = simulateVerification(email, country ?? undefined);

  try {
    const { data: row, error } = await supabaseAdmin
      .from("verification_attempts")
      .insert({
        email,
        country: country ?? null,
        claimed_institution: claimed_institution ?? null,
        sheerid_response_code: sim.sheerid_response_code,
        status: sim.status,
      })
      .select()
      .single();

    if (error) throw error;
    if (!row) throw new Error("Insert returned no row");

    const id = row.id as string;
    await logVerificationAttemptedObservation({
      verification_attempt_id: id,
      email,
      country: country ?? null,
      claimed_institution: claimed_institution ?? null,
      sheerid_response_code: sim.sheerid_response_code,
      status: sim.status,
    });

    return NextResponse.json(row);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verification failed";
    console.error("[verification POST]", e);
    return NextResponse.json(
      { error: message, code: "VERIFICATION_FAILED" },
      { status: 500 }
    );
  }
}
