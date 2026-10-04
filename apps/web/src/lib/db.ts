import { createDb } from "@vicisrota/db";

// postgres-js connects lazily, so importing this during the build does not need a database.
const globalForDb = globalThis as unknown as { vicisrotaDb?: ReturnType<typeof createDb> };

export const { db } = (globalForDb.vicisrotaDb ??= createDb(process.env.DATABASE_URL ?? "postgres://localhost:5432/vicisrota"));
