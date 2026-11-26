"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type ChatMessage = {
  id: string;
  user_id: string;
  sender_id: string;
  body: string;
  read_by_user: boolean;
  read_by_admin: boolean;
  created_at: string;
};

type Props = {
  /** The regular user who owns this conversation. */
  threadUserId: string;
  /** The person currently looking at the screen. */
  currentUserId: string;
  /** Label for messages not written by the current viewer. */
  otherLabel: (senderId: string) => string;
  /** Called after a message arrives or is sent, so lists can refresh. */
  onActivity?: () => void;
  emptyText?: string;
  /** Admins may delete any message in the thread; users only their own. */
  canDeleteAny?: boolean;
};

const DELETE_MIGRATION_HINT =
  "Could not delete. Make sure supabase/migrations/20261126000000_delete_messages.sql has been run in the Supabase SQL editor.";

export default function ChatThread({
  threadUserId,
  currentUserId,
  otherLabel,
  onActivity,
  emptyText = "No messages yet. Say hello!",
  canDeleteAny = false,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmMsgId, setConfirmMsgId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  useEffect(() => {
    // Parents give this component a new `key` per conversation, so state starts fresh.
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", threadUserId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (cancelled) return;
      if (error) setError(error.message);
      setMessages((data as ChatMessage[]) || []);
      setLoading(false);
      await supabase.rpc("mark_messages_read", { p_user_id: threadUserId });
      onActivityRef.current?.();
    };
    load();

    const channel = supabase
      .channel(`messages-thread-${threadUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${threadUserId}` },
        async (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.sender_id !== currentUserId) {
            await supabase.rpc("mark_messages_read", { p_user_id: threadUserId });
          }
          onActivityRef.current?.();
        }
      )
      // DELETE events cannot be filtered by column, so match on id against what we have.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const oldId = (payload.old as { id?: string })?.id;
          if (!oldId) return;
          setMessages((prev) => (prev.some((m) => m.id === oldId) ? prev.filter((m) => m.id !== oldId) : prev));
          onActivityRef.current?.();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [threadUserId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");

    const { data, error } = await supabase
      .from("messages")
      .insert({ user_id: threadUserId, sender_id: currentUserId, body })
      .select()
      .single();

    if (error) {
      setError(error.message);
    } else if (data) {
      setDraft("");
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]));
      onActivityRef.current?.();
    }
    setSending(false);
  };

  const deleteMessage = async (id: string) => {
    if (deleting) return;
    setDeleting(true);
    setError("");
    const { data, error } = await supabase.from("messages").delete().eq("id", id).select("id");
    if (error) setError(error.message);
    else if (!data || data.length === 0) setError(DELETE_MIGRATION_HINT);
    else {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      onActivityRef.current?.();
    }
    setConfirmMsgId(null);
    setDeleting(false);
  };

  const deleteChat = async () => {
    if (deleting) return;
    setDeleting(true);
    setError("");
    const { data, error } = await supabase.from("messages").delete().eq("user_id", threadUserId).select("id");
    if (error) setError(error.message);
    else if (!data || data.length === 0) setError(DELETE_MIGRATION_HINT);
    else {
      const gone = new Set(data.map((r) => r.id as string));
      setMessages((prev) => prev.filter((m) => !gone.has(m.id)));
      onActivityRef.current?.();
    }
    setConfirmClear(false);
    setDeleting(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {messages.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-white/70 px-4 py-1.5 text-xs">
          <span className="text-gray-400">
            {messages.length} message{messages.length === 1 ? "" : "s"}
          </span>
          {confirmClear ? (
            <span className="flex items-center gap-2">
              <span className="font-medium text-red-600">Delete the whole chat for everyone?</span>
              <button
                onClick={deleteChat}
                disabled={deleting}
                className="rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="rounded-md px-2 py-1 font-semibold text-gray-500 transition hover:bg-gray-100"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => {
                setConfirmMsgId(null);
                setConfirmClear(true);
              }}
              className="flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-gray-500 transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete chat
            </button>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">{emptyText}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              const canDelete = mine || canDeleteAny;
              const confirming = confirmMsgId === m.id;
              const deleteControl = canDelete && (
                confirming ? (
                  <span className="flex shrink-0 items-center gap-1 self-center text-xs">
                    <button
                      onClick={() => deleteMessage(m.id)}
                      disabled={deleting}
                      className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "..." : "Delete"}
                    </button>
                    <button
                      onClick={() => setConfirmMsgId(null)}
                      className="rounded-md px-1.5 py-1 font-semibold text-gray-500 transition hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setConfirmClear(false);
                      setConfirmMsgId(m.id);
                    }}
                    className="shrink-0 self-center rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Delete message"
                    title="Delete message"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )
              );
              return (
                <div key={m.id} className={`group flex items-start gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                  {mine && deleteControl}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mine ? "bg-blue-700 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                    {!mine && (
                      <p className="mb-0.5 text-xs font-semibold text-blue-700">{otherLabel(m.sender_id)}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                    <p className={`mt-1 text-[11px] ${mine ? "text-blue-200" : "text-gray-400"}`}>
                      {new Date(m.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  {!mine && deleteControl}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && (
        <p className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">⚠️ {error}</p>
      )}

      <form onSubmit={send} className="flex items-end gap-2 border-t border-gray-100 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50"
        >
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
