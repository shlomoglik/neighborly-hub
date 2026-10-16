import { describe, expect, it } from "vitest";
import { projectSetupInput } from "./project-setup-input";

const valid = {
  name: "Community",
  city: "Sderot",
  buildings: [{ name: "A", floors: 3, unitsPerFloor: 4 }],
};

describe("project setup input", () => {
  it("accepts and trims a valid setup", () => {
    expect(projectSetupInput.parse(valid)).toEqual(valid);
    expect(projectSetupInput.parse({ ...valid, name: " Community " }).name).toBe(
      "Community",
    );
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
