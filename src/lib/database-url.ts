/**
 * node-postgres currently treats sslmode=prefer|require|verify-ca as
 * verify-full, warns about it, and will switch to libpq semantics (weaker)
 * in its next major version. Neon URLs use sslmode=require, so we pin the
 * behaviour we actually rely on — full certificate verification — explicitly.
 */
export function withExplicitSslMode(url: string): string {
  try {
    const u = new URL(url);
    const mode = u.searchParams.get("sslmode");
    if (mode && ["prefer", "require", "verify-ca"].includes(mode) && !u.searchParams.has("uselibpqcompat")) {
      u.searchParams.set("sslmode", "verify-full");
      return u.toString();
    }
  } catch {
    // not a URL we understand: leave it untouched
  }
  return url;
}
