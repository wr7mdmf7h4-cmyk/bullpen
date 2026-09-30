import "server-only";
import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations, 1 lane).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// A real hash of a random string, verified against when the email doesn't
// exist so response time doesn't reveal which emails are registered.
let dummyHash: Promise<string> | undefined;
export function dummyVerify(password: string): Promise<boolean> {
  dummyHash ??= hashPassword(crypto.randomUUID());
  return dummyHash.then((h) => verifyPassword(h, password)).then(() => false);
}
