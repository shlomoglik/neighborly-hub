import {
  createManagedStructure,
  updateManagedStructure,
  type StructureEditTarget,
} from "@/lib/access/structure-management-contracts";
export class StructureRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function structurePayload(target: StructureEditTarget, value: string, address?: string) {
  const field =
    target.entity === "building"
      ? { name: value }
      : { number: target.entity === "floor" ? (value.trim() ? Number(value) : NaN) : value };
  if (target.mode === "update")
    return updateManagedStructure.parse({
      entity: target.entity,
      id: target.id,
      expected: target.expected,
      ...field,
      ...(target.entity === "building" && address !== undefined
        ? { address, expectedAddress: target.address ?? null }
        : {}),
    });
  const parent =
    target.entity === "floor"
      ? { buildingId: target.buildingId }
      : target.entity === "apartment"
        ? { floorId: target.floorId }
        : {};
  return createManagedStructure.parse({
    entity: target.entity,
    ...parent,
    ...field,
    ...(target.entity === "building" && address !== undefined ? { address } : {}),
  });
}
export async function saveStructure(
  projectId: string,
  target: StructureEditTarget,
  value: string,
  signal: AbortSignal,
  address?: string,
) {
  const response = await fetch(
    `/api/management/projects/${encodeURIComponent(projectId)}/structure`,
    {
      method: target.mode === "create" ? "POST" : "PATCH",
      signal,
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(structurePayload(target, value, address)),
    },
  );
  if (!response.ok) {
    let code = "INTERNAL_ERROR";
    try {
      const result = await response.json();
      if (typeof result.error === "string") code = result.error;
    } catch {
      /* Keep non-JSON failures generic. */
    }
    throw new StructureRequestError(response.status, code);
  }
  return response.json() as Promise<{ id: string }>;
}
