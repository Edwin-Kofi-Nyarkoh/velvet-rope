import { Suspense } from "react";
import { OtpForm } from "@/components/otp-form";
import { PublicNav } from "@/components/shell";

export default function VerifyOtpPage() {
  return (
    <div>
      <PublicNav />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4">
        <Suspense fallback={null}>
          <OtpForm />
        </Suspense>
      </main>
    </div>
  );
}
