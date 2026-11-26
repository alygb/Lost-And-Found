"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import ChatThread, { type ChatMessage } from "./ChatThread";

type Profile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

type Thread = {
  userId: string;
  last: ChatMessage;
  unread: number;
};

type Props = {
  adminId: string;
  users: Profile[];
  selectedUserId: string | null;
  onSelectUser: (userId: string | null) => void;
};

async function fetchThreads(): Promise<{ threads: Thread[]; error: string }> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return {
      threads: [],
      error: error.message.includes("messages")
        ? "The messages table is missing. Run supabase/migrations/20261120000000_user_admin_messages.sql in the Supabase SQL editor."
        : error.message,
    };
  }

  const byUser = new Map<string, Thread>();
  (data as ChatMessage[]).forEach((m) => {
    const t = byUser.get(m.user_id);
    const unread = !m.read_by_admin && m.sender_id === m.user_id ? 1 : 0;
    if (!t) byUser.set(m.user_id, { userId: m.user_id, last: m, unread });
    else t.unread += unread;
  });
  return { threads: [...byUser.values()], error: "" };
}

export default function AdminInbox({ adminId, users, selectedUserId, onSelectUser }: Props) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const userById = useMemo(() => {
    const map = new Map<string, Profile>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const applyResult = useCallback((r: { threads: Thread[]; error: string }) => {
    setThreads(r.threads);
    setError(r.error);
    setLoading(false);
  }, []);

  const loadThreads = useCallback(async () => {
    applyResult(await fetchThreads());
  }, [applyResult]);

  useEffect(() => {
    let cancelled = false;
    fetchThreads().then((r) => {
      if (!cancelled) applyResult(r);
    });
    const channel = supabase
      .channel("messages-admin-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => loadThreads())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [applyResult, loadThreads]);

  const nameOf = (id: string) => {
    const u = userById.get(id);
    return u?.full_name || u?.email || "Unknown user";
  };

  // Threads first (most recent), then any other user the admin can start a chat with.
  const q = search.toLowerCase();
  const matches = (id: string) => {
    const u = userById.get(id);
    return !q || u?.full_name?.toLowerCase().includes(q) || u?.email?.toLowerCase().includes(q);
  };
  const threadIds = new Set(threads.map((t) => t.userId));
  const visibleThreads = threads.filter((t) => matches(t.userId));
  const otherUsers = q
    ? users.filter((u) => u.role !== "admin" && !threadIds.has(u.id) && matches(u.id))
    : [];

  const selected = selectedUserId ? userById.get(selectedUserId) : null;

  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[70vh] min-h-[480px]">
        {/* Conversation list */}
        <div className={`border-r border-gray-100 flex flex-col min-h-0 ${selectedUserId ? "hidden md:flex" : "flex"}`}>
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">Messages</h2>
            <p className="text-xs text-gray-400 mb-3">Private conversations with users</p>
            <input
              type="text"
              placeholder="Search users to start a chat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-6 text-center text-sm text-gray-400">Loading...</p>
            ) : error ? (
              <p className="m-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">⚠️ {error}</p>
            ) : (
              <>
                {visibleThreads.length === 0 && otherUsers.length === 0 && (
                  <p className="p-6 text-center text-sm text-gray-400">
                    {q ? "No users match your search." : "No conversations yet. Search for a user to start one."}
                  </p>
                )}
                {visibleThreads.map((t) => (
                  <button
                    key={t.userId}
                    onClick={() => onSelectUser(t.userId)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${selectedUserId === t.userId ? "bg-blue-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-gray-800 truncate">{nameOf(t.userId)}</p>
                      {t.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{t.unread}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {t.last.sender_id === t.userId ? "" : "You: "}
                      {t.last.body}
                    </p>
                    <p className="text-[11px] text-gray-300">{new Date(t.last.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</p>
                  </button>
                ))}
                {otherUsers.length > 0 && (
                  <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase text-gray-400">Start new chat</p>
                )}
                {otherUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => onSelectUser(u.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${selectedUserId === u.id ? "bg-blue-50" : ""}`}
                  >
                    <p className="font-semibold text-sm text-gray-800 truncate">{u.full_name || u.email}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Thread */}
        <div className={`flex flex-col min-h-0 ${selectedUserId ? "flex" : "hidden md:flex"}`}>
          {selectedUserId ? (
            <>
              <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                <button onClick={() => onSelectUser(null)} className="md:hidden text-sm text-blue-700 font-semibold">← Back</button>
                <div className="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-sm">
                  {nameOf(selectedUserId).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{nameOf(selectedUserId)}</p>
                  <p className="text-xs text-gray-400 truncate">{selected?.email}</p>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ChatThread
                  key={selectedUserId}
                  threadUserId={selectedUserId}
                  currentUserId={adminId}
                  otherLabel={(senderId) => (senderId === selectedUserId ? nameOf(senderId) : `${nameOf(senderId)} (Admin)`)}
                  onActivity={loadThreads}
                  canDeleteAny
                  emptyText="No messages yet. Send the first message to this user."
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
              <p className="text-5xl mb-3">💬</p>
              <p className="text-gray-500 text-sm">Select a conversation to read and reply.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
