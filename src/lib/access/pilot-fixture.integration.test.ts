import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { expect, it, vi } from "vitest";
import * as schema from "../../../drizzle/schema";
import { createAuth } from "../auth/create-auth";
import { dict } from "../i18n/dictionary";
import { pilotFixtureConfig } from "./pilot-fixture-config";
vi.mock("server-only", () => ({}));
// This fixture plugin exists only in the Vitest process; the Next.js app keeps normal auth.
it.skipIf(!process.env.PILOT_E2E_DATABASE_URL)(
  "seeds isolated signed browser identities without app auth changes",
  async () => {
    const config = pilotFixtureConfig(process.env);
    const client = postgres(config.databaseURL, { max: 1 });
    const db = drizzle(client, { schema });
    try {
      const existing = await client`SELECT id FROM app_users LIMIT 1`;
      if (existing.length) throw new Error("Pilot fixture database must be empty");
      const auth = betterAuth({
        ...createAuth(db, {
          baseURL: config.origin,
          secret: config.secret,
          googleClientId: process.env.GOOGLE_CLIENT_ID!,
          googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }).options,
        plugins: [testUtils()],
      });
      const test = (await auth.$context).test;
      const identities: Record<string, { email: string; cookies: unknown[] }> = {};
      for (const role of ["admin", "resident", "family", "outsider"]) {
        const user = await test.saveUser(
          test.createUser({
            id: crypto.randomUUID(),
            email: `pilot-${role}@example.test`,
            name: `Pilot ${role}`,
            emailVerified: true,
          }),
        );
        if (role === "admin")
          await db.insert(schema.globalRoles).values({ userId: user.id, role: "admin" });
        const signed = await test.login({ userId: user.id });
        const session = await auth.api.getSession({ headers: signed.headers });
        expect(session?.user.id).toBe(user.id);
        identities[role] = { email: user.email, cookies: signed.cookies };
      }
      await mkdir(config.directory, { recursive: true, mode: 0o700 });
      await writeFile(
        join(config.directory, "identities.json"),
        JSON.stringify({
          origin: config.origin,
          identities,
          labels: Object.fromEntries(Object.entries(dict).map(([key, value]) => [key, value.en])),
        }),
        { mode: 0o600 },
      );
    } finally {
      await client.end();
    }
  },
);
