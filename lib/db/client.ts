import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { satellites, ingestRuns } from "./schema";

const globalForDb = globalThis as unknown as {
  pg?: ReturnType<typeof postgres>;
};

// prepare: false because production goes through the transaction pooler,
// which cannot keep prepared statements between transactions.
const client =
  globalForDb.pg ??
  postgres(process.env.DATABASE_URL ?? "", {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema: { satellites, ingestRuns } });
