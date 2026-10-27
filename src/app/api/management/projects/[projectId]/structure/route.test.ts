import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({
  readAuthConfig: () => ({ baseURL: "https://structure.test" }),
}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/access/structure-management", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access/structure-management")>()),
  createManagementStructure: vi.fn(),
  updateManagementStructure: vi.fn(),
}));
import { getCurrentUser } from "@/lib/auth/session";
import {
  createManagementStructure,
  updateManagementStructure,
  StructureManagementError,
} from "@/lib/access/structure-management";
vi.mock("@/lib/access/visual-structure", () => ({
  saveVisualBuilding: vi.fn(),
  saveVisualProject: vi.fn(),
}));
import { saveVisualBuilding, saveVisualProject } from "@/lib/access/visual-structure";
import { POST, PATCH, PUT } from "./route";
const id = "c44c9aec-f8e4-46b3-9957-12ceba088994";
const context = { params: Promise.resolve({ projectId: id }) };
function request(
  value: unknown = { entity: "building", name: " A " },
  origin = "https://structure.test",
  type = "application/json",
  raw = false,
) {
  return new Request("https://structure.test/api?userId=forged", {
    method: "POST",
    headers: { origin, "content-type": type, "x-user-id": "forged" },
    body: raw ? String(value) : JSON.stringify(value),
  });
}
function check(r: Response, status: number) {
  expect(r.status).toBe(status);
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
  expect(r.headers.get("Vary")).toBe("Cookie");
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "verified",
    email: "a@example.test",
    name: "A",
  });
});
it("uses only verified identity, route project and validated strict payloads", async () => {
  vi.mocked(createManagementStructure).mockResolvedValue({ id });
  check(await POST(request(), context), 201);
  expect(createManagementStructure).toHaveBeenCalledExactlyOnceWith({}, "verified", id, {
    entity: "building",
    name: "A",
  });
  vi.mocked(updateManagementStructure).mockResolvedValue({ id });
  const input = { entity: "floor", id, number: -1, expected: 0 };
  check(await PATCH(request(input), context), 200);
  expect(updateManagementStructure).toHaveBeenCalledExactlyOnceWith({}, "verified", id, input);
});
it("requires authentication and the exact configured origin for both write methods", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  for (const write of [POST, PATCH]) check(await write(request(), context), 401);
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "verified",
    email: "a@example.test",
    name: "A",
  });
  for (const origin of ["", "https://evil.test"])
    for (const write of [POST, PATCH]) check(await write(request(undefined, origin), context), 403);
  expect(createManagementStructure).not.toHaveBeenCalled();
  expect(updateManagementStructure).not.toHaveBeenCalled();
});
it.each([
  ["{", 400, "application/json"],
  ["x".repeat(5000), 413, "application/json"],
  ["{}", 415, "text/plain"],
] as const)("bounds/validates JSON bodies", async (body, status, type) => {
  check(await POST(request(body, undefined, type, true), context), status);
  expect(createManagementStructure).not.toHaveBeenCalled();
});
it("rejects moves, forged parent IDs, project edits and invalid numbers", async () => {
  for (const input of [
    { entity: "project", name: "Bad" },
    { entity: "apartment", floorId: id, buildingId: id, number: "1" },
    { entity: "floor", buildingId: id, number: 1.5 },
    { entity: "floor", buildingId: id, number: 2147483648 },
  ])
    check(await POST(request(input), context), 400);
  check(
    await PATCH(
      request({ entity: "apartment", id, number: "2", expected: "1", floorId: id }),
      context,
    ),
    400,
  );
  check(await PATCH(request({ entity: "apartment", id, number: "2" }), context), 400);
});
it("keeps invalid/missing/denied targets generic and never serializes database errors", async () => {
  for (const projectId of ["", "bad"])
    check(await POST(request(), { params: Promise.resolve({ projectId }) }), 404);
  for (const error of [
    new StructureManagementError(404, "NOT_FOUND"),
    new StructureManagementError(409, "DUPLICATE_STRUCTURE"),
    new StructureManagementError(409, "STALE_STRUCTURE"),
    new Error("private SQL"),
  ]) {
    vi.mocked(createManagementStructure).mockRejectedValue(error);
    const r = await POST(request(), context);
    check(r, error instanceof StructureManagementError ? error.status : 500);
    expect(await r.json()).toEqual({
      error: error instanceof StructureManagementError ? error.code : "INTERNAL_ERROR",
    });
  }
});

it("validates detailed snapshots and passes only the verified actor to the visual writer", async () => {
  const input = {
    id,
    expectedVersion: "a".repeat(64),
    name: "A",
    address: "",
    floors: [
      { id: "27e8d799-5714-4f4f-831d-715a0cced685", number: 0, type: "commercial", apartments: [] },
    ],
  };
  const put = (value: unknown, origin = "https://structure.test") =>
    new Request("https://structure.test/api", {
      method: "PUT",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(value),
    });
  vi.mocked(saveVisualBuilding).mockResolvedValue({ id });
  check(await PUT(put(input), context), 200);
  expect(saveVisualBuilding).toHaveBeenCalledExactlyOnceWith({}, "verified", id, input);
  check(await PUT(put({ ...input, userId: "forged" }), context), 400);
  check(await PUT(put(input, "https://evil.test"), context), 403);
  check(await PUT(put({ ...input, floors: [...input.floors, ...input.floors] }), context), 400);
  vi.mocked(saveVisualBuilding).mockRejectedValue(
    new StructureManagementError(409, "STALE_STRUCTURE"),
  );
  check(await PUT(put(input), context), 409);
});

it("validates a project snapshot and dispatches one atomic save", async () => {
  const value = {
    action: "saveProjectStructure",
    buildings: [
      {
        id,
        expectedVersion: "a".repeat(64),
        name: "A",
        address: "",
        floors: [
          {
            id: "27e8d799-5714-4f4f-831d-715a0cced687",
            number: 0,
            type: "residential",
            apartments: [],
          },
        ],
      },
    ],
  };
  const put = (body: unknown) =>
    new Request("https://structure.test/api", {
      method: "PUT",
      headers: { origin: "https://structure.test", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  vi.mocked(saveVisualProject).mockResolvedValue({ ids: [id] });
  check(await PUT(put(value), context), 200);
  expect(saveVisualProject).toHaveBeenCalledExactlyOnceWith({}, "verified", id, value);
  expect(saveVisualBuilding).not.toHaveBeenCalled();
  check(
    await PUT(put({ ...value, buildings: [...value.buildings, ...value.buildings] }), context),
    400,
  );
  expect(saveVisualProject).toHaveBeenCalledTimes(1);
});
