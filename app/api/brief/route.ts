import { NextResponse } from "next/server";
import { generateDailyBrief } from "@/lib/brief";

export async function POST() {
  try {
    const brief = await generateDailyBrief();
    return NextResponse.json({ success: true, brief });
  } catch (error) {
    console.error("POST /api/brief error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Brief generation failed" },
      { status: 500 }
    );
  }
}
