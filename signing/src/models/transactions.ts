import { z } from "zod";

const validator = z.object({
  to: z.string(),
  from: z.string(),
  data: z.string().optional(),
  value: z.string().optional(),
});

export { validator };
