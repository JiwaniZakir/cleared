import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration.
 * - `pnpm db:generate` writes SQL migrations into drizzle/ from lib/db/schema.
 *   It needs no database. Row-level security, grants, triggers and SQL helper
 *   functions are hand-written custom migrations (`drizzle-kit generate --custom`).
 * - `pnpm db:migrate` applies them to a real Postgres. Use the unpooled
 *   connection string (DATABASE_URL_UNPOOLED, falling back to DATABASE_URL).
 *   The local PGlite database migrates itself on first use (lib/db/client.ts),
 *   because it needs the citext extension loaded into the client.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  migrations: {
    table: "__drizzle_migrations",
    schema: "drizzle",
  },
  strict: true,
  verbose: true,
});
