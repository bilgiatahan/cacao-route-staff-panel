import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

import { fullName } from "@/lib/format";
import { employeeRepository } from "@/server/repositories/employee.repository";
import { userRepository } from "@/server/repositories/user.repository";

import { authConfig } from "./config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await userRepository.findByEmail(email);
        if (!user) return null;

        const passwordMatches = await compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        const employee = await employeeRepository.findById(user.employeeId);
        if (!employee) return null;

        return {
          id: user.id,
          email: user.email,
          name: fullName(employee.firstName, employee.lastName),
          role: employee.role,
          employeeId: employee.id,
        };
      },
    }),
  ],
});
