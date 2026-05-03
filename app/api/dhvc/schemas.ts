// @ownership dhvc-module

import { z } from "zod";

import { DHVC_REVIEW_STAGES, DHVC_SOURCES } from "@/lib/types";

export const dhvcIdParamsSchema = z.object({
  id: z.string().uuid("Invalid candidate id"),
});

export const dhvcSourceSchema = z.enum(DHVC_SOURCES);
export const dhvcReviewStageSchema = z.enum(DHVC_REVIEW_STAGES);

export const dhvcSourceUrlSchema = z.object({
  url: z.string().url(),
  source: dhvcSourceSchema,
  observed_at: z.string(),
  description: z.string().min(1, "description is required"),
});

export const dhvcCandidateDraftSchema = z
  .object({
    institution_id: z.string().trim().min(1, "institution_id is required"),
    name: z.string().trim().min(1, "name is required"),
    email: z.string().trim().email().optional(),
    github_username: z.string().trim().min(1).optional(),
    twitter_handle: z.string().trim().min(1).optional(),
    primary_source: dhvcSourceSchema,
    source_urls: z.array(dhvcSourceUrlSchema).default([]),
    graduation_year: z.number().int().min(1900).max(2100).optional(),
    major: z.string().trim().min(1).optional(),
  })
  .refine(
    (d) =>
      Boolean(d.email) ||
      Boolean(d.github_username) ||
      Boolean(d.twitter_handle),
    {
      message:
        "Provide at least one of: email, github_username, twitter_handle",
      path: ["email"],
    }
  );

export const listCandidatesQuerySchema = z.object({
  review_stage: dhvcReviewStageSchema.optional(),
  institution_id: z.string().trim().min(1).optional(),
  primary_source: dhvcSourceSchema.optional(),
  min_score: z.coerce.number().min(0).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().trim().min(1).optional(),
});

export const patchCandidateBodySchema = z
  .object({
    notes: z.string().nullable().optional(),
    email: z.string().trim().email().nullable().optional(),
    graduation_year: z.number().int().min(1900).max(2100).nullable().optional(),
    major: z.string().trim().min(1).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one editable field is required",
  });

export const acceptCandidateBodySchema = z
  .object({
    reviewed_by: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional(),
    create_outreach_touchpoint: z.boolean().optional(),
  })
  .partial()
  .default({});

export const rejectCandidateBodySchema = z
  .object({
    reviewed_by: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(1).optional(),
  })
  .partial()
  .default({});

export const ingestBodySchema = z
  .object({})
  .passthrough()
  .optional()
  .default({});

export type DhvcSourceUrlInput = z.infer<typeof dhvcSourceUrlSchema>;
export type DhvcCandidateDraftInput = z.infer<typeof dhvcCandidateDraftSchema>;
export type ListCandidatesQuery = z.infer<typeof listCandidatesQuerySchema>;
export type PatchCandidateBody = z.infer<typeof patchCandidateBodySchema>;
export type AcceptCandidateBody = z.infer<typeof acceptCandidateBodySchema>;
export type RejectCandidateBody = z.infer<typeof rejectCandidateBodySchema>;
