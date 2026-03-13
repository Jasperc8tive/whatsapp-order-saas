import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create account — OrderFlow",
};

export default function SignupPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Start for free</h1>
        <p className="text-sm text-gray-500 mt-1">Create your vendor account in seconds</p>
      </div>
      <SignupForm />
    </>
  );
}
