import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations should use a direct (non-pooled) connection on Neon when available.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
