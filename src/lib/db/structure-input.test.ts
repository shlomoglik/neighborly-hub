import { describe, expect, it } from "vitest";
import { createStructure, deleteStructure, updateStructure } from "./structure-input";

const id = "550e8400-e29b-41d4-a716-446655440000";

describe("structure input", () => {
  it("validates all create entity types", () => {
    expect(createStructure.parse({ entity: "project", name: " North " }).name).toBe("North");
    expect(createStructure.safeParse({ entity: "building", name: "A", projectId: id }).success).toBe(
      true,
    );
    expect(createStructure.safeParse({ entity: "floor", buildingId: id, number: 0 }).success).toBe(
      true,
    );
    expect(
      createStructure.safeParse({ entity: "apartment", buildingId: id, floorId: id, number: "12A" })
        .success,
    ).toBe(true);
  });

  it("rejects invalid references, empty names, and fractional floor numbers", () => {
    expect(
      createStructure.safeParse({ entity: "building", projectId: "invalid", name: "A" }).success,
    ).toBe(false);
    expect(createStructure.safeParse({ entity: "project", name: "  " }).success).toBe(false);
    expect(
      createStructure.safeParse({ entity: "floor", buildingId: id, number: 1.5 }).success,
    ).toBe(false);
  });

  it("requires valid ids for update and delete", () => {
    expect(updateStructure.safeParse({ entity: "apartment", id, number: "2" }).success).toBe(true);
    expect(deleteStructure.safeParse({ entity: "project", id: "invalid" }).success).toBe(false);
  });
});
