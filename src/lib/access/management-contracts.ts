import { z } from "zod";
import { DIRECTORY_PAGE_SIZE, MAX_DIRECTORY_PAGE } from "./contracts";
export const MANAGEMENT_PAGE_SIZE = DIRECTORY_PAGE_SIZE;
export const managementPageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_DIRECTORY_PAGE)
  .default(1);
export type ManagementProject = { id: string; name: string; city: string | null };
export type ManagementProjects = {
  projects: ManagementProject[];
  page: number;
  hasNext: boolean;
  canCreateProject: boolean;
  hasManagementAccess: boolean;
};
export type ManagementBuilding = {
  address?: string | null;
  version?: string;
  id: string;
  name: string;
  floors: {
    id: string;
    number: number;
    name?: string | null;
    type?: string;
    apartments: {
      id: string;
      number: string;
      type?: string;
      position?: number;
      linked?: boolean;
    }[];
  }[];
};
export type ManagementHierarchy = ManagementProject & {
  canAddBuilding: boolean;
  buildings: ManagementBuilding[];
  counts: { buildings: number; floors: number; apartments: number };
};
export const managementHref = (projectId: string) =>
  `/manage?project=${encodeURIComponent(projectId)}`;
