import { NextResponse } from "next/server";
import { updateEngagementSnapshots } from "@/lib/velocity";

export async function POST() {
  try {
    await updateEngagementSnapshots();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/velocity error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Velocity update failed" },
      { status: 500 }
    );
  }
}
