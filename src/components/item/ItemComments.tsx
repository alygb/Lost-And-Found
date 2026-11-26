"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Lock, MessageSquare, Send, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { validateComment } from "@/lib/validation";
import { processPost } from "@/lib/processPost";

type Comment = {
  id: string;
  item_id: string;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  body: string;
  created_at: string;
};

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
      {name?.trim().charAt(0).toUpperCase() || "U"}
    </span>
  );
}

/** Public comment thread under a lost/found item. The item owner is notified by a database trigger. */
export default function ItemComments({
  itemId,
  itemType,
  ownerId,
  currentUserId,
  isAdmin,
  adminIds = [],
}: {
  itemId: string;
  itemType: "lost" | "found";
  ownerId: string;
  currentUserId: string;
  isAdmin: boolean;
  adminIds?: string[];
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState("");
  const [tried, setTried] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const listEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("comments")
      .select("*")
      .eq("item_id", itemId)
      .order("created_at", { ascending: true })
      .limit(300)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setMissing(error.message.includes("comments"));
        setComments((data as Comment[]) || []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`comments-${itemId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments", filter: `item_id=eq.${itemId}` }, (p) => {
        const c = p.new as Comment;
        setComments((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "comments" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) setComments((prev) => prev.filter((x) => x.id !== id));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [itemId]);

  const err = validateComment(draft);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (err || posting) return;
    setPosting(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({ item_id: itemId, item_type: itemType, user_id: currentUserId, body: draft.trim() })
      .select()
      .single();
    setPosting(false);
    if (error) {
      setError(
        error.message.includes("comments")
          ? "Comments are not set up yet. Ask the admin to run the item_comments SQL in Supabase."
          : error.message.includes("row-level security")
            ? "You can't comment right now. Your account may be suspended."
            : error.message
      );
      return;
    }
    setDraft("");
    setTried(false);
    if (data?.id) processPost("comment", data.id);
    if (data) setComments((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Comment]));
    setTimeout(() => listEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this comment?")) return;
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) return setError(error.message);
    setComments((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <MessageSquare className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">Comments</h2>
            <p className="text-xs text-slate-500">Seen this item? Share where or when. The {itemType === "lost" ? "owner" : "finder"} gets notified.</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{comments.length}</span>
      </div>

      {/* List */}
      <div className="max-h-[460px] space-y-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        {loading ? (
          [0, 1].map((i) => (
            <div key={i} className="flex animate-pulse gap-3 py-2">
              <div className="h-9 w-9 rounded-full bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-slate-100" />
                <div className="h-3 w-3/4 rounded bg-slate-100" />
              </div>
            </div>
          ))
        ) : missing ? (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Comments are not set up yet. Run the item_comments SQL in Supabase.</p>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-slate-200" />
            <p className="mt-2 text-sm font-semibold text-slate-600">No comments yet</p>
            <p className="text-xs text-slate-400">Be the first to help. Even a small detail can bring it home.</p>
          </div>
        ) : (
          comments.map((c) => {
            const mine = c.user_id === currentUserId;
            const isOwner = c.user_id === ownerId;
            const byAdmin = adminIds.includes(c.user_id);
            return (
              <div key={c.id} className="animate-fade-up group flex gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50">
                <Avatar name={c.author_name} url={c.author_avatar} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-bold text-slate-900">{c.author_name?.trim() || "User"}</span>
                    {isOwner && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        {itemType === "lost" ? "OWNER" : "FINDER"}
                      </span>
                    )}
                    {byAdmin && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        <ShieldCheck className="h-3 w-3" /> ADMIN
                      </span>
                    )}
                    {mine && !isOwner && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">YOU</span>}
                    <span className="text-xs text-slate-400" title={new Date(c.created_at).toLocaleString()}>· {timeAgo(c.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{c.body}</p>
                </div>
                {(mine || isAdmin) && (
                  <button
                    onClick={() => remove(c.id)}
                    className="h-8 w-8 shrink-0 rounded-lg text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 max-sm:opacity-100"
                    title="Delete comment"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="mx-auto h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={listEnd} />
      </div>

      {/* Composer */}
      <div className="border-t border-slate-100 bg-slate-50/60 p-4">
        {currentUserId ? (
          <form onSubmit={post} noValidate>
            {error && (
              <p className="animate-fade-down mb-2 flex items-start gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {error}
              </p>
            )}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) post(e);
              }}
              rows={2}
              maxLength={1000}
              placeholder={`e.g. "I think I saw this near the bus stand on Monday evening."`}
              className={`w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:ring-2 ${
                tried && err ? "border-rose-300 focus:ring-rose-200" : "border-slate-200 focus:border-brand focus:ring-blue-100"
              }`}
            />
            {tried && err && (
              <p className="animate-fade-down mt-1 flex items-start gap-1.5 text-xs font-medium text-rose-600">
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {err}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="flex items-center gap-1 text-[11px] text-slate-400">
                <Lock className="h-3 w-3" /> Public · don&apos;t share phone numbers or emails
              </p>
              <div className="flex items-center gap-3">
                <span className="hidden text-[11px] text-slate-400 sm:inline">{draft.length}/1000</span>
                <button
                  type="submit"
                  disabled={posting || !draft.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white shadow-glow transition hover:bg-brand-dark disabled:opacity-50 disabled:shadow-none"
                >
                  <Send className="h-4 w-4" /> {posting ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-slate-600">Sign in to leave a comment.</p>
            <Link href="/login" className="rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-dark">
              Sign in
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
