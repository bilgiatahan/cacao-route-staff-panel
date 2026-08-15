import type { DefaultSession } from "next-auth";

import type { UserRole } from "@/types/domain";

/**
 * Auth.js carries only `id`/`email`/`name` by default. The panel additionally
 * needs the role and the employee record the account is attached to.
 */
declare module "next-auth" {
  interface User {
    role: UserRole;
    employeeId: string;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      employeeId: string;
    } & DefaultSession["user"];
  }
}

/**
 * `next-auth/jwt` only re-exports `@auth/core/jwt`, so the JWT interface has to
 * be augmented on the core module for the extra claims to be visible.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    role: UserRole;
    employeeId: string;
  }
}

export {};
