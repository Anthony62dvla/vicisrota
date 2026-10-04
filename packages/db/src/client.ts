import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export const createDb = (url: string): { db: Database; close: () => Promise<void> } => {
  const client = postgres(url, { max: 10, onnotice: () => {} });
  return { db: drizzle(client, { schema }), close: () => client.end() };
};

/**
 * Runs `fn` in a transaction scoped to one business. Row-level security only shows rows whose
 * organisation_id matches, so a bug elsewhere cannot leak another business's data.
 */
export const withOrganisation = <T>(db: Database, organisationId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> =>
  db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organisation_id', ${organisationId}, true)`);
    return fn(tx);
  });
