/** Public DTOs contain only server-authorized values. */
export type DirectoryProject = {
  id: string;
  name: string;
  buildings: { id: string; name: string }[];
};
export type DirectoryResident = {
  personId: string;
  name: string;
  householdId: string;
  householdName: string;
  buildingId: string;
  buildingName: string;
  apartment: string;
  contacts: { kind: "phone" | "email"; value: string; label: string | null }[];
};
export type DirectoryPage = { residents: DirectoryResident[]; page: number; hasNext: boolean };
export type DirectoryQuery = { query: string; buildingId: string; page: number };
export const DIRECTORY_PAGE_SIZE = 20;

export const MAX_DIRECTORY_PAGE = 10000;
