import { NextResponse } from "next/server";
import {
  generateOutreachDraft,
  mapOutreachTouchpointRow,
} from "@/lib/outreach-generator";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isProfessorLinkedTargetType } from "@/lib/types/outreach";
import { createOutreachBodySchema, listOutreachQuerySchema } from "./schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = listOutreachQuerySchema.safeParse({
    target_type: url.searchParams.get("target_type") || undefined,
    institution_id: url.searchParams.get("institution_id") || undefined,
    channel: url.searchParams.get("channel") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query",
        code: "VALIDATION",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { target_type, institution_id, channel } = parsed.data;

  let q = supabaseAdmin.from("outreach_touchpoints").select("*");
  if (target_type) q = q.eq("target_type", target_type);
  if (channel) q = q.eq("channel", channel);
  q = q.order("created_at", { ascending: false });

  const { data: rows, error } = await q;
  if (error) {
    console.error("[api/outreach GET]", error);
    return NextResponse.json(
      { error: error.message, code: "DB_ERROR" },
      { status: 500 }
    );
  }

  let list = (rows ?? []).map((r) =>
    mapOutreachTouchpointRow(r as Record<string, unknown>)
  );

  if (institution_id) {
    const profIds = list
      .filter((t) => isProfessorLinkedTargetType(t.target_type))
      .map((t) => t.target_id);
    const unique = [...new Set(profIds)];
    const instByProf = new Map<string, string>();
    if (unique.length) {
      const { data: profs } = await supabaseAdmin
        .from("professors")
        .select("id, institution_id")
        .in("id", unique);
      for (const p of profs ?? []) {
        instByProf.set(p.id as string, p.institution_id as string);
      }
    }
    list = list.filter((t) => {
      if (!isProfessorLinkedTargetType(t.target_type)) return true;
      return instByProf.get(t.target_id) === institution_id;
    });
  }

  return NextResponse.json({ data: list });
}

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

  const parsed = createOutreachBodySchema.safeParse(json);
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

  const { target_type, target_id, channel, target_name: bodyName } =
    parsed.data;

  let target_name = bodyName?.trim() ?? "";

  if (!target_name && isProfessorLinkedTargetType(target_type)) {
    const { data: prof } = await supabaseAdmin
      .from("professors")
      .select("name")
      .eq("id", target_id)
      .maybeSingle();
    target_name = (prof?.name as string | undefined)?.trim() ?? target_id;
  } else if (!target_name) {
    target_name = target_id;
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("outreach_touchpoints")
    .insert({
      target_type,
      target_id,
      target_name,
      stage: "cold",
      channel,
      subject_line: "",
      draft_content: "",
    })
    .select()
    .single();

  if (insErr || !inserted) {
    console.error("[api/outreach POST insert]", insErr);
    return NextResponse.json(
      { error: insErr?.message ?? "Insert failed", code: "DB_ERROR" },
      { status: 500 }
    );
  }

  const touchpoint = mapOutreachTouchpointRow(
    inserted as Record<string, unknown>
  );

  try {
    const draft = await generateOutreachDraft(target_type, target_id, {
      touchpointId: touchpoint.id,
    });

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("outreach_touchpoints")
      .update({
        subject_line: draft.subject_line,
        draft_content: draft.body,
      })
      .eq("id", touchpoint.id)
      .select()
      .single();

    if (updErr || !updated) {
      console.error("[api/outreach POST update]", updErr);
      return NextResponse.json(
        {
          data: touchpoint,
          draft_error: updErr?.message ?? "Update failed",
        },
        { status: 201 }
      );
    }

    return NextResponse.json({
      data: mapOutreachTouchpointRow(updated as Record<string, unknown>),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Draft failed";
    console.error("[api/outreach POST draft]", e);
    return NextResponse.json(
      { data: touchpoint, draft_error: message },
      { status: 201 }
    );
  }
}
