import { z } from "zod";

export const outreachTargetTypeSchema = z.enum([
  "professor",
  "student_org",
  "ta",
  "department_chair",
  "hackathon_organizer",
]);

export const outreachStageSchema = z.enum([
  "cold",
  "contacted",
  "meeting_booked",
  "demo_held",
  "partnership_active",
  "dead",
]);

export const outreachChannelSchema = z.enum(["email", "meeting", "event"]);

export const createOutreachBodySchema = z.object({
  target_type: outreachTargetTypeSchema,
  target_id: z.string().trim().min(1),
  channel: outreachChannelSchema,
  target_name: z.string().trim().min(1).optional(),
});

export const patchOutreachBodySchema = z
  .object({
    stage: outreachStageSchema.optional(),
    notes: z.string().nullable().optional(),
    sent_at: z.string().nullable().optional(),
    reply_detected_at: z.string().nullable().optional(),
    subject_line: z.string().optional(),
    draft_content: z.string().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field is required",
  });

export const outreachIdParamsSchema = z.object({
  id: z.string().uuid("Invalid outreach id"),
});

export const listOutreachQuerySchema = z.object({
  target_type: outreachTargetTypeSchema.optional(),
  institution_id: z.string().trim().optional(),
  channel: outreachChannelSchema.optional(),
});
