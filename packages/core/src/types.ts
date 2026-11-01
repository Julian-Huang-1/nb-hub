import { z } from "zod";

export const healthSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("nb-hub-api"),
});

export type Health = z.infer<typeof healthSchema>;
