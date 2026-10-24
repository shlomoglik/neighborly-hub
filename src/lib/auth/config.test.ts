import { describe, expect, it } from "vitest";
import { readAuthConfig } from "./config";
const valid = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  BETTER_AUTH_URL: "https://neighborly.example",
  BETTER_AUTH_SECRET: "test-secret-with-32-or-more-characters-123",
  GOOGLE_CLIENT_ID: "test-google-client",
  GOOGLE_CLIENT_SECRET: "test-google-secret",
  NODE_ENV: "production",
};
describe("authentication configuration", () => {
  it("disables auth without complete setup and never supplies fallback secrets", () => {
    expect(readAuthConfig({})).toBeNull();
    for (const key of ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"])
      expect(readAuthConfig({ ...valid, [key]: "" })).toBeNull();
  });
  it("normalizes a single trusted origin", () =>
    expect(
      readAuthConfig({ ...valid, BETTER_AUTH_URL: "https://neighborly.example/" })?.baseURL,
    ).toBe("https://neighborly.example"));
  it.each([
    "http://neighborly.example",
    "https://neighborly.example/path",
    "https://user:password@neighborly.example",
    "https://neighborly.example?return=evil",
    "https://neighborly.example/#hash",
    "javascript:alert(1)",
  ])("rejects unsafe origins: %s", (url) =>
    expect(() => readAuthConfig({ ...valid, BETTER_AUTH_URL: url })).toThrow(),
  );
  it("allows loopback HTTP in development only", () => {
    expect(
      readAuthConfig({
        ...valid,
        NODE_ENV: "development",
        BETTER_AUTH_URL: "http://localhost:3000",
      })?.baseURL,
    ).toBe("http://localhost:3000");
    expect(() => readAuthConfig({ ...valid, BETTER_AUTH_URL: "http://localhost:3000" })).toThrow();
  });
  it("rejects short secrets and non-PostgreSQL URLs without disclosing values", () => {
    expect(() => readAuthConfig({ ...valid, BETTER_AUTH_SECRET: "short-private-value" })).toThrow(
      "Authentication configuration is invalid",
    );
    expect(() =>
      readAuthConfig({ ...valid, DATABASE_URL: "mysql://test:test@localhost/test" }),
    ).toThrow("Authentication configuration is invalid");
  });
});

it("supports password auth without Google and rejects partial optional provider setup", () => {
  expect(
    readAuthConfig({ ...valid, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" }),
  ).toMatchObject({ baseURL: valid.BETTER_AUTH_URL });
  expect(() => readAuthConfig({ ...valid, GOOGLE_CLIENT_ID: "" })).toThrow();
  expect(() => readAuthConfig({ ...valid, RESEND_API_KEY: "private" })).toThrow();
  expect(() =>
    readAuthConfig({ ...valid, RESEND_API_KEY: "private", AUTH_EMAIL_FROM: "bad" }),
  ).toThrow();
  expect(
    readAuthConfig({ ...valid, RESEND_API_KEY: "private", AUTH_EMAIL_FROM: "auth@example.test" })
      ?.mail,
  ).toEqual({ apiKey: "private", from: "auth@example.test" });
});
