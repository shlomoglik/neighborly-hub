import { describe, expect, it } from "vitest";
import { projectStructureInput } from "./project-structure-input";

describe("project structure input", () => {
  it("accepts a nested hierarchy", () => {
    const parsed = projectStructureInput.parse({
      name: " Community ",
      buildings: [
        {
          name: "A",
          floors: [{ number: 0, apartments: [{ number: "1" }, { number: "2" }] }],
        },
      ],
    });
    expect(parsed.name).toBe("Community");
    expect(parsed.buildings[0].floors[0].apartments).toHaveLength(2);
  });

  it("rejects malformed nested records", () => {
    const invalid = projectStructureInput.safeParse({
      name: "Community",
      buildings: [{ name: "A", floors: [{ number: 0.5, apartments: [{ number: "" }] }] }],
    });
    expect(invalid.success).toBe(false);
  });

  it("supports empty projects and buildings", () => {
    expect(projectStructureInput.safeParse({ name: "Community", buildings: [] }).success).toBe(
      true,
    );
  });
});
