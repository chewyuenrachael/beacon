import type { PrepDocument, PrepRequest } from "@/lib/types";

export async function generatePrepDocument(
  request: PrepRequest
): Promise<PrepDocument> {
  return {
    id: "prep_stub",
    created_at: new Date().toISOString(),
    request,
    document: "",
    mention_count: 0,
  };
}
