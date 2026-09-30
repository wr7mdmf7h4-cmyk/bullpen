import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations should use a direct (non-pooled) connection when available.
    // DATABASE_URL_UNPOOLED / POSTGRES_URL_NON_POOLING are what Vercel's Neon
    // integration injects, so a Vercel + Neon setup needs no manual config.
    url:
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL,
  },
});
