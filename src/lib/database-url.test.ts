import { describe, expect, it } from "vitest";
import { withExplicitSslMode } from "./database-url";

describe("withExplicitSslMode", () => {
  it("pins sslmode=require to verify-full, keeping other params", () => {
    const out = withExplicitSslMode(
      "postgresql://u:p@ep-x-pooler.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    );
    expect(new URL(out).searchParams.get("sslmode")).toBe("verify-full");
    expect(new URL(out).searchParams.get("channel_binding")).toBe("require");
  });

  it("leaves URLs without sslmode, explicit libpq compat, or verify-full alone", () => {
    for (const url of [
      "postgresql://postgres:postgres@localhost:5432/bullpen",
      "postgresql://u:p@h/db?sslmode=require&uselibpqcompat=true",
      "postgresql://u:p@h/db?sslmode=verify-full",
      "not a url",
    ]) {
      expect(withExplicitSslMode(url)).toBe(url);
    }
  });
});
