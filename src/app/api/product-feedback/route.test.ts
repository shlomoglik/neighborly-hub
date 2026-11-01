import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({
  readAuthConfig: vi.fn(() => ({ baseURL: "https://app.test" })),
}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/access/product-feedback", async (original) => ({
  ...(await original<typeof import("@/lib/access/product-feedback")>()),
  submitFeedback: vi.fn(),
  listFeedback: vi.fn(),
}));
import { getCurrentUser } from "@/lib/auth/session";
import { readAuthConfig } from "@/lib/auth/config";
import { FeedbackError, submitFeedback, listFeedback } from "@/lib/access/product-feedback";
import { GET, POST } from "./route";
const input = { submissionId: crypto.randomUUID(), message: " Useful feedback " };
function request(body: unknown = input, origin = "https://app.test", type = "application/json") {
  return new Request("https://app.test/api/product-feedback", {
    method: "POST",
    headers: {
      origin,
      "content-type": type,
      "x-user-id": "forged-admin",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
async function check(response: Response, status: number, body?: unknown) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  if (body) expect(await response.json()).toEqual(body);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "session-author",
    email: "private@test.test",
    name: "Private",
  });
  vi.mocked(submitFeedback).mockResolvedValue({ id: "saved" });
});
it("uses only the session author and normalized input without a community gate", async () => {
  await check(await POST(request()), 200, { id: "saved" });
  expect(submitFeedback).toHaveBeenCalledWith({}, "session-author", {
    ...input,
    message: "Useful feedback",
  });
});
it("rejects anonymous writes and reads", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  for (const action of [POST, GET]) await check(await action(request()), 401);
  expect(submitFeedback).not.toHaveBeenCalled();
  expect(listFeedback).not.toHaveBeenCalled();
});
it.each(["https://evil.test", "null", "", "https://app.test.evil.test"])(
  "rejects origin %s",
  async (origin) => {
    await check(await POST(request(input, origin)), 403);
    expect(submitFeedback).not.toHaveBeenCalled();
  },
);
it("fails closed without origin configuration", async () => {
  vi.mocked(readAuthConfig).mockReturnValueOnce(null);
  await check(await POST(request()), 403);
});
it.each([
  null,
  [],
  {},
  "{",
  { ...input, message: " \n\t " },
  { ...input, message: 42 },
  { ...input, message: "a".repeat(2001) },
  { ...input, message: "\0" },
  { ...input, message: "\uD800" },
  { ...input, submissionId: "invalid" },
  { ...input, authorUserId: crypto.randomUUID() },
  { ...input, role: "admin" },
])("rejects malformed input %#", async (body) => {
  await check(await POST(request(body)), 400);
  expect(submitFeedback).not.toHaveBeenCalled();
});
it("bounds actual stream bytes, content type and UTF-8 decoding", async () => {
  await check(await POST(request(" ".repeat(16385))), 413);
  await check(await POST(request(input, undefined, "text/plain")), 415);
  const invalid = new Request("https://app.test/api/product-feedback", {
    method: "POST",
    headers: {
      origin: "https://app.test",
      "content-type": "application/json",
    },
    body: new Uint8Array([0xff]),
  });
  await check(await POST(invalid), 400);
});
it.each([
  "page=0",
  "page=10001",
  "page=1.5",
  "page=no",
  "page=1&page=2",
  "authorUserId=other",
  "role=admin",
  "limit=100000",
])("rejects query %s", async (query) => {
  await check(await GET(new Request(`https://app.test/api/product-feedback?${query}`)), 400);
  expect(listFeedback).not.toHaveBeenCalled();
});
it("passes bounded page and verified actor to the authorized service", async () => {
  vi.mocked(listFeedback).mockResolvedValue({ feedback: [], page: 2, hasNext: false });
  await check(await GET(new Request("https://app.test/api/product-feedback?page=2")), 200, {
    feedback: [],
    page: 2,
    hasNext: false,
  });
  expect(listFeedback).toHaveBeenCalledWith({}, "session-author", 2);
});
it.each([403, 409, 500])("keeps errors private and sanitizes failure %i", async (status) => {
  const error =
    status === 500
      ? new Error("private body/driver parameters")
      : new FeedbackError(status, status === 409 ? "IDEMPOTENCY_CONFLICT" : "FORBIDDEN");
  vi.mocked(submitFeedback).mockRejectedValueOnce(error);
  await check(await POST(request()), status, {
    error: status === 500 ? "INTERNAL_ERROR" : (error as FeedbackError).code,
  });
});
