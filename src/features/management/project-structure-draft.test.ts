import { describe, expect, it } from "vitest";
import {
  copyFloor,
  copyBuildingLayout,
  cloneBuilding,
  duplicateFloors,
  moveUnit,
  validateDraft,
  withDefaultNames,
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

it("materializes unique default names while preserving custom names, IDs and floor levels", () => {
  const existing = { ...building(), name: "Building 1" };
  const unnamed = { ...building(), id: "unnamed", name: " " };
  unnamed.floors[0].number = -1;
  const named = withDefaultNames([existing, unnamed], "Building", "Floor");
  expect(named.map((b) => b.name)).toEqual(["Building 1", "Building 2"]);
  expect(named[1].id).toBe("unnamed");
  expect(named[1].floors.map((f) => [f.number, f.name])).toEqual([
    [-1, "Floor -1"],
    [0, "Shop"],
  ]);
  expect(unnamed.name).toBe(" ");
  expect(unnamed.floors[0].name).toBe("");
  expect(validateDraft(named).success).toBe(true);
});

it("clones the full building layout with fresh IDs and independent units, without resident links", () => {
  const source = { ...building(), address: "Example street 5" };
  source.floors[1].number = -1;
  source.floors[1].type = "parking";
  const clone = cloneBuilding(source, [source]);
  expect(clone).toMatchObject({ name: "A (2)", address: source.address });
  expect(clone.id).not.toBe(source.id);
  expect(clone.floors.map((f) => [f.number, f.name, f.type])).toEqual(
    source.floors.map((f) => [f.number, f.name, f.type]),
  );
  const sourceIds = new Set([
    source.id,
    ...source.floors.map((f) => f.id),
    ...source.floors.flatMap((f) => f.apartments.map((u) => u.id)),
  ]);
  const cloneIds = [
    clone.id,
    ...clone.floors.map((f) => f.id),
    ...clone.floors.flatMap((f) => f.apartments.map((u) => u.id)),
  ];
  expect(cloneIds.every((id) => !sourceIds.has(id))).toBe(true);
  expect(new Set(cloneIds).size).toBe(cloneIds.length);
  expect(clone.floors[0].apartments.map((u) => u.number)).toEqual(["25A", "25B"]);
  expect(clone.floors[0].apartments.every((u) => u.linked === undefined)).toBe(true);
  expect(validateDraft([source, clone]).success).toBe(true);
  clone.floors[0].apartments[0].number = "Edited";
  expect(source.floors[0].apartments[0].number).toBe("25A");
  expect(cloneBuilding(source, [source, clone]).name).toBe("A (3)");
});

it("keeps clone names within the name length limit and avoids normalized collisions", () => {
  const source = { ...building(), name: "A".repeat(200) };
  const clone = cloneBuilding(source, [source]);
  expect(clone.name.length).toBe(200);
  const collision = { ...clone, name: clone.name.toLowerCase() };
  const next = cloneBuilding(source, [source, collision]);
  expect(next.name.endsWith(" (3)")).toBe(true);
  expect(validateDraft([source, collision, next]).success).toBe(true);
});
