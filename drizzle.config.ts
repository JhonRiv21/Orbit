import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // The database is shared with Radar: keep this project's migration history
  // inside its own schema so neither project ever reads the other's journal.
  migrations: { table: "__drizzle_migrations", schema: "orbit" },
  // Migrations go through the session pooler: the transaction pooler cannot hold DDL.
  dbCredentials: { url: process.env.DIRECT_URL! },
});
