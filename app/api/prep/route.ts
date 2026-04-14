import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generatePrepDocument } from "@/lib/prep";
import type { PrepRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const required: (keyof PrepRequest)[] = [
      "journalist_name",
      "outlet",
      "topic",
      "engagement_date",
      "engagement_type",
      "spokesperson",
    ];

    for (const field of required) {
      if (!body[field] || typeof body[field] !== "string") {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    const prepRequest: PrepRequest = {
      journalist_name: body.journalist_name,
      outlet: body.outlet,
      topic: body.topic,
      engagement_date: body.engagement_date,
      engagement_type: body.engagement_type,
      spokesperson: body.spokesperson,
      notes: body.notes || undefined,
    };

    const document = await generatePrepDocument(prepRequest);

    return NextResponse.json({ document, request: prepRequest });
  } catch (error) {
    console.error("POST /api/prep error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prep generation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("prep_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/prep error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch prep documents" },
      { status: 500 }
    );
  }
}
