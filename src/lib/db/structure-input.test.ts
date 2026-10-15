import { describe, expect, it } from "vitest";
import { createStructure, deleteStructure, updateStructure } from "./structure-input";

const id = "550e8400-e29b-41d4-a716-446655440000";

describe("structure input", () => {
  it("accepts all entity types", () => {
    const project = createStructure.parse({ entity: "project", name: " North " });
    if (project.entity !== "project") throw new Error("Expected project");
    expect(project.name).toBe("North");

    const building = { entity: "building", name: "A", projectId: id };
    expect(createStructure.safeParse(building).success).toBe(true);

    const floor = { entity: "floor", buildingId: id, number: 0 };
    expect(createStructure.safeParse(floor).success).toBe(true);

    const apartment = { entity: "apartment", buildingId: id, floorId: id, number: "12A" };
    expect(createStructure.safeParse(apartment).success).toBe(true);
  });

  it("rejects invalid references, names, and floor numbers", () => {
    const building = { entity: "building", projectId: "invalid", name: "A" };
    expect(createStructure.safeParse(building).success).toBe(false);

    expect(createStructure.safeParse({ entity: "project", name: "  " }).success).toBe(false);

    const floor = { entity: "floor", buildingId: id, number: 1.5 };
    expect(createStructure.safeParse(floor).success).toBe(false);
  });

  it("requires valid ids for updates and deletes", () => {
    const apartment = { entity: "apartment", id, number: "2" };
    expect(updateStructure.safeParse(apartment).success).toBe(true);

    const project = { entity: "project", id: "invalid" };
    expect(deleteStructure.safeParse(project).success).toBe(false);
  });
});
