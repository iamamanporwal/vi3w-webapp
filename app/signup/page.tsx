"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

export default function SignupPage() {
  const { signUpWithEmail, user, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: ""
  });

  useEffect(() => {
    // Only redirect if we have a user AND we are not currently loading
    // This prevents premature redirects or loops
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (user) {
    return null;
  }

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      await signInWithGoogle();
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signUpWithEmail(formData.email, formData.password, formData.name);
    } catch (error: any) {
      let message = "Failed to create account.";
      if (error.code === 'auth/email-already-in-use') {
        message = "Email already in use.";
      } else if (error.code === 'auth/weak-password') {
        message = "Password should be at least 6 characters.";
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-gray-800 bg-gray-900/50 p-8 shadow-2xl backdrop-blur-sm">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">
            Create an account
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Start creating 3D models today
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="sr-only">Full Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="relative block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 sm:text-sm"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 sm:text-sm"
                placeholder="Email address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="relative block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 sm:text-sm"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="group relative flex w-full justify-center rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign Up"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gray-900 px-2 text-gray-400">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-100 transition-all cursor-pointer"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.04-3.71 1.04-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-purple-400 hover:text-purple-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

