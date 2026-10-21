// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

vi.mock("pino", async () => {
  const browser = await vi.importActual<{ default: typeof import("pino").default }>(
    "pino/browser.js",
  );
  return { default: browser.default };
});
import { createAppLogger } from "./logging";
afterEach(() => vi.restoreAllMocks());

it("uses the same safe event convention in the actual Pino browser implementation", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const logger = createAppLogger();
  logger.error("project.setup.failed", Object.assign(new Error("PRIVATE SQL"), { code: "42703" }));
  logger.warn("structure.validation.failed", { indexBase: 0, issues: [] });
  expect(error).toHaveBeenCalledWith(
    expect.objectContaining({
      service: "neighborly-hub",
      level: "error",
      event: "project.setup.failed",
      time: expect.any(Number),
      error: expect.objectContaining({ code: "42703" }),
    }),
  );
  expect(JSON.stringify(error.mock.calls)).not.toContain("PRIVATE");
  expect(warn).toHaveBeenCalledWith(
    expect.objectContaining({
      service: "neighborly-hub",
      level: "warn",
      event: "structure.validation.failed",
      indexBase: 0,
    }),
  );
});
