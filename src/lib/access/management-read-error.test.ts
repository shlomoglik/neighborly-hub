import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { logManagementReadError } from "./management-read-error";
import { logger } from "@/lib/logging";

afterEach(() => vi.restoreAllMocks());

it("logs SQLSTATE from wrapped database failures without SQL, parameters or messages", () => {
  const log = vi.spyOn(logger, "error").mockImplementation(() => {});
  logManagementReadError(
    "hierarchy",
    new Error("private query", {
      cause: Object.assign(new Error("private parameters"), {
        code: "42703",
        query: "private SQL",
      }),
    }),
  );
  expect(log).toHaveBeenCalledExactlyOnceWith("management.read.failed", expect.any(Error), {
    operation: "hierarchy",
  });
});

it.each([null, "secret", new Error("secret"), { code: "secret" }])(
  "omits arbitrary exception content",
  (cause) => {
    const log = vi.spyOn(logger, "error").mockImplementation(() => {});
    logManagementReadError("projects", cause);
    expect(log).toHaveBeenCalledExactlyOnceWith("management.read.failed", cause, {
      operation: "projects",
    });
  },
);
