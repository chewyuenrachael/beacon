import { z } from "zod";

export const applicationDataSchema = z.object({
  why_cursor: z.string(),
  past_community_work: z.string(),
  proposed_events: z.string(),
  expected_reach: z.string(),
});

export const createAmbassadorBodySchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  email: z.string().trim().email("valid email required"),
  github_username: z.string().trim().optional(),
  institution_id: z.string().trim().min(1, "institution_id is required"),
  application_data: applicationDataSchema,
});

export const ambassadorStageSchema = z.enum([
  "applied",
  "under_review",
  "accepted",
  "rejected",
  "onboarding",
  "active",
  "slowing",
  "inactive",
]);

export const advanceAmbassadorBodySchema = z.object({
  new_stage: ambassadorStageSchema,
});

export const patchAmbassadorBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    github_username: z.string().trim().nullable().optional(),
    /** ISO-like timestamp string (e.g. from `datetime-local` or server) */
    last_active_at: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field is required",
  });

export const ambassadorIdParamsSchema = z.object({
  id: z.string().uuid("Invalid ambassador id"),
});
