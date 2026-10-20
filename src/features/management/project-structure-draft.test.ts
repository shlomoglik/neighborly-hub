import { describe, expect, it } from "vitest";
import {
  copyFloor,
  copyBuildingLayout,
  duplicateFloors,
  moveUnit,
  validateDraft,
  type DraftBuilding,
} from "./project-structure-draft";
const building = (): DraftBuilding => ({
  id: "b",
  name: "A",
  address: "",
  floors: [
    {
      id: "f1",
      number: 1,
      name: "",
      type: "residential",
      apartments: [
        { id: "a", number: "25A", type: "residential" },
        { id: "b", number: "25B", type: "residential", linked: true },
      ],
    },
    { id: "f0", number: 0, name: "Shop", type: "commercial", apartments: [] },
  ],
});
describe("structure draft operations", () => {
  it("moves without renaming and preserves identity and linked state", () => {
    const b = building();
    const moved = moveUnit(b, "b", "f1", "a");
    expect(moved.floors[0].apartments.map((a) => a.number)).toEqual(["25B", "25A"]);
    expect(moved.floors[0].apartments[0].linked).toBe(true);
    expect(b.floors[0].apartments[0].number).toBe("25A");
    expect(moveUnit(moved, "b", "f0").floors[1].apartments[0].id).toBe("b");
  });
  it("copies into empty floors, preserves linked targets and creates fresh unique names", () => {
    const b = building();
    b.floors[1].apartments = [
      { id: "linked", number: "Shop-A", type: "commercial", linked: true },
      { id: "delete", number: "Shop-B", type: "commercial" },
    ];
    const copied = copyFloor(b, "f1", ["f0"]);
    expect(copied.floors[1].apartments.map((a) => a.number)).toEqual(["Shop-A", "1", "2"]);
    expect(copied.floors[1].apartments[1].linked).toBeUndefined();
    expect(b.floors[1].apartments).toHaveLength(2);
    expect(validateDraft([copied]).success).toBe(true);
  });
  it("inserts levels and shifts higher floors without changing their labels", () => {
    const b = building();
    const result = duplicateFloors(b, "f0", 2);
    expect(result.floors.map((f) => f.number)).toEqual([3, 0, 1, 2]);
    expect(result.floors[0].apartments.map((a) => a.number)).toEqual(["25A", "25B"]);
    expect(validateDraft([result]).success).toBe(true);
  });
  it("validates duplicate names across floors, Unicode and duplicate levels", () => {
    const b = building();
    b.floors[1].apartments = [{ id: "x", number: "２５ａ", type: "commercial" }];
    expect(validateDraft([b]).success).toBe(false);
    b.floors[1].apartments = [];
    b.floors[1].number = 1;
    expect(validateDraft([b]).success).toBe(false);
  });
});

it("copies a building template without leaking addresses, IDs or links", () => {
  const source = building();
  const target = {
    ...building(),
    id: "other",
    name: "B",
    address: "Other street",
    floors: [{ ...building().floors[1], id: "empty" }],
  };
  const copied = copyBuildingLayout(source, target);
  expect(copied.name).toBe("B");
  expect(copied.address).toBe("Other street");
  expect(copied.floors[0].id).not.toBe(source.floors[0].id);
  expect(copied.floors[0].apartments[1].linked).toBeUndefined();
});
