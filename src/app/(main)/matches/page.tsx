"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  ArrowRight, Calendar, Camera, CheckCircle2, Clock, Eye, Hand, MapPin, Package, RefreshCw, Search,
  SearchX, ShieldAlert, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { notifyClaim } from "@/lib/notify";

type Item = {
  id: string;
  item_name: string;
  category: string;
  location: string;
  description?: string;
  date_lost?: string;
  date_found?: string;
  image_urls?: string[] | null;
  image_url?: string | null;
  ai_image_urls?: string[] | null;
};
type ApiMatch = { id: string; score: number; reason: string; photoScore: number | null; photoNote?: string; signals: string[]; ai: boolean };
type Match = ApiMatch & { foundItem: Item };

const STEPS = [
  { icon: Search, text: "Pick your lost item" },
  { icon: Sparkles, text: "AI scans found items" },
  { icon: Hand, text: "Claim the right match" },
  { icon: ShieldCheck, text: "Admin verifies & hands over" },
];

const SCAN_LINES = [
  "Comparing categories…",
  "Understanding descriptions in English and Urdu…",
  "Checking districts, places and dates…",
  "Comparing photos side by side…",
  "Ranking the best matches…",
];

const img = (i?: Item | null) => i?.image_urls?.[0] || i?.image_url || "";

const scoreTone = (s: number) =>
  s >= 80
    ? { ring: "#10b981", text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700", label: "High match" }
    : s >= 50
      ? { ring: "#f59e0b", text: "text-amber-600", chip: "bg-amber-50 text-amber-700", label: "Possible match" }
      : { ring: "#f43f5e", text: "text-rose-600", chip: "bg-rose-50 text-rose-700", label: "Low match" };

function ItemImage({ item, kind, className }: { item?: Item | null; kind: "lost" | "found"; className: string }) {
  const src = img(item);
  return src ? (
    <div className={`${className} relative overflow-hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={item?.item_name || ""} className="h-full w-full object-cover" />
      {item?.ai_image_urls?.includes(src) && (
        <span title="AI-generated image" className="absolute bottom-1 left-1 rounded bg-violet-600 px-1 text-[9px] font-bold text-white">AI</span>
      )}
    </div>
  ) : (
    <div className={`${className} flex items-center justify-center ${kind === "lost" ? "bg-rose-50 text-rose-300" : "bg-emerald-50 text-emerald-300"}`}>
      {kind === "lost" ? <Search className="h-8 w-8" /> : <Package className="h-8 w-8" />}
    </div>
  );
}

/** Circular score that fills up when it appears. */
function ScoreRing({ score }: { score: number }) {
  const tone = scoreTone(score);
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={tone.ring}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: c * (1 - score / 100), animation: "ring-fill 1.2s cubic-bezier(0.22,1,0.36,1) both", ["--ring-c" as string]: `${c}` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-extrabold ${tone.text}`}>{score}%</span>
      </div>
    </div>
  );
}

export default function MatchesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [lostItems, setLostItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingItems, setFetchingItems] = useState(true);
  const [error, setError] = useState("");
  const [claimingId, setClaimingId] = useState("");
  const [claimedItems, setClaimedItems] = useState<string[]>([]);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanLine, setScanLine] = useState(0);
  const findMatchesRef = useRef<(item: Item) => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const [lost, existing] = await Promise.all([
        supabase.from("lost_items").select("*").eq("user_id", user.id).eq("status", "searching").order("created_at", { ascending: false }),
        supabase.from("matches").select("found_item_id").eq("lost_user_id", user.id),
      ]);
      if (cancelled) return;
      setUser(user);
      setClaimedItems(existing.data?.map((m) => m.found_item_id) || []);
      setLostItems(lost.data || []);
      setFetchingItems(false);
      // Opened from a match alert (notification link): scan that lost item straight away
      const wanted = new URLSearchParams(window.location.search).get("lost");
      const item = wanted && (lost.data || []).find((l) => l.id === wanted);
      if (item) findMatchesRef.current(item);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Rotate the "scanning" text while the AI works
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setScanLine((n) => (n + 1) % SCAN_LINES.length), 1400);
    return () => clearInterval(t);
  }, [loading]);

  // Auto-hide the toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const findMatches = async (lostItem: Item) => {
    setSelected(lostItem);
    setMatches([]);
    setError("");
    setScanLine(0);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ lostItemId: lostItem.id }),
      });
      const data = await response.json();
      if (!response.ok && data.error) setError(data.error);
      const aiMatches: ApiMatch[] = data.matches || [];
      if (aiMatches.length === 0) return;

      const { data: foundItems } = await supabase.from("found_items").select("*").in("id", aiMatches.map((m) => m.id));
      setMatches(
        aiMatches
          .map((m) => ({ ...m, foundItem: (foundItems || []).find((f) => f.id === m.id) as Item }))
          .filter((m) => m.foundItem)
          .sort((a, b) => b.score - a.score)
      );
    } catch {
      setError("Could not reach the matching service. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    findMatchesRef.current = findMatches;
  });

  const handleClaim = async (match: Match) => {
    if (!user || !selected) return;
    setClaimingId(match.id);

    const { data: foundItemData } = await supabase.from("found_items").select("user_id").eq("id", match.foundItem.id).single();

    const { data: created, error } = await supabase
      .from("matches")
      .insert({
        lost_item_id: selected.id,
        found_item_id: match.foundItem.id,
        lost_user_id: user.id,
        found_user_id: foundItemData?.user_id,
        match_score: match.score,
        status: "pending_verification",
        claimed_by: user.id,
      })
      .select("id")
      .single();

    if (!error) {
      if (created) await notifyClaim("new_claim", created.id);
      setClaimedItems((c) => [...c, match.foundItem.id]);
      setToast({ ok: true, text: "Claim submitted! An admin will verify it and contact you soon." });
    } else {
      setToast({ ok: false, text: "Error submitting claim: " + error.message });
    }
    setClaimingId("");
  };

  if (fetchingItems) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-6 px-4 py-8 sm:px-6">
        <div className="h-44 rounded-3xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-200" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Keyframe for the score ring */}
      <style>{`@keyframes ring-fill { from { stroke-dashoffset: var(--ring-c); } }`}</style>

      {/* ── Header ── */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-700 p-6 text-white shadow-pop sm:p-8">
        <Sparkles className="animate-float absolute right-8 top-6 -z-10 h-24 w-24 text-white/10" />
        <div className="animate-float absolute -bottom-20 -left-10 -z-10 h-56 w-56 rounded-full bg-fuchsia-400/20 [animation-delay:2s]" />
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" /> AI-powered
        </span>
        <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">AI Match Finder</h2>
        <p className="mt-1 max-w-lg text-sm text-indigo-100">Pick one of your lost items and our AI will compare it with every available found item.</p>

        <ol className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.text} style={{ animationDelay: `${i * 90}ms` }} className="animate-fade-up flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-sm backdrop-blur">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <s.icon className="h-4 w-4" />
              </span>
              <span className="font-medium leading-tight">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Pick a lost item ── */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">1. Select your lost item</h3>
            <p className="text-xs text-slate-500">Only items still marked “searching” are shown</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{lostItems.length} items</span>
        </div>

        {lostItems.length === 0 ? (
          <div className="py-10 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-400">
              <Search className="h-7 w-7" />
            </span>
            <p className="mt-4 font-bold text-slate-800">No lost items to match</p>
            <p className="mt-1 text-sm text-slate-500">Report a lost item first, then come back here.</p>
            <Link href="/report-lost" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-600">
              Report lost item <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lostItems.map((item, i) => {
              const active = selected?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => findMatches(item)}
                  disabled={loading}
                  style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                  className={`animate-fade-up group relative flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all duration-200 disabled:cursor-wait ${
                    active ? "border-brand bg-brand-soft shadow-glow" : "border-slate-100 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-card"
                  }`}
                >
                  <ItemImage item={item} kind="lost" className="h-14 w-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900">{item.item_name}</p>
                    <p className="truncate text-xs capitalize text-slate-500">{item.category}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-slate-400"><MapPin className="h-3 w-3 shrink-0" /> {item.location}</p>
                  </div>
                  {active ? (
                    <CheckCircle2 className="animate-scale-in h-5 w-5 shrink-0 text-brand" />
                  ) : (
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Scanning ── */}
      {loading && selected && (
        <section className="animate-scale-in rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-card">
          <div className="relative mx-auto h-28 w-28">
            <span className="absolute inset-0 animate-ping rounded-full bg-violet-400/30" />
            <span className="absolute inset-3 animate-ping rounded-full bg-violet-400/30 [animation-delay:0.5s]" />
            <ItemImage item={selected} kind="lost" className="relative h-28 w-28 rounded-full ring-4 ring-white" />
          </div>
          <p className="mt-6 text-lg font-bold text-slate-900">Scanning for “{selected.item_name}”</p>
          <p key={scanLine} className="animate-fade-in mt-1 text-sm text-slate-500">{SCAN_LINES[scanLine]}</p>
          <div className="mx-auto mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-slate-100">
            <div className="animate-gradient h-full w-full rounded-full bg-gradient-to-r from-violet-500 via-blue-400 to-violet-500 bg-[length:200%_auto]" />
          </div>
        </section>
      )}

      {/* ── Results ── */}
      {!loading && selected && (
        <section key={selected.id} className="animate-fade-up space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900">2. Results for “{selected.item_name}”</h3>
              <p className="text-xs text-slate-500">{matches.length} possible {matches.length === 1 ? "match" : "matches"}, best first</p>
            </div>
            <button onClick={() => findMatches(selected)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand">
              <RefreshCw className="h-4 w-4" /> Scan again
            </button>
          </div>

          {matches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <SearchX className="h-7 w-7" />
              </span>
              <p className="mt-4 font-bold text-slate-800">No matches yet</p>
              <p className="mt-1 text-sm text-slate-500">New found items are reported every day. Check back soon.</p>
              {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
            </div>
          ) : (
            matches.map((match, i) => {
              const tone = scoreTone(match.score);
              const claimed = claimedItems.includes(match.foundItem.id);
              return (
                <article
                  key={match.id}
                  style={{ animationDelay: `${i * 110}ms` }}
                  className="animate-fade-up overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card transition hover:shadow-pop"
                >
                  <div className="grid items-center gap-5 p-5 md:grid-cols-[1fr_auto_1fr]">
                    {/* Lost */}
                    <div className="flex items-center gap-4">
                      <ItemImage item={selected} kind="lost" className="h-20 w-20 shrink-0 rounded-2xl" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold tracking-wide text-rose-500">YOUR LOST ITEM</span>
                        <p className="truncate font-bold text-slate-900">{selected.item_name}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-slate-500"><MapPin className="h-3 w-3 shrink-0" /> {selected.location}</p>
                        <p className="flex items-center gap-1 text-xs text-slate-400"><Calendar className="h-3 w-3" /> {selected.date_lost}</p>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex flex-col items-center">
                      <ScoreRing score={match.score} />
                      <span className={`mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone.chip}`}>{tone.label}</span>
                    </div>

                    {/* Found */}
                    <div className="flex items-center gap-4 md:flex-row-reverse md:text-right">
                      <ItemImage item={match.foundItem} kind="found" className="h-20 w-20 shrink-0 rounded-2xl" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold tracking-wide text-emerald-600">POSSIBLE MATCH</span>
                        <p className="truncate font-bold text-slate-900">{match.foundItem.item_name}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-slate-500 md:justify-end"><MapPin className="h-3 w-3 shrink-0" /> {match.foundItem.location}</p>
                        <p className="flex items-center gap-1 text-xs text-slate-400 md:justify-end"><Calendar className="h-3 w-3" /> {match.foundItem.date_found}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mx-5 flex gap-3 rounded-xl bg-gradient-to-r from-violet-50 to-blue-50 p-4">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-slate-700">
                        <span className="font-bold text-violet-700">Why it matches: </span>
                        {match.reason}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {match.ai && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-200">
                            <Sparkles className="h-3 w-3" /> AI text match
                          </span>
                        )}
                        {match.photoScore !== null && (
                          <span
                            title={match.photoNote}
                            className={`inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold ring-1 ${
                              match.photoScore >= 70 ? "text-emerald-700 ring-emerald-200" : match.photoScore >= 40 ? "text-amber-700 ring-amber-200" : "text-rose-700 ring-rose-200"
                            }`}
                          >
                            <Camera className="h-3 w-3" /> Photos {match.photoScore >= 70 ? "look alike" : match.photoScore >= 40 ? "partly alike" : "look different"} · {match.photoScore}%
                          </span>
                        )}
                        {match.signals.map((s) => (
                          <span key={s} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">{s}</span>
                        ))}
                      </div>
                      {match.photoNote && <p className="mt-1.5 text-xs text-slate-500">📷 {match.photoNote}</p>}
                    </div>
                  </div>
                  <p className="mx-5 mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Never send money to anyone claiming to have your item. Handovers only happen through the admin office after verification.
                  </p>

                  <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      onClick={() => router.push(`/item/${match.foundItem.id}`)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                    >
                      <Eye className="h-4 w-4" /> View found item
                    </button>
                    {claimed ? (
                      <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
                        <Clock className="h-4 w-4" /> Claim submitted, waiting for admin
                      </span>
                    ) : (
                      <button
                        onClick={() => handleClaim(match)}
                        disabled={claimingId === match.id}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-600 disabled:opacity-60"
                      >
                        <Hand className="h-4 w-4" /> {claimingId === match.id ? "Submitting…" : "Claim this item"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="animate-fade-up fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-2xl bg-slate-900 px-5 py-4 text-sm text-white shadow-pop">
          {toast.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <X className="h-5 w-5 shrink-0 text-rose-400" />}
          <p className="flex-1">{toast.text}</p>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
