/** Inputs come exclusively from database records for a verified session user. */
export type AccessFacts = {
  admin: boolean;
  projectManager: boolean;
  managedBuildings: string[];
  residentBuildings: string[];
  directoryVisibility: string;
};
export type DirectoryScope = {
  allBuildings: boolean;
  buildings: string[];
  managedBuildings: string[];
  manager: boolean;
};
export function directoryScope(facts: AccessFacts): DirectoryScope {
  const manager = facts.admin || facts.projectManager;
  // Unknown settings fail closed for residents.
  const community = facts.directoryVisibility === "community" && facts.residentBuildings.length > 0;
  return {
    allBuildings: manager || community,
    buildings: [
      ...new Set([
        ...facts.managedBuildings,
        ...(facts.directoryVisibility === "building" || facts.directoryVisibility === "community"
          ? facts.residentBuildings
          : []),
      ]),
    ],
    managedBuildings: facts.managedBuildings,
    manager,
  };
}
export function hasDirectoryAccess(scope: DirectoryScope) {
  return scope.allBuildings || scope.buildings.length > 0;
}
