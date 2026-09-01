"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">

      {/* Left Side — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-blue-900 via-blue-800 to-blue-600 flex-col items-center justify-center px-12 relative overflow-hidden">

        {/* Background circles */}
        <div className="absolute -top [-80px] -left [-80px] w-80 h-80 bg-blue-500 opacity-20 rounded-full"></div>
        <div className="absolute -bottom [-60px] -right[-60px] w-64 h-64 bg-yellow-400 opacity-10 rounded-full"></div>
        <div className="absolute top-1/2 -left [-40px] w-40 h-40 bg-blue-300 opacity-10 rounded-full"></div>

        {/* Content */}
        <div className="relative z-10 text-center text-white">
          <div className="w-24 h-24 bg-yellow-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <span className="text-5xl">🎓</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">Lost & Found</h1>
          <p className="text-blue-200 text-lg mb-8">University Item Recovery System</p>

          <div className="flex flex-col gap-4 text-left mt-8">
            <div className="flex items-center gap-3 bg-white bg-opacity-10 rounded-xl px-5 py-3">
              <span className="text-2xl">🤖</span>
              <div>
                <p className="font-semibold text-sm">AI-Powered Matching</p>
                <p className="text-blue-200 text-xs">Smart algorithm finds your items</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white bg-opacity-10 rounded-xl px-5 py-3">
              <span className="text-2xl">🔔</span>
              <div>
                <p className="font-semibold text-sm">Real-time Notifications</p>
                <p className="text-blue-200 text-xs">Get notified when items are found</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white bg-opacity-10 rounded-xl px-5 py-3">
              <span className="text-2xl">🔐</span>
              <div>
                <p className="font-semibold text-sm">Secure & Verified</p>
                <p className="text-blue-200 text-xs">Admin verified item handover</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side — Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">

          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">🎓</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Lost & Found</h1>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800">Welcome back!</h2>
            <p className="text-gray-500 mt-1">Sign in to your account to continue</p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📧</span>
                  <input
                    type="email"
                    name="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 text-gray-800 placeholder-gray-400 transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 text-gray-800 placeholder-gray-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-500 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600" />
                  Remember me
                </label>
                <a href="#" className="text-blue-600 hover:text-blue-800 font-medium hover:underline">
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3.5 rounded-xl transition text-base disabled:opacity-50 shadow-lg shadow-blue-200 mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Signing in...
                  </span>
                ) : "Sign In →"}
              </button>

            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200"></div>
              <p className="text-gray-400 text-xs">OR</p>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            {/* Register Link */}
            <p className="text-center text-gray-500 text-sm">
              Don't have an account?{" "}
              <Link href="/register" className="text-blue-700 hover:text-blue-900 font-semibold hover:underline">
                Create one free →
              </Link>
            </p>

          </div>

          

        </div>
      </div>

    </div>
  );
}