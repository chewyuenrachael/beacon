import { z } from "zod";
import { EVENT_STATUSES, EVENT_TYPES } from "@/lib/types/event";

const eventTypeZ = z.enum(EVENT_TYPES as unknown as [string, ...string[]]);
const eventStatusZ = z.enum(EVENT_STATUSES as unknown as [string, ...string[]]);

export const eventIdParamsSchema = z.object({
  id: z.string().uuid("Invalid event id"),
});

export const patchEventBodySchema = z
  .object({
    ambassador_id: z.string().uuid().nullable().optional(),
    event_type: eventTypeZ.optional(),
    title: z.string().min(1).max(500).optional(),
    scheduled_at: z.string().max(40).nullable().optional(),
    status: eventStatusZ.optional(),
    notes: z.string().max(10_000).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field required",
  });
