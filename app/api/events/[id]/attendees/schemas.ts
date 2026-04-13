import { z } from "zod";
import { eventIdParamsSchema } from "../schemas";

export const attendeesParamsSchema = eventIdParamsSchema;

export const createAttendeeBodySchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).nullable().optional(),
});
