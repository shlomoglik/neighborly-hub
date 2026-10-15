import "server-only";
import { readAuthConfig } from "./config";
import { createAuth, type Auth } from "./create-auth";
let instance: Auth | undefined;
/** Lazy initialization keeps builds and mock-only previews independent of auth secrets/DB. */
export async function getAuth(): Promise<Auth | null> {
  const config = readAuthConfig(process.env);
  if (!config) return null;
  if (!instance) {
    const { db } = await import("../db/client");
    instance = createAuth(db, config);
  }
  return instance;
}
