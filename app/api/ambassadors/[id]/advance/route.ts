import { NextResponse } from "next/server";
import { advanceAmbassadorStage } from "@/lib/ambassador-pipeline";
import {
  advanceAmbassadorBodySchema,
  ambassadorIdParamsSchema,
} from "../../schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const rawParams = await context.params;
  const parsedId = ambassadorIdParamsSchema.safeParse(rawParams);
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

  const parsedBody = advanceAmbassadorBodySchema.safeParse(json);
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

  const newStage = parsedBody.data.new_stage;

  try {
    const ambassador = await advanceAmbassadorStage(
      parsedId.data.id,
      newStage
    );
    return NextResponse.json(ambassador);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Advance failed";
    if (message.includes("Illegal stage transition")) {
      return NextResponse.json(
        { error: message, code: "ILLEGAL_TRANSITION" },
        { status: 400 }
      );
    }
    if (message === "Ambassador not found") {
      return NextResponse.json(
        { error: message, code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    console.error("[api/ambassadors/[id]/advance POST]", e);
    return NextResponse.json(
      { error: message, code: "ADVANCE_FAILED" },
      { status: 500 }
    );
  }
}
