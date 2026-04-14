import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resourceSlugExists } from "@/lib/resource-content";
import { parseResourceViewPostBody } from "./schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  if (!slug?.trim()) {
    return NextResponse.json(
      { error: "Missing slug", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const known = await resourceSlugExists(slug);
  if (!known) {
    return NextResponse.json(
      { error: "Unknown resource", code: "NOT_FOUND" },
      { status: 404 }
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

  const parsed = parseResourceViewPostBody(json);
  if (parsed.kind === "invalid") {
    return NextResponse.json(
      { error: parsed.message || "Validation failed", code: "VALIDATION" },
      { status: 400 }
    );
  }

  if (parsed.kind === "update") {
    const { view_id, time_on_page_seconds } = parsed.data;
    const { data, error } = await supabaseAdmin
      .from("resource_views")
      .update({ time_on_page_seconds })
      .eq("id", view_id)
      .eq("resource_slug", slug)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[resource_views update]", slug, view_id, error);
      return NextResponse.json(
        { error: error.message, code: "DB_ERROR" },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "View not found for this resource", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  const viewer_id = parsed.data.viewer_id?.trim() || "anonymous";
  const { data, error } = await supabaseAdmin
    .from("resource_views")
    .insert({
      resource_slug: slug,
      viewer_id,
      time_on_page_seconds: null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[resource_views insert]", slug, error);
    return NextResponse.json(
      { error: error.message, code: "DB_ERROR" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id as string });
}
