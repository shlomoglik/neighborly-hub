import { describe, expect, it } from "vitest";
import { projectSetupInput, toProjectStructure } from "./project-setup-input";

const valid = {
  name: "Community",
  city: "Sderot",
  buildings: [{ name: "A", floors: 3, unitsPerFloor: 4 }],
};

describe("project setup input", () => {
  it("accepts and trims a valid setup", () => {
    expect(projectSetupInput.parse(valid)).toEqual(valid);
    expect(projectSetupInput.parse({ ...valid, name: " Community " }).name).toBe("Community");
  });

  it("rejects missing buildings and invalid floor counts", () => {
    expect(projectSetupInput.safeParse({ ...valid, buildings: [] }).success).toBe(false);
    expect(
      projectSetupInput.safeParse({
        ...valid,
        buildings: [{ name: "A", floors: 0, unitsPerFloor: 4 }],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate building names after normalization", () => {
    expect(
      projectSetupInput.safeParse({
        ...valid,
        buildings: [
          { name: " A ", floors: 1, unitsPerFloor: 1 },
          { name: "a", floors: 1, unitsPerFloor: 1 },
        ],
      }).success,
    ).toBe(false);
  });
});

it("rejects oversized projects, invalid numeric bounds and privilege fields", () => {
  for (const count of [0, -1, 1.5, 201, Infinity, NaN])
    expect(
      projectSetupInput.safeParse({
        ...valid,
        buildings: [{ name: "A", floors: count, unitsPerFloor: 1 }],
      }).success,
    ).toBe(false);
  expect(
    projectSetupInput.safeParse({
      ...valid,
      buildings: Array.from({ length: 101 }, (_, i) => ({
        name: String(i),
        floors: 1,
        unitsPerFloor: 1,
      })),
    }).success,
  ).toBe(false);
  expect(
    projectSetupInput.safeParse({
      ...valid,
      buildings: Array.from({ length: 6 }, (_, i) => ({
        name: String(i),
        floors: 200,
        unitsPerFloor: 1,
      })),
    }).success,
  ).toBe(false);
  expect(
    projectSetupInput.safeParse({
      ...valid,
      buildings: [{ name: "A", floors: 100, unitsPerFloor: 101 }],
    }).success,
  ).toBe(false);
  expect(projectSetupInput.safeParse({ ...valid, userId: "forged", role: "admin" }).success).toBe(
    false,
  );
});
it("rejects normalized Unicode duplicates and generates contiguous floors and apartment numbers", () => {
  expect(
    projectSetupInput.safeParse({
      ...valid,
      buildings: [
        { name: "Ａ", floors: 1, unitsPerFloor: 1 },
        { name: "a", floors: 1, unitsPerFloor: 1 },
      ],
    }).success,
  ).toBe(false);
  const structure = toProjectStructure({
    ...valid,
    buildings: [
      { name: "A", floors: 2, unitsPerFloor: 2 },
      { name: "B", floors: 1, unitsPerFloor: 1 },
    ],
  });
  expect(structure.buildings).toEqual([
    {
      name: "A",
      floors: [
        { number: 0, apartments: [{ number: "1" }, { number: "2" }] },
        { number: 1, apartments: [{ number: "3" }, { number: "4" }] },
      ],
    },
    { name: "B", floors: [{ number: 0, apartments: [{ number: "1" }] }] },
  ]);
});
