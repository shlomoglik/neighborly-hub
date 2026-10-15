import { describe, expect, it } from "vitest";
import { directoryScope, hasDirectoryAccess, type AccessFacts } from "./policy";
const base: AccessFacts = {
  admin: false,
  projectManager: false,
  managedBuildings: [],
  residentBuildings: [],
  directoryVisibility: "community",
};
describe("directory scope", () => {
  it("denies unlinked and pending users", () =>
    expect(hasDirectoryAccess(directoryScope(base))).toBe(false));
  it("grants approved residents community scope only when configured", () => {
    expect(directoryScope({ ...base, residentBuildings: ["a"] }).allBuildings).toBe(true);
    expect(
      directoryScope({ ...base, directoryVisibility: "building", residentBuildings: ["a"] }),
    ).toMatchObject({ allBuildings: false, buildings: ["a"] });
  });
  it("fails closed for unknown visibility", () =>
    expect(
      hasDirectoryAccess(
        directoryScope({ ...base, directoryVisibility: "invalid", residentBuildings: ["a"] }),
      ),
    ).toBe(false));
  it("keeps building managers within their assignments", () =>
    expect(directoryScope({ ...base, managedBuildings: ["b"] })).toMatchObject({
      allBuildings: false,
      buildings: ["b"],
      manager: false,
    }));
  it("grants project managers and admins project-wide scope", () => {
    expect(directoryScope({ ...base, projectManager: true }).allBuildings).toBe(true);
    expect(directoryScope({ ...base, admin: true }).manager).toBe(true);
  });
});
