"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptInvitation } from "@/lib/actions/team";

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const hasToken = !!token;

  const [isLoading, setIsLoading] = useState(hasToken);
  const [error, setError] = useState<string | null>(
    hasToken ? null : "No invitation token provided. Check your invitation link."
  );
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;

    const accept = async () => {
      try {
        const result = await acceptInvitation(token);

        if (result.error) {
          setError(result.error);
        } else if (result.ok) {
          setSuccess(true);

          // Redirect after delay
          setTimeout(() => {
            router.push("/dashboard");
          }, 2000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    accept();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">

        {isLoading && (
          <>
            <div className="flex justify-center mb-4">
              <svg className="w-12 h-12 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Accepting invitation...</h1>
            <p className="text-gray-600">Please wait while we set up your account.</p>
          </>
        )}

        {error && !isLoading && (
          <>
            <div className="flex justify-center mb-4">
              <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 0v2m0-8v-2m0 0v-2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 6.41L5.41 20" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invitation Failed</h1>
            <p className="text-red-600 mb-6">{error}</p>
            <a
              href="/login"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Back to Login
            </a>
          </>
        )}

        {success && (
          <>
            <div className="flex justify-center mb-4">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invitation Accepted!</h1>
            <p className="text-gray-600 mb-6">
              You&apos;re now part of the workspace. Redirecting to dashboard...
            </p>
          </>
        )}

      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="flex justify-center mb-4">
              <svg className="w-12 h-12 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Loading invitation...</h1>
            <p className="text-gray-600">Please wait while we prepare this page.</p>
          </div>
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}