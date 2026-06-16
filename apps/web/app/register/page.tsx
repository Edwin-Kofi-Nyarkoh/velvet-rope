import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { PublicNav } from "@/components/shell";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-vr-black">
      <PublicNav />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-12">
        <Suspense fallback={null}>
          <AuthForm mode="register" />
        </Suspense>
      </main>
    </div>
  );
}
