import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { api } from "@/lib/api";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.JWT_ACCESS_SECRET,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const result = await api.login({ email: credentials.email, password: credentials.password });
        return {
          id: result.data.user.id,
          email: result.data.user.email,
          name: result.data.user.fullName,
          role: result.data.user.role,
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken,
          redirectTo: (result.data as typeof result.data & { redirectTo?: string }).redirectTo
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.redirectTo = user.redirectTo;
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          role: token.role,
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          redirectTo: token.redirectTo
        }
      };
    }
  },
  pages: { signIn: "/login" }
};
