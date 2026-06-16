import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { PublicNav } from "@/components/shell";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-vr-black">
      <PublicNav />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-12">
        <div className="w-full">
          <Suspense fallback={null}>
            <AuthForm mode="login" />
          </Suspense>
          <div className="mt-4 flex justify-between text-sm text-vr-muted">
            <Link href="/forgot-password" className="hover:text-vr-gold transition-colors">
              Forgot password?
            </Link>
            <Link href="/register" className="hover:text-vr-gold transition-colors">
              No account? Sign up
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
