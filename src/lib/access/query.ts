import { z } from "zod";
import { MAX_DIRECTORY_PAGE } from "./contracts";
export const directoryQuerySchema = z.object({
  query: z.string().trim().max(100).default(""),
  buildingId: z.union([z.string().uuid(), z.literal("")]).default(""),
  page: z.coerce.number().int().min(1).max(MAX_DIRECTORY_PAGE).default(1),
});
