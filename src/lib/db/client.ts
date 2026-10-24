import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseTarget, validateDatabaseConnection } from "../../../scripts/db/target.mjs";
import * as schema from "../../../drizzle/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for database access");
}

validateDatabaseConnection(connectionString, databaseTarget(), "runtime");
const client = postgres(connectionString, { max: 10, prepare: false });
export const db = drizzle(client, { schema });
