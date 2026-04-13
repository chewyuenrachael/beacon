import { z } from "zod";

export const createVerificationBodySchema = z.object({
  email: z.string().email(),
  country: z.string().optional().nullable(),
  claimed_institution: z.string().optional().nullable(),
});

export const approveVerificationBodySchema = z.object({
  institution_id: z.string().min(1, "institution_id required"),
  reviewed_by: z.string().optional().nullable(),
});

export const rejectVerificationBodySchema = z.object({
  reason: z.string().min(1, "reason is required"),
  reviewed_by: z.string().optional().nullable(),
});

export const verificationIdParamsSchema = z.object({
  id: z.string().uuid(),
});
