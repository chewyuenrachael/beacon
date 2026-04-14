import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { scoreAmbassador } from "@/lib/ambassador-scoring";
import { logObservation } from "@/lib/observations";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createAmbassadorBodySchema } from "./schemas";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const parsed = createAmbassadorBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: "VALIDATION",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const id = randomUUID();

  try {
    const { data: inst, error: instErr } = await supabaseAdmin
      .from("institutions")
      .select("id")
      .eq("id", body.institution_id)
      .maybeSingle();

    if (instErr) throw instErr;
    if (!inst) {
      return NextResponse.json(
        { error: "Unknown institution_id", code: "NOT_FOUND" },
        { status: 400 }
      );
    }

    await logObservation({
      entity_type: "ambassador",
      entity_id: id,
      observation_type: "ambassador_applied",
      payload: {
        name: body.name,
        email: body.email,
        institution_id: body.institution_id,
        application_data: body.application_data,
      },
      source: "manual",
      confidence: 1.0,
    });

    const score = await scoreAmbassador(body.application_data, id);

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("ambassadors")
      .insert({
        id,
        institution_id: body.institution_id,
        email: body.email,
        name: body.name,
        github_username: body.github_username?.trim() || null,
        application_data: body.application_data,
        score,
        stage: "applied",
        health_score: 0,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    const { error: actErr } = await supabaseAdmin
      .from("ambassador_activity")
      .insert({
        ambassador_id: id,
        activity_type: "application_submitted",
        payload: { source: "manual_form" },
      });

    if (actErr) throw actErr;

    return NextResponse.json(inserted, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    console.error("[api/ambassadors POST]", e);
    return NextResponse.json(
      { error: message, code: "CREATE_FAILED" },
      { status: 500 }
    );
  }
}
