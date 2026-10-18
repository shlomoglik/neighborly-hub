import { afterEach, expect, it, vi } from "vitest";
import { saveStructure, structurePayload, StructureRequestError } from "./structure-api";
afterEach(() => vi.unstubAllGlobals());
const id = "c44c9aec-f8e4-46b3-9957-12ceba088994";
it("sends strict POST/PATCH contracts with private credentials, cancellation, expected labels and safe paths", async () => {
  const fetch = vi.fn().mockImplementation(async () => Response.json({ id }));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  await saveStructure(
    "p/q",
    { mode: "create", entity: "apartment", floorId: id },
    " Studio ",
    signal,
  );
  expect(fetch.mock.calls[0][0]).toBe("/api/management/projects/p%2Fq/structure");
  expect(fetch.mock.calls[0][1]).toMatchObject({
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal,
    body: JSON.stringify({ entity: "apartment", floorId: id, number: "Studio" }),
  });
  await saveStructure("p", { mode: "update", entity: "floor", id, expected: 0 }, "-1", signal);
  expect(fetch.mock.calls[1][1]).toMatchObject({
    method: "PATCH",
    body: JSON.stringify({ entity: "floor", id, number: -1, expected: 0 }),
  });
});
it("rejects empty/fractional/out-of-range floors and propagates conflicts without fabricated success", async () => {
  for (const value of ["", " ", "1.5", "2147483648"])
    expect(() =>
      structurePayload({ mode: "create", entity: "floor", buildingId: id }, value),
    ).toThrow();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ error: "STALE_STRUCTURE" }, { status: 409 })),
  );
  await expect(
    saveStructure("p", { mode: "create", entity: "building" }, "A", new AbortController().signal),
  ).rejects.toEqual(new StructureRequestError(409, "STALE_STRUCTURE"));
});
