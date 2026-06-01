"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function BannedPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-xl p-10">
          <div className="text-6xl mb-6">🚫</div>
          <h1 className="text-3xl font-bold text-red-600 mb-4">
            Account Suspended
          </h1>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Your account has been removed by the administrator. You are no longer able to access the Lost & Found system or perform any activities such as reporting lost or found items.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-600 text-sm font-medium">
              If you believe this was a mistake, please contact the university administration.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}