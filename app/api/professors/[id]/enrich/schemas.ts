import { z } from "zod";

export const enrichParamsSchema = z.object({
  id: z.string().min(1, "Professor id required"),
});
