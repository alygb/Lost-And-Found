"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ChatThread from "@/components/chat/ChatThread";

export default function MessagesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setIsAdmin(profile?.role === "admin");
      setUserId(user.id);
      setChecking(false);
    };
    check();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-white rounded-2xl shadow p-8">
          <p className="text-4xl mb-3">💬</p>
          <h1 className="text-xl font-bold text-gray-800 mb-2">You are an admin</h1>
          <p className="text-gray-500 text-sm mb-5">
            Admins read and answer user conversations from the Messages tab in the admin panel.
          </p>
          <Link href="/admin" className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl text-sm">
            Open admin panel →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <h1 className="text-3xl font-bold text-gray-800">Messages</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Chat privately with the AJK Lost &amp; Found admin team. Only you and the admins can see this conversation.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow overflow-hidden flex flex-col h-[70vh] min-h-[460px]">
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-yellow-400 text-blue-900 flex items-center justify-center font-bold">⭐</div>
            <div>
              <p className="font-semibold text-gray-800">Admin Team</p>
              <p className="text-xs text-gray-400">Usually replies within a day</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {userId && (
              <ChatThread
                key={userId}
                threadUserId={userId}
                currentUserId={userId}
                otherLabel={() => "Admin"}
                emptyText="No messages yet. Ask the admin team about a lost or found item."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
