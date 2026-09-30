import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "../db";
import { logInSchema } from "@/lib/validators";
import { dummyVerify, verifyPassword } from "./password";

/**
 * Auth.js v5, JWT sessions, no database adapter.
 *
 * - Credentials: email + argon2id password.
 * - "demo": passwordless sign-in as the seeded demo account (only reachable
 *   through the rate-limited demo Server Action, which passes a one-time token).
 * - Google: only registered when GOOGLE_CLIENT_ID/SECRET are set.
 *
 * The JWT carries only the user id; everything else is read from the DB.
 */

class InvalidLogin extends CredentialsSignin {
  code = "invalid_credentials";
}

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// One-time tokens minted by the demo login action (single-use, 30s TTL).
const demoTokens = new Map<string, { userId: string; expiresAt: number }>();
export function mintDemoToken(userId: string): string {
  const token = crypto.randomUUID();
  demoTokens.set(token, { userId, expiresAt: Date.now() + 30_000 });
  return token;
}

const providers: NextAuthConfig["providers"] = [
  Credentials({
    id: "credentials",
    credentials: { email: {}, password: {} },
    async authorize(raw) {
      const parsed = logInSchema.safeParse(raw);
      if (!parsed.success) throw new InvalidLogin();
      const { email, password } = parsed.data;
      const user = await db.user.findUnique({ where: { email } });
      if (!user?.passwordHash) {
        await dummyVerify(password);
        throw new InvalidLogin();
      }
      if (!(await verifyPassword(user.passwordHash, password))) throw new InvalidLogin();
      return { id: user.id, email: user.email };
    },
  }),
  Credentials({
    id: "demo",
    credentials: { token: {} },
    async authorize(raw) {
      const token = typeof raw?.token === "string" ? raw.token : "";
      const entry = demoTokens.get(token);
      demoTokens.delete(token);
      if (!entry || entry.expiresAt < Date.now()) throw new InvalidLogin();
      return { id: entry.userId };
    },
  }),
];

if (googleEnabled) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        // Only trust Google accounts whose email Google has verified.
        return Boolean(profile?.email && profile.email_verified);
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const { findOrCreateGoogleUser } = await import("../users");
        const dbUser = await findOrCreateGoogleUser(profile.email.toLowerCase());
        token.sub = dbUser.id;
      } else if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

export { googleEnabled };
