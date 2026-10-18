import { z } from "zod";
import { MAX_DIRECTORY_PAGE, type DirectoryResident } from "./contracts";
export type GlobalSearchResident = DirectoryResident & { projectId: string; projectName: string };
export type GlobalSearchPage = {
  residents: GlobalSearchResident[];
  page: number;
  hasNext: boolean;
};
export const globalSearchQuerySchema = z.object({
  query: z.string().trim().min(2).max(100),
  page: z.coerce.number().int().min(1).max(MAX_DIRECTORY_PAGE).default(1),
});
