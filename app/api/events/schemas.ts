import { z } from "zod";
import { EVENT_STATUSES, EVENT_TYPES } from "@/lib/types/event";

const eventTypeZ = z.enum(EVENT_TYPES as unknown as [string, ...string[]]);
const eventStatusZ = z.enum(EVENT_STATUSES as unknown as [string, ...string[]]);

export const listEventsQuerySchema = z.object({
  institution_id: z.string().min(1).optional(),
  status: eventStatusZ.optional(),
});

export const createEventBodySchema = z.object({
  institution_id: z.string().min(1),
  ambassador_id: z.string().uuid().nullable().optional(),
  event_type: eventTypeZ,
  title: z.string().min(1).max(500),
  scheduled_at: z.string().max(40).nullable().optional(),
  status: eventStatusZ.optional(),
  notes: z.string().max(10_000).nullable().optional(),
});

export type CreateEventBody = z.infer<typeof createEventBodySchema>;
