import "server-only";
import { createHash } from "node:crypto";
import type { ManagementBuilding } from "./management-contracts";
export function buildingVersion(building: ManagementBuilding) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: building.id,
        name: building.name,
        address: building.address ?? null,
        floors: [...building.floors]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((f) => ({
            id: f.id,
            number: f.number,
            apartments: [...f.apartments].sort((a, b) => a.id.localeCompare(b.id)),
          })),
      }),
    )
    .digest("hex");
}
