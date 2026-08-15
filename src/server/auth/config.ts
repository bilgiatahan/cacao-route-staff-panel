import type { NextAuthConfig } from "next-auth";

import { ROUTES } from "@/lib/routes";

/**
 * Base Auth.js config with no provider and no database access, so it stays
 * cheap to evaluate. The credentials provider is added in `./index.ts`.
 */
export const authConfig = {
  pages: {
    signIn: ROUTES.login,
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8, // one shift
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.employeeId = user.employeeId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = token.role;
      session.user.employeeId = token.employeeId;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
