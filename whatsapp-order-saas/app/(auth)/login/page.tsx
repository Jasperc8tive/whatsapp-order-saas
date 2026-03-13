import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in — OrderFlow",
};

export default function LoginPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to your vendor dashboard</p>
      </div>
      {/* Suspense required because LoginForm reads useSearchParams() */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
