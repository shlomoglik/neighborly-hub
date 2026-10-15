import { describe, expect, it } from "vitest";
import { createStructure, deleteStructure, updateStructure } from "./structure-input";

const id = "550e8400-e29b-41d4-a716-446655440000";

describe("structure input", () => {
  it("validates all create entity types", () => {
    expect(createStructure.parse({ entity: "project", name: " North " }).name).toBe("North");
    const building = createStructure.safeParse({ entity: "building", name: "A", projectId: id });
    expect(building.success).toBe(true);
    const floor = createStructure.safeParse({ entity: "floor", buildingId: id, number: 0 });
    expect(floor.success).toBe(true);
    const apartment = createStructure.safeParse({
      entity: "apartment",
      buildingId: id,
      floorId: id,
      number: "12A",
    });
    expect(apartment.success).toBe(true);
  });

  it("rejects invalid references, empty names, and fractional floor numbers", () => {
    const invalidBuilding = createStructure.safeParse({
      entity: "building",
      projectId: "invalid",
      name: "A",
    });
    expect(invalidBuilding.success).toBe(false);
    expect(createStructure.safeParse({ entity: "project", name: "  " }).success).toBe(false);
    const invalidFloor = createStructure.safeParse({ entity: "floor", buildingId: id, number: 1.5 });
    expect(invalidFloor.success).toBe(false);
  });

  it("requires valid ids for update and delete", () => {
    expect(updateStructure.safeParse({ entity: "apartment", id, number: "2" }).success).toBe(true);
    expect(deleteStructure.safeParse({ entity: "project", id: "invalid" }).success).toBe(false);
  });
});
