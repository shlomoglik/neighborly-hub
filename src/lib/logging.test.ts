import { expect, it } from "vitest";
import { createAppLogger } from "./logging";

function capture() {
  const lines: string[] = [];
  const logger = createAppLogger({
    write: (line: string) => {
      lines.push(line);
    },
  });
  return {
    logger,
    entries: () => lines.map((line) => JSON.parse(line)),
    output: () => lines.join(""),
  };
}

it("writes consistent structured events and extracts codes from wrapped errors without private data", () => {
  const { logger, entries, output } = capture();
  const cause = new Error("PRIVATE query", {
    cause: Object.assign(new Error("PRIVATE credentials"), {
      code: "42703",
      query: "PRIVATE SQL",
      parameters: ["PRIVATE resident"],
      detail: "PRIVATE row",
    }),
  });
  logger.error("project.setup.failed", cause, { phase: "persist-project" });
  expect(entries()).toEqual([
    {
      service: "neighborly-hub",
      level: "error",
      time: expect.any(Number),
      event: "project.setup.failed",
      msg: "project.setup.failed",
      phase: "persist-project",
      error: { code: "42703", hint: expect.stringContaining("Missing database column") },
    },
  ]);
  expect(output()).not.toContain("PRIVATE");
});

it.each([null, "PRIVATE", new Error("PRIVATE"), { code: "PRIVATE", message: "PRIVATE" }])(
  "omits arbitrary error content",
  (cause) => {
    const { logger, entries, output } = capture();
    logger.error("management.read.failed", cause, { operation: "projects" });
    expect(entries()[0]).toMatchObject({ error: {}, operation: "projects" });
    expect(output()).not.toContain("PRIVATE");
  },
);

it("handles cyclic causes and recognizes connection codes", () => {
  const { logger, entries } = capture();
  const cycle: { cause?: unknown } = {};
  cycle.cause = cycle;
  logger.error("project.setup.failed", cycle);
  expect(entries()[0].error).toEqual({});
  logger.error(
    "project.setup.failed",
    { cause: { code: "CONNECT_TIMEOUT" } },
    { phase: "authenticate" },
  );
  expect(entries()[1]).toMatchObject({
    error: { code: "CONNECT_TIMEOUT", hint: expect.stringContaining("Database connection failed") },
  });
});

it("writes validation diagnostics with the same convention and zero-based indexes", () => {
  const { logger, entries } = capture();
  logger.warn("structure.validation.failed", {
    indexBase: 0,
    issues: [{ field: "buildings.0.name", code: "too_small", message: "Required" }],
  });
  expect(entries()[0]).toMatchObject({
    service: "neighborly-hub",
    event: "structure.validation.failed",
    level: "warn",
    time: expect.any(Number),
    indexBase: 0,
    issues: [{ field: "buildings.0.name" }],
  });
});
