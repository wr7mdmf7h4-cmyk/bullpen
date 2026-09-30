import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";
import { withExplicitSslMode } from "@/lib/database-url";

function createClient() {
  const adapter = new PrismaPg({ connectionString: withExplicitSslMode(env().DATABASE_URL) });
  return new PrismaClient({ adapter });
}

type Client = ReturnType<typeof createClient>;

// Reuse one client across hot reloads in dev (and across invocations of a warm
// serverless function in production).
const globalForPrisma = globalThis as unknown as { prisma?: Client };

function getClient(): Client {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}

/**
 * Lazily-initialised Prisma client. Nothing connects (or validates env) until
 * the first query, so `next build` works without a database.
 */
export const db = new Proxy({} as Client, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Db = Client;
export type Tx = Parameters<Parameters<Client["$transaction"]>[0]>[0];
