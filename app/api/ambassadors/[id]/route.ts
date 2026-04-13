import { NextResponse } from "next/server";
import { mapAmbassadorRow } from "@/lib/ambassador-pipeline";
import { logObservation } from "@/lib/observations";
import { supabaseAdmin } from "@/lib/supabase";
import {
  ambassadorIdParamsSchema,
  patchAmbassadorBodySchema,
} from "../schemas";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const raw = await context.params;
  const parsedId = ambassadorIdParamsSchema.safeParse(raw);
  if (!parsedId.success) {
    return NextResponse.json(
      {
        error: parsedId.error.flatten().fieldErrors.id?.[0] ?? "Invalid id",
        code: "VALIDATION",
      },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("ambassadors")
    .select("*")
    .eq("id", parsedId.data.id)
    .maybeSingle();

  if (error) {
    console.error("[api/ambassadors/[id] GET]", error);
    return NextResponse.json(
      { error: error.message, code: "FETCH_FAILED" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Ambassador not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json(mapAmbassadorRow(data as Record<string, unknown>));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const raw = await context.params;
  const parsedId = ambassadorIdParamsSchema.safeParse(raw);
  if (!parsedId.success) {
    return NextResponse.json(
      {
        error: parsedId.error.flatten().fieldErrors.id?.[0] ?? "Invalid id",
        code: "VALIDATION",
      },
      { status: 400 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const parsedBody = patchAmbassadorBodySchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: "VALIDATION",
        details: parsedBody.error.flatten(),
      },
      { status: 400 }
    );
  }

  const updates = parsedBody.data;
  const id = parsedId.data.id;

  try {
    const { data: existing, error: loadErr } = await supabaseAdmin
      .from("ambassadors")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (loadErr) throw loadErr;
    if (!existing) {
      return NextResponse.json(
        { error: "Ambassador not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    await logObservation({
      entity_type: "ambassador",
      entity_id: id,
      observation_type: "ambassador_enriched",
      payload: { updates },
      source: "manual",
      confidence: 1.0,
    });

    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.github_username !== undefined) {
      patch.github_username = updates.github_username;
    }
    if (updates.last_active_at !== undefined) {
      patch.last_active_at = updates.last_active_at;
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("ambassadors")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (updErr) throw updErr;

    return NextResponse.json(
      mapAmbassadorRow(updated as Record<string, unknown>)
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    console.error("[api/ambassadors/[id] PATCH]", e);
    return NextResponse.json(
      { error: message, code: "UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
