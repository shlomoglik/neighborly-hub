import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { logManagementReadError } from "./management-read-error";

afterEach(() => vi.restoreAllMocks());

it("logs SQLSTATE from wrapped database failures without SQL, parameters or messages", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  logManagementReadError(
    "hierarchy",
    new Error("private query", {
      cause: Object.assign(new Error("private parameters"), {
        code: "42703",
        query: "private SQL",
      }),
    }),
  );
  expect(log).toHaveBeenCalledExactlyOnceWith("Management read failed", {
    operation: "hierarchy",
    databaseCode: "42703",
  });
});

it.each([null, "secret", new Error("secret"), { code: "secret" }])(
  "omits arbitrary exception content",
  (cause) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    logManagementReadError("projects", cause);
    expect(log).toHaveBeenCalledExactlyOnceWith("Management read failed", {
      operation: "projects",
      databaseCode: undefined,
    });
  },
);
