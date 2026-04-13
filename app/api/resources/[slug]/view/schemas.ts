import { z } from "zod";

export const createResourceViewBodySchema = z.object({
  viewer_id: z.string().min(1).max(256).optional(),
});

export const updateResourceViewBodySchema = z.object({
  view_id: z.string().uuid(),
  time_on_page_seconds: z.number().int().nonnegative(),
});

export type CreateResourceViewBody = z.infer<typeof createResourceViewBodySchema>;
export type UpdateResourceViewBody = z.infer<typeof updateResourceViewBodySchema>;

export function parseResourceViewPostBody(
  raw: unknown
):
  | { kind: "create"; data: CreateResourceViewBody }
  | { kind: "update"; data: UpdateResourceViewBody }
  | { kind: "invalid"; message: string } {
  if (!raw || typeof raw !== "object") {
    return { kind: "invalid", message: "Expected JSON object" };
  }
  const o = raw as Record<string, unknown>;
  if ("view_id" in o && o.view_id != null) {
    const u = updateResourceViewBodySchema.safeParse(raw);
    if (!u.success) {
      return {
        kind: "invalid",
        message: u.error.errors.map((e) => e.message).join("; "),
      };
    }
    return { kind: "update", data: u.data };
  }
  const c = createResourceViewBodySchema.safeParse(raw);
  if (!c.success) {
    return {
      kind: "invalid",
      message: c.error.errors.map((e) => e.message).join("; "),
    };
  }
  return { kind: "create", data: c.data };
}
