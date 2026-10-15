import { describe, expect, it } from "vitest";
import { toBuildingHierarchy } from "./building-hierarchy-model";

describe("toBuildingHierarchy", () => {
  it("preserves empty buildings and floors", () => {
    expect(toBuildingHierarchy([
      { buildingId: "b1", buildingName: "A", floorId: null, floorNumber: null, apartmentId: null, apartmentNumber: null },
      { buildingId: "b2", buildingName: "B", floorId: "f2", floorNumber: 0, apartmentId: null, apartmentNumber: null },
    ])).toEqual([
      { id: "b1", name: "A", floors: [] },
      { id: "b2", name: "B", floors: [{ id: "f2", number: 0, apartments: [] }] },
    ]);
  });

  it("groups joined apartment rows without duplicating floors", () => {
    expect(toBuildingHierarchy([
      { buildingId: "b", buildingName: "A", floorId: "f", floorNumber: 1, apartmentId: "a1", apartmentNumber: "1" },
      { buildingId: "b", buildingName: "A", floorId: "f", floorNumber: 1, apartmentId: "a2", apartmentNumber: "2" },
    ])).toEqual([
      { id: "b", name: "A", floors: [{ id: "f", number: 1, apartments: [{ id: "a1", number: "1" }, { id: "a2", number: "2" }] }] },
    ]);
  });

  it("returns an empty array for a project without buildings", () => {
    expect(toBuildingHierarchy([])).toEqual([]);
  });
});
