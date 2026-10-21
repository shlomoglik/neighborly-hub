import { z } from "zod";
import { projectSetupInput, type ProjectSetupInput } from "@/lib/db/project-setup-input";
import { unitType } from "@/lib/db/project-structure-input";

const draftUnit = z.object({
  id: z.string(),
  number: z.string().max(200),
  type: unitType,
  linked: z.boolean().optional(),
});
const draftFloor = z.object({
  id: z.string(),
  number: z.number().int(),
  name: z.string().max(200),
  type: unitType,
  apartments: z.array(draftUnit).max(200),
});
export const draftBuildings = z
  .array(
    z.object({
      id: z.string(),
      name: z.string().max(200),
      address: z.string().max(500),
      floors: z.array(draftFloor).min(1).max(200),
    }),
  )
  .max(100);
export type DraftBuilding = z.infer<typeof draftBuildings>[number];
export type DraftFloor = DraftBuilding["floors"][number];
export type DraftUnit = DraftFloor["apartments"][number];
export type UnitType = z.infer<typeof unitType>;
export const unitTypes = unitType.options;
export const draftId = () => crypto.randomUUID();
export const newFloor = (number: number): DraftFloor => ({
  id: draftId(),
  number,
  name: "",
  type: "residential",
  apartments: [],
});
export const newBuilding = (): DraftBuilding => ({
  id: draftId(),
  name: "",
  address: "",
  floors: [newFloor(0)],
});
/** Materialize visible defaults in draft state, including restored older drafts. */
export function withDefaultNames(
  buildings: DraftBuilding[],
  buildingLabel: string,
  floorLabel: string,
): DraftBuilding[] {
  const key = (name: string) => name.trim().normalize("NFKC").toLowerCase();
  const used = new Set(buildings.filter((b) => b.name.trim()).map((b) => key(b.name)));
  let next = 1;
  return buildings.map((b) => {
    let name = b.name;
    if (!name.trim()) {
      while (used.has(key(`${buildingLabel} ${next}`))) next++;
      name = `${buildingLabel} ${next++}`;
      used.add(key(name));
    }
    return {
      ...b,
      name,
      floors: b.floors.map((f) => ({
        ...f,
        name: f.name.trim() ? f.name : `${floorLabel} ${f.number}`,
      })),
    };
  });
}
export function draftPayload(
  name: string,
  city: string,
  buildings: DraftBuilding[],
): ProjectSetupInput {
  return {
    name,
    city,
    buildings: buildings.map((b) => ({
      name: b.name,
      ...(b.address ? { address: b.address } : {}),
      floors: b.floors.length,
      unitsPerFloor: 1,
      structure: b.floors.map((f) => ({
        number: f.number,
        ...(f.name.trim() ? { name: f.name } : {}),
        type: f.type,
        apartments: f.apartments.map((u) => ({ number: u.number, type: u.type })),
      })),
    })),
  };
}
export const validateDraft = (buildings: DraftBuilding[]) =>
  projectSetupInput.safeParse(draftPayload("Draft", "Draft", buildings));
export function nextUnit(building: DraftBuilding, floor: DraftFloor): DraftUnit {
  const used = new Set(
    building.floors.flatMap((f) =>
      f.apartments.map((u) => u.number.normalize("NFKC").toLowerCase()),
    ),
  );
  let n = 1;
  while (used.has(String(n))) n++;
  return { id: draftId(), number: String(n), type: floor.type };
}
/** Name never follows position. Moving keeps identity, type and linked status intact. */
export function moveUnit(
  building: DraftBuilding,
  unitId: string,
  targetFloor: string,
  beforeId?: string,
): DraftBuilding {
  const unit = building.floors.flatMap((f) => f.apartments).find((u) => u.id === unitId);
  const target = building.floors.find((f) => f.id === targetFloor);
  if (
    !unit ||
    !target ||
    beforeId === unitId ||
    (target.apartments.length >= 200 && !target.apartments.some((u) => u.id === unitId))
  )
    return building;
  return {
    ...building,
    floors: building.floors.map((f) => {
      const units = f.apartments.filter((u) => u.id !== unitId);
      if (f.id === targetFloor) {
        const index = beforeId ? units.findIndex((u) => u.id === beforeId) : -1;
        units.splice(index < 0 ? units.length : index, 0, unit);
      }
      return { ...f, apartments: units };
    }),
  };
}
/** Preserve linked units and allocate names unique across the whole building. */
export function copyFloor(
  building: DraftBuilding,
  sourceId: string,
  targets: string[],
): DraftBuilding {
  const source = building.floors.find((f) => f.id === sourceId);
  if (!source) return building;
  const result = {
    ...building,
    floors: building.floors.map((f) =>
      targets.includes(f.id) && f.id !== sourceId
        ? { ...f, apartments: f.apartments.filter((u) => u.linked), type: source.type }
        : f,
    ),
  };
  for (const id of targets.filter((id) => id !== sourceId)) {
    const target = result.floors.find((f) => f.id === id);
    if (!target) continue;
    for (const unit of source.apartments) {
      if (target.apartments.length >= 200) break;
      target.apartments.push({ ...nextUnit(result, target), type: unit.type });
    }
  }
  return result;
}
/** Insert levels without silently changing existing business labels. */
export function duplicateFloors(
  building: DraftBuilding,
  sourceId: string,
  count: number,
): DraftBuilding {
  const source = building.floors.find((f) => f.id === sourceId);
  if (!source || count < 1 || count > 200 || building.floors.length + count > 200) return building;
  let result: DraftBuilding = {
    ...building,
    floors: building.floors.map((f) =>
      f.number > source.number ? { ...f, number: f.number + count } : f,
    ),
  };
  for (let i = 1; i <= count; i++) {
    const floor = { ...newFloor(source.number + i), type: source.type };
    result = { ...result, floors: [...result.floors, floor] };
    result = copyFloor(result, sourceId, [floor.id]);
  }
  return result;
}

/** A setup template never carries another building's IDs, address or relationships. */
export function copyBuildingLayout(source: DraftBuilding, target: DraftBuilding): DraftBuilding {
  if (target.floors.some((f) => f.apartments.some((u) => u.linked))) return target;
  return {
    ...target,
    floors: source.floors.map((f) => ({
      ...f,
      id: draftId(),
      apartments: f.apartments.map((u) => ({ id: draftId(), number: u.number, type: u.type })),
    })),
  };
}
