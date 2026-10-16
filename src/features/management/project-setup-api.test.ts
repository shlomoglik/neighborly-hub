import { afterEach, expect, it, vi } from "vitest";
import { createProject, ProjectSetupRequestError } from "./project-setup-api";
const input = {
  name: " Community ",
  city: "Sderot",
  buildings: [{ name: "A", floors: 1, unitsPerFloor: 2 }],
};
afterEach(() => vi.unstubAllGlobals());
it("posts the validated contract with same-origin cookies and no cache", async () => {
  const result = { projectId: "c44c9aec-f8e4-46b3-9957-12ceba088994" };
  const fetch = vi.fn().mockResolvedValue(Response.json(result, { status: 201 }));
  vi.stubGlobal("fetch", fetch);
  expect(await createProject(input)).toEqual(result);
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    "/api/projects/setup",
    expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ ...input, name: "Community" }),
    }),
  );
});
it("rejects failed and malformed responses instead of reporting a successful save", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ error: "FORBIDDEN" }, { status: 403 }))
    .mockResolvedValueOnce(Response.json({ projectId: "invalid" }));
  vi.stubGlobal("fetch", fetch);
  await expect(createProject(input)).rejects.toEqual(new ProjectSetupRequestError(403));
  await expect(createProject(input)).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(2);
});
