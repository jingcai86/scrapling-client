import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./core/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["scrapling"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
