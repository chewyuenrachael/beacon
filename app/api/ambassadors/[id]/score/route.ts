import { NextResponse } from "next/server";
import { mapAmbassadorRow } from "@/lib/ambassador-pipeline";
import type { AmbassadorApplicationData } from "@/lib/types";
import { scoreAmbassador } from "@/lib/ambassador-scoring";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ambassadorIdParamsSchema } from "../../schemas";

function toApplicationData(
  raw: Record<string, unknown>
): AmbassadorApplicationData {
  return {
    why_cursor: String(raw.why_cursor ?? ""),
    past_community_work: String(raw.past_community_work ?? ""),
    proposed_events: String(raw.proposed_events ?? ""),
    expected_reach: String(raw.expected_reach ?? ""),
  };
}

export async function POST(
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

  const id = parsedId.data.id;

  try {
    const { data: row, error: loadErr } = await supabaseAdmin
      .from("ambassadors")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (loadErr) throw loadErr;
    if (!row) {
      return NextResponse.json(
        { error: "Ambassador not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const appData = toApplicationData(
      (row as { application_data?: Record<string, unknown> }).application_data ??
        {}
    );

    const score = await scoreAmbassador(appData, id);

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("ambassadors")
      .update({ score })
      .eq("id", id)
      .select()
      .single();

    if (updErr) throw updErr;

    return NextResponse.json(mapAmbassadorRow(updated as Record<string, unknown>));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Rescore failed";
    console.error("[api/ambassadors/[id]/score POST]", e);
    return NextResponse.json(
      { error: message, code: "SCORE_FAILED" },
      { status: 500 }
    );
  }
}
