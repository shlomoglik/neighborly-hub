import type { ManagementHierarchy } from "@/lib/access/management-contracts";
import type { StructureEditTarget } from "@/lib/access/structure-management-contracts";
/** Presentation guard only; every mutation is independently authorized on the server. */
export function isStructureTargetAvailable(data: ManagementHierarchy, target: StructureEditTarget) {
  if (target.entity === "building" && target.mode === "create") return data.canAddBuilding;
  return data.buildings.some((building) => {
    if (target.entity === "building" && target.mode === "update") return building.id === target.id;
    if (target.entity === "floor" && target.mode === "create")
      return building.id === target.buildingId;
    return building.floors.some((floor) => {
      if (target.entity === "floor" && target.mode === "update") return floor.id === target.id;
      if (target.entity === "apartment" && target.mode === "create")
        return floor.id === target.floorId;
      return (
        target.entity === "apartment" &&
        target.mode === "update" &&
        floor.apartments.some((a) => a.id === target.id)
      );
    });
  });
}
