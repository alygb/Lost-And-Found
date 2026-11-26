"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, CheckCircle2, ExternalLink, Flag, Loader2, MessageSquare, Package, Search, ShieldAlert, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export type ModerationFlag = {
  id: string;
  target_type: "lost" | "found" | "comment";
  target_id: string;
  item_id: string | null;
  user_id: string | null;
  score: number;
  flags: string[];
  reason: string | null;
  excerpt: string | null;
  status: "open" | "dismissed" | "removed";
  created_at: string;
};

type UserLite = { id: string; full_name: string | null; email: string | null; is_banned?: boolean; role?: string | null; is_super_admin?: boolean };

const LABELS: Record<string, string> = {
  money_request: "Asks for money",
  external_link: "Outside link",
  personal_data: "CNIC / card number",
  contact_in_comment: "Phone in public comment",
  duplicate_self: "Repeated report",
  duplicate_other: "Copied from another user",
  flooding: "Too many posts",
  scam: "Possible scam",
  spam: "Spam / advert",
  fake: "Looks fake",
  abusive: "Abusive",
};

const KIND = {
  lost: { label: "Lost report", icon: Search, table: "lost_items", chip: "bg-rose-50 text-rose-700" },
  found: { label: "Found report", icon: Package, table: "found_items", chip: "bg-emerald-50 text-emerald-700" },
  comment: { label: "Comment", icon: MessageSquare, table: "comments", chip: "bg-blue-50 text-blue-700" },
} as const;

const MIGRATION_HINT =
  "The moderation_flags table is missing. Run supabase/migrations/20261128000000_ai_matching_moderation.sql in the Supabase SQL editor.";

type Props = {
  adminId: string;
  users: UserLite[];
  /** Can the current admin ban this user? */
  canBan: (userId: string) => boolean;
  onBan: (userId: string) => void;
  /** Called after content is removed so the admin lists can drop it. */
  onRemoved: (type: "lost" | "found" | "comment", id: string) => void;
  onOpenCount: (n: number) => void;
  onToast: (t: { ok: boolean; text: string }) => void;
};

export default function FlaggedReports({ adminId, users, canBan, onBan, onRemoved, onOpenCount, onToast }: Props) {
  const [view, setView] = useState<"open" | "reviewed">("open");
  const [flags, setFlags] = useState<ModerationFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [removing, setRemoving] = useState<ModerationFlag | null>(null);

  const load = useCallback(async () => {
    const q = supabase.from("moderation_flags").select("*").order("created_at", { ascending: false }).limit(200);
    const { data, error } = await (view === "open" ? q.eq("status", "open") : q.neq("status", "open"));
    return { data: (data as ModerationFlag[]) || [], error: error ? (error.message.includes("moderation_flags") ? MIGRATION_HINT : error.message) : "" };
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    load().then((r) => {
      if (cancelled) return;
      setFlags(r.data);
      setError(r.error);
      setLoading(false);
      if (view === "open" && !r.error) onOpenCount(r.data.length);
    });
    return () => {
      cancelled = true;
    };
  }, [load, view, onOpenCount]);

  const userName = (id: string | null) => {
    const u = users.find((x) => x.id === id);
    return u?.full_name || u?.email || "Unknown user";
  };

  const review = async (f: ModerationFlag, status: "dismissed" | "removed") => {
    const { error } = await supabase
      .from("moderation_flags")
      .update({ status, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
      .eq("id", f.id);
    if (error) {
      onToast({ ok: false, text: error.message });
      return false;
    }
    setFlags((list) => {
      const next = list.filter((x) => x.id !== f.id);
      if (view === "open") onOpenCount(next.length);
      return next;
    });
    return true;
  };

  const dismiss = async (f: ModerationFlag) => {
    setBusyId(f.id);
    if (await review(f, "dismissed")) onToast({ ok: true, text: "Marked as safe." });
    setBusyId("");
  };

  const remove = async () => {
    const f = removing;
    if (!f) return;
    setBusyId(f.id);
    const { error } = await supabase.from(KIND[f.target_type].table).delete().eq("id", f.target_id);
    if (error) {
      onToast({ ok: false, text: "Could not delete: " + error.message });
    } else if (await review(f, "removed")) {
      onRemoved(f.target_type, f.target_id);
      onToast({ ok: true, text: `${KIND[f.target_type].label} deleted.` });
    }
    setBusyId("");
    setRemoving(null);
  };

  const scoreTone = (s: number) => (s >= 80 ? "bg-rose-600" : s >= 65 ? "bg-orange-500" : "bg-amber-500");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-slate-900">Scam &amp; fake-report detection</p>
            <p className="text-xs text-slate-500">
              New reports and comments are checked automatically by rules and AI. Nothing is removed without you. Review each one below.
            </p>
          </div>
        </div>
        <div className="flex rounded-full bg-slate-100 p-1">
          {(["open", "reviewed"] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                setLoading(true);
                setView(v);
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${view === v ? "bg-white text-slate-900 shadow" : "text-slate-500 hover:text-slate-800"}`}
            >
              {v === "open" ? "Needs review" : "Reviewed"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-white p-10 text-sm text-slate-400 shadow-card">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading flags…
        </div>
      ) : error ? (
        <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">⚠️ {error}</p>
      ) : flags.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <p className="mt-3 font-bold text-slate-800">{view === "open" ? "Nothing suspicious right now" : "No reviewed flags yet"}</p>
          <p className="text-sm text-slate-500">Flagged reports and comments will appear here.</p>
        </div>
      ) : (
        flags.map((f) => {
          const k = KIND[f.target_type];
          const author = users.find((u) => u.id === f.user_id);
          return (
            <article
              key={f.id}
              id={`flag-${f.target_type}-${f.target_id}`}
              className="animate-fade-up overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card"
            >
              <div className="flex flex-wrap items-start gap-4 p-5">
                <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-white ${scoreTone(f.score)}`}>
                  <span className="text-lg font-extrabold leading-none">{f.score}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide opacity-90">risk</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${k.chip}`}>
                      <k.icon className="h-3 w-3" /> {k.label}
                    </span>
                    {f.flags.map((x) => (
                      <span key={x} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                        <Flag className="h-3 w-3" /> {LABELS[x] || x}
                      </span>
                    ))}
                    {f.status !== "open" && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                        {f.status === "removed" ? "Deleted" : "Marked safe"}
                      </span>
                    )}
                  </div>
                  {f.reason && <p className="mt-2 text-sm font-medium text-slate-800">{f.reason}</p>}
                  {f.excerpt && (
                    <p dir="auto" className="mt-2 line-clamp-3 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {f.excerpt}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    By <span className="font-semibold text-slate-600">{userName(f.user_id)}</span>
                    {author?.is_banned && <span className="ml-1 font-bold text-rose-600">(banned)</span>} ·{" "}
                    {new Date(f.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                {f.item_id && f.status !== "removed" && (
                  <Link
                    href={`/item/${f.item_id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> View
                  </Link>
                )}
                {f.status === "open" && (
                  <>
                    {f.user_id && !author?.is_banned && canBan(f.user_id) && (
                      <button
                        onClick={() => onBan(f.user_id!)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        <Ban className="h-3.5 w-3.5" /> Ban user
                      </button>
                    )}
                    <button
                      onClick={() => setRemoving(f)}
                      disabled={busyId === f.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete {f.target_type === "comment" ? "comment" : "report"}
                    </button>
                    <button
                      onClick={() => dismiss(f)}
                      disabled={busyId === f.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busyId === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} It&apos;s fine
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })
      )}

      <ConfirmDialog
        open={!!removing}
        tone="rose"
        icon={<Trash2 className="h-8 w-8" />}
        title={`Delete this ${removing?.target_type === "comment" ? "comment" : "report"}?`}
        description="It will be removed from the website for everyone. This cannot be undone."
        points={removing?.reason ? [removing.reason] : undefined}
        confirmLabel="Yes, delete"
        busy={!!removing && busyId === removing.id}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
