import { expect, it } from "vitest";
import { pilotFixtureConfig } from "./pilot-fixture-config";
const base = {
  PILOT_E2E_DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/neighborly_pilot",
  DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/neighborly_pilot",
  BETTER_AUTH_URL: "https://127.0.0.1:3443",
  PILOT_FIXTURE_DIRECTORY: "/tmp/neighborly-fixtures",
  BETTER_AUTH_SECRET: "pilot-ci-only-do-not-use-for-real-deployments",
  GOOGLE_CLIENT_ID: "pilot-not-a-real-google-client",
  GOOGLE_CLIENT_SECRET: "pilot-not-a-real-google-secret",
};
it("accepts the disposable loopback fixture configuration", () => {
  expect(pilotFixtureConfig(base).origin).toBe(base.BETTER_AUTH_URL);
});
it("refuses public/unnamed databases, real auth configuration and mismatched app databases", () => {
  for (const patch of [
    { PILOT_E2E_DATABASE_URL: "postgresql://test:test@db.example.com/neighborly_pilot" },
    { PILOT_E2E_DATABASE_URL: "postgresql://test:test@127.0.0.1/production" },
    { DATABASE_URL: "postgresql://test:test@127.0.0.1/other" },
    { BETTER_AUTH_URL: "https://public.example.com" },
    { GOOGLE_CLIENT_ID: "real-client" },
    { BETTER_AUTH_SECRET: "a-real-application-secret-that-is-not-a-fixture" },
  ])
    expect(() => pilotFixtureConfig({ ...base, ...patch })).toThrow();
});
