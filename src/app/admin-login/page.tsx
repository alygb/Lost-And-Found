"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Step 1 — Sign in with Supabase
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    // Step 2 — Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_banned")
      .eq("id", data.user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      await supabase.auth.signOut();
      setError("Access denied. You are not an admin.");
      setLoading(false);
      return;
    }

    if (profile.is_banned) {
      await supabase.auth.signOut();
      setError("Your account has been suspended.");
      setLoading(false);
      return;
    }

    // Step 3 — Admin verified, go to admin panel
    window.open("/admin", "_blank");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-blue-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-4xl">⭐</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Admin Portal</h1>
          <p className="text-blue-300 mt-2">CampusLostFound Management System</p>
          <div className="w-16 h-1 bg-yellow-400 mx-auto mt-3 rounded-full"></div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
            🔐 Admin Sign In
          </h2>

          <form onSubmit={handleAdminLogin} className="flex flex-col gap-5">

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                placeholder="admin@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 rounded-lg transition text-lg disabled:opacity-50 mt-2"
            >
              {loading ? "Verifying..." : "🔐 Login to Admin Panel"}
            </button>

          </form>

          {/* Security Notice */}
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-yellow-700 text-xs text-center">
              🔒 This portal is restricted to authorized administrators only.
              Unauthorized access attempts are monitored.
            </p>
          </div>

        </div>

        {/* Back to main site */}
        <p className="text-center text-blue-300 text-sm mt-6">
          Not an admin?{" "}
          <a href="/" className="text-yellow-400 hover:underline font-medium">
            Go to main site →
          </a>
        </p>

      </div>
    </div>
  );
}