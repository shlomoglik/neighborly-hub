import { afterEach, expect, it, vi } from "vitest";
import { invitationApi, InvitationRequestError } from "./invitation-api";
afterEach(() => vi.unstubAllGlobals());
it("uses private same-origin reads and exact typed writes without actor parameters", async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(async () =>
      Response.json({ id: "created", url: "https://app.test/join/token" }),
    );
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  const input = {
    kind: "project_manager" as const,
    recipientEmail: "manager@example.test",
    expiresInDays: 7,
  };
  await invitationApi.create("p/a", input, signal);
  expect(fetcher).toHaveBeenLastCalledWith(
    "/api/management/projects/p%2Fa/invitations",
    expect.objectContaining({
      signal,
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(input),
    }),
  );
  await invitationApi.context("abc", 2, signal);
  expect(fetcher).toHaveBeenLastCalledWith(
    "/api/join/abc?page=2",
    expect.objectContaining({
      signal,
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    }),
  );
  await invitationApi.submit("abc", {}, signal);
  expect(fetcher).toHaveBeenLastCalledWith(
    "/api/join/abc",
    expect.objectContaining({ body: "{}" }),
  );
  await invitationApi.review("p", "r", "reject", signal);
  expect(fetcher).toHaveBeenLastCalledWith(
    "/api/management/projects/p/join-requests/r",
    expect.objectContaining({ body: '{"decision":"reject"}' }),
  );
});
it("propagates denial codes, non-JSON server failures and aborts without mock fallback", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ error: "NOT_FOUND" }, { status: 404 }))
    .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
    .mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  await expect(invitationApi.mine(1, signal)).rejects.toEqual(
    new InvitationRequestError(404, "NOT_FOUND"),
  );
  await expect(invitationApi.mine(1, signal)).rejects.toEqual(
    new InvitationRequestError(502, "INTERNAL_ERROR"),
  );
  await expect(invitationApi.mine(1, signal)).rejects.toMatchObject({ name: "AbortError" });
});
