import { NextResponse } from "next/server";
import { computeHealthScore } from "@/lib/ambassador-health";
import { mapAmbassadorRow } from "@/lib/ambassador-pipeline";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ambassadorIdParamsSchema } from "../../schemas";

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
    const health = await computeHealthScore(id);
    const { data: row, error } = await supabaseAdmin
      .from("ambassadors")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return NextResponse.json(
        { error: "Ambassador not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      health_score: health,
      ambassador: mapAmbassadorRow(row as Record<string, unknown>),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Health compute failed";
    if (message === "Ambassador not found") {
      return NextResponse.json(
        { error: message, code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    console.error("[api/ambassadors/[id]/health POST]", e);
    return NextResponse.json(
      { error: message, code: "HEALTH_FAILED" },
      { status: 500 }
    );
  }
}
