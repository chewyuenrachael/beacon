import { NextResponse } from "next/server";
import { enrichProfessor } from "@/lib/professor-enrichment";
import { enrichParamsSchema } from "./schemas";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const raw = await context.params;
  const parsed = enrichParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.id?.[0] ?? "Invalid id", code: "VALIDATION" },
      { status: 400 }
    );
  }

  try {
    const professor = await enrichProfessor(parsed.data.id);
    return NextResponse.json(professor);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Enrichment failed";
    console.error("[enrich]", parsed.data.id, e);
    return NextResponse.json(
      { error: message, code: "ENRICH_FAILED" },
      { status: 500 }
    );
  }
}
