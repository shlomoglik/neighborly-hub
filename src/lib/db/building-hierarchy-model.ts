export type StructureRow = {
  buildingId: string;
  buildingName: string;
  floorId: string | null;
  floorNumber: number | null;
  apartmentId: string | null;
  apartmentNumber: string | null;
  floorName?: string | null;
  floorType?: string | null;
  apartmentType?: string | null;
  apartmentPosition?: number | null;
  apartmentLinked?: boolean;
};

export function toBuildingHierarchy(rows: readonly StructureRow[]) {
  const result: {
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
  }[] = [];
  const buildingById = new Map<string, (typeof result)[number]>();
  const floorById = new Map<string, (typeof result)[number]["floors"][number]>();

  for (const row of rows) {
    let building = buildingById.get(row.buildingId);
    if (!building) {
      building = { id: row.buildingId, name: row.buildingName, floors: [] };
      buildingById.set(row.buildingId, building);
      result.push(building);
    }

    if (row.floorId === null || row.floorNumber === null) continue;
    let floor = floorById.get(row.floorId);
    if (!floor) {
      floor = {
        id: row.floorId,
        number: row.floorNumber,
        ...(row.floorName !== undefined ? { name: row.floorName } : {}),
        ...(row.floorType ? { type: row.floorType } : {}),
        apartments: [],
      };
      floorById.set(row.floorId, floor);
      building.floors.push(floor);
    }

    if (row.apartmentId !== null && row.apartmentNumber !== null) {
      floor.apartments.push({
        id: row.apartmentId,
        number: row.apartmentNumber,
        ...(row.apartmentType ? { type: row.apartmentType } : {}),
        ...(row.apartmentPosition != null ? { position: row.apartmentPosition } : {}),
        ...(row.apartmentLinked !== undefined ? { linked: row.apartmentLinked } : {}),
      });
    }
  }

  return result;
}
