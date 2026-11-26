"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Award, Calendar, Camera, CheckCircle2, ChevronRight, Hand, HeartHandshake, KeyRound,
  Loader2, Lock, LogOut, Mail, MessageSquare, Package, Search, Shield, ShieldCheck, Sparkles, Star,
  Trash2, User, UserCircle2, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { validateFullName, validateImageFile, validatePassword } from "@/lib/validation";
import { CountUp } from "@/components/ui/Reveal";
import { Field, FormAlert, SubmitButton } from "@/components/auth/AuthShell";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
  is_super_admin?: boolean;
  created_at?: string;
};
type Activity = { id: string; kind: "lost" | "found"; name: string; status: string; created_at: string; image?: string };
type Tab = "account" | "activity" | "security";

const STATUS_STYLE: Record<string, string> = {
  recovered: "bg-emerald-100 text-emerald-700",
  matched: "bg-blue-100 text-blue-700",
  available: "bg-violet-100 text-violet-700",
  searching: "bg-amber-100 text-amber-700",
};

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("account");
  const [stats, setStats] = useState({ lost: 0, found: 0, claims: 0, recovered: 0, comments: 0 });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  // Account form
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Password form
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [pwTried, setPwTried] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return null;
    }
    const [p, lost, found, claims, comments] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("lost_items").select("id,item_name,status,created_at,image_urls,image_url").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("found_items").select("id,item_name,status,created_at,image_urls,image_url").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("matches").select("id", { count: "exact", head: true }).eq("lost_user_id", user.id),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    type Row = { id: string; item_name: string; status: string; created_at: string; image_urls?: string[] | null; image_url?: string | null };
    const L = (lost.data || []) as Row[];
    const F = (found.data || []) as Row[];
    const toAct = (kind: "lost" | "found") => (r: Row): Activity => ({
      id: r.id, kind, name: r.item_name, status: r.status, created_at: r.created_at, image: r.image_urls?.[0] || r.image_url || undefined,
    });
    return {
      profile: { ...(p.data as Profile), email: (p.data as Profile)?.email || user.email || "" },
      stats: {
        lost: L.length,
        found: F.length,
        claims: claims.count || 0,
        recovered: [...L, ...F].filter((r) => r.status === "recovered").length,
        comments: comments.error ? 0 : comments.count || 0,
      },
      activity: [...L.map(toAct("lost")), ...F.map(toAct("found"))].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8),
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    load().then((d) => {
      if (!d || cancelled) return;
      setProfile(d.profile);
      setName(d.profile.full_name || "");
      setStats(d.stats);
      setActivity(d.activity);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /** Lets the sidebar / top bar pick up the new name or photo right away. */
  const refreshShell = () => supabase.auth.updateUser({ data: { refreshed_at: Date.now() } });

  const nameError = validateFullName(name);
  const nameChanged = name.trim() !== (profile?.full_name || "").trim();

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    if (nameError || !profile || !nameChanged) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", profile.id);
    setSaving(false);
    if (error) return setToast({ ok: false, text: "Could not save: " + error.message });
    setProfile({ ...profile, full_name: name.trim() });
    setToast({ ok: true, text: "Your name has been updated." });
    refreshShell();
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;
    const bad = validateImageFile(file);
    if (bad) return setToast({ ok: false, text: bad });

    setUploading(true);
    const fileName = `avatar-${profile.id}.${file.name.split(".").pop()}`;
    const { error: upErr } = await supabase.storage.from("item-images").upload(fileName, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      return setToast({ ok: false, text: "Upload failed: " + upErr.message });
    }
    const avatarUrl = `${supabase.storage.from("item-images").getPublicUrl(fileName).data.publicUrl}?t=${Date.now()}`;
    const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", profile.id);
    setUploading(false);
    if (error) return setToast({ ok: false, text: error.message });
    setProfile({ ...profile, avatar_url: avatarUrl });
    setToast({ ok: true, text: "Profile photo updated." });
    refreshShell();
  };

  const removeAvatar = async () => {
    if (!profile?.avatar_url || !window.confirm("Remove your profile photo?")) return;
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", profile.id);
    if (error) return setToast({ ok: false, text: error.message });
    setProfile({ ...profile, avatar_url: null });
    setToast({ ok: true, text: "Profile photo removed." });
    refreshShell();
  };

  const pwErrors = {
    next: validatePassword(pw.next),
    confirm: !pw.confirm ? "Please type the new password again." : pw.confirm !== pw.next ? "The passwords do not match." : "",
  };
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwTried(true);
    setPwMsg(null);
    if (pwErrors.next || pwErrors.confirm) return;
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setPwSaving(false);
    if (error) {
      const m = error.message.toLowerCase();
      return setPwMsg({
        ok: false,
        text: m.includes("reauth") || m.includes("recent")
          ? "For security, please sign out and sign in again, then change your password."
          : m.includes("same") ? "Your new password must be different from the old one." : error.message,
      });
    }
    setPw({ next: "", confirm: "" });
    setPwTried(false);
    setPwMsg({ ok: true, text: "Password changed. Use your new password next time you sign in." });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // ── Loading ──
  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-6 px-4 py-8 sm:px-6">
        <div className="h-48 rounded-3xl bg-slate-200" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-200" />)}
        </div>
        <div className="h-72 rounded-2xl bg-slate-200" />
      </div>
    );
  }

  const isAdmin = profile.role === "admin";
  const initial = profile.full_name?.trim().charAt(0).toUpperCase() || "U";
  const joined = profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null;

  // Profile strength
  const checks = [
    { label: "Add your full name", done: !!profile.full_name?.trim() && !validateFullName(profile.full_name) },
    { label: "Upload a profile photo", done: !!profile.avatar_url },
    { label: "Post your first report", done: stats.lost + stats.found > 0 },
    { label: "Help someone with a comment", done: stats.comments > 0 },
  ];
  const strength = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);

  // Achievements
  const BADGES = [
    { icon: Star, title: "First step", text: "Posted a first report", earned: stats.lost + stats.found > 0, color: "from-amber-400 to-orange-500" },
    { icon: HeartHandshake, title: "Good Samaritan", text: "Reported a found item", earned: stats.found > 0, color: "from-emerald-400 to-teal-500" },
    { icon: Sparkles, title: "Reunited", text: "An item was recovered", earned: stats.recovered > 0, color: "from-violet-500 to-fuchsia-500" },
    { icon: MessageSquare, title: "Helper", text: "Left a helpful comment", earned: stats.comments > 0, color: "from-blue-500 to-indigo-500" },
  ];

  const TABS: { key: Tab; label: string; icon: typeof User }[] = [
    { key: "account", label: "Account", icon: UserCircle2 },
    { key: "activity", label: "Activity", icon: Calendar },
    { key: "security", label: "Security", icon: Lock },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* ── Cover + identity ── */}
      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-card">
        <div className="relative isolate h-40 sm:h-48">
          <Image src="/images/home/sunset.jpg" alt="" fill sizes="(max-width: 1024px) 100vw, 1024px" className="-z-20 object-cover" preload />
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-950/80 via-indigo-900/60 to-violet-800/50" />
          <div className="animate-float absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
          {isAdmin && (
            <Link href="/admin" className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-950 shadow-lg transition hover:bg-amber-300">
              <Shield className="h-3.5 w-3.5" /> Admin panel
            </Link>
          )}
        </div>

        <div className="relative px-6 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {/* Avatar */}
            <div className="group relative -mt-16 w-fit">
              <div className="rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 p-1 shadow-pop">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="Your profile photo" className="h-32 w-32 rounded-full border-4 border-white object-cover" />
                ) : (
                  <span className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-blue-600 to-indigo-700 text-5xl font-extrabold text-white">
                    {initial}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute inset-1 flex flex-col items-center justify-center gap-1 rounded-full bg-slate-950/55 text-xs font-bold text-white opacity-0 backdrop-blur-[1px] transition group-hover:opacity-100 focus-visible:opacity-100 max-sm:hidden"
                aria-label="Change profile photo"
              >
                <Camera className="h-6 w-6" /> Change
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-brand text-white shadow-lg transition hover:scale-110"
                aria-label="Upload profile photo"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
            </div>

            {/* Name + meta */}
            <div className="min-w-0 flex-1 sm:pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-extrabold text-slate-900 sm:text-3xl">{profile.full_name || "Your name"}</h1>
                {!isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                    <ShieldCheck className="h-3.5 w-3.5" /> Member
                  </span>
                )}
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    {profile.is_super_admin ? <Star className="h-3.5 w-3.5 fill-amber-500" /> : <Shield className="h-3.5 w-3.5" />}
                    {profile.is_super_admin ? "Super admin" : "Admin"}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {profile.email}</span>
                {joined && <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Member since {joined}</span>}
              </div>
            </div>

            <div className="flex gap-2 sm:pb-2">
              <Link href="/report-lost" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-700">
                <Search className="h-4 w-4" /> Report
              </Link>
              <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Lost reports", value: stats.lost, icon: Search, tint: "bg-rose-50 text-rose-500" },
          { label: "Found reports", value: stats.found, icon: Package, tint: "bg-emerald-50 text-emerald-600" },
          { label: "Claims made", value: stats.claims, icon: Hand, tint: "bg-violet-50 text-violet-600" },
          { label: "Items recovered", value: stats.recovered, icon: CheckCircle2, tint: "bg-blue-50 text-blue-600" },
        ].map((s, i) => (
          <div key={s.label} style={{ animationDelay: `${i * 70}ms` }} className="animate-fade-up card-hover flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.tint}`}>
              <s.icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-2xl font-extrabold text-slate-900"><CountUp value={s.value} duration={900} /></p>
              <p className="text-xs font-medium text-slate-500 sm:text-sm">{s.label}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main: tabs ── */}
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card lg:col-span-2">
          <div className="flex gap-1 border-b border-slate-100 p-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
                  tab === t.key ? "bg-brand-soft text-brand" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          <div key={tab} className="animate-fade-in p-6">
            {/* Account */}
            {tab === "account" && (
              <div className="space-y-6">
                <form noValidate onSubmit={saveName} className="space-y-5">
                  <Field
                    label="Full name"
                    icon={User}
                    name="full_name"
                    maxLength={50}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setNameTouched(true)}
                    error={nameTouched ? nameError : ""}
                    hint={<p className="mt-1.5 text-xs text-slate-400">Shown on your reports and comments.</p>}
                  />
                  <Field
                    label="Email address"
                    icon={Mail}
                    name="email"
                    value={profile.email || ""}
                    readOnly
                    disabled
                    hint={<p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400"><Lock className="h-3 w-3" /> Private. Only you and the admins can see it.</p>}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={saving || !nameChanged}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save changes
                    </button>
                    {nameChanged && (
                      <button type="button" onClick={() => { setName(profile.full_name || ""); setNameTouched(false); }} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <Camera className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Profile photo</p>
                      <p className="text-xs text-slate-500">JPG or PNG, up to 5 MB</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
                      {uploading ? "Uploading…" : profile.avatar_url ? "Change" : "Upload"}
                    </button>
                    {profile.avatar_url && (
                      <button onClick={removeAvatar} className="rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50" aria-label="Remove photo">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Activity */}
            {tab === "activity" && (
              activity.length === 0 ? (
                <div className="py-12 text-center">
                  <Calendar className="mx-auto h-10 w-10 text-slate-200" />
                  <p className="mt-3 font-bold text-slate-700">No activity yet</p>
                  <p className="text-sm text-slate-500">Your reports will show up here.</p>
                  <Link href="/report-lost" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white">
                    Make your first report <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <ol className="relative space-y-1 before:absolute before:bottom-4 before:left-[27px] before:top-4 before:w-px before:bg-slate-100">
                  {activity.map((a, i) => (
                    <li key={a.id} style={{ animationDelay: `${i * 50}ms` }} className="animate-fade-up">
                      <Link href={`/item/${a.id}`} className="group relative flex items-center gap-4 rounded-xl p-2 transition hover:bg-slate-50">
                        {a.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.image} alt="" className="relative h-10 w-10 shrink-0 rounded-xl object-cover ring-4 ring-white" />
                        ) : (
                          <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-4 ring-white ${a.kind === "lost" ? "bg-rose-50 text-rose-400" : "bg-emerald-50 text-emerald-500"}`}>
                            {a.kind === "lost" ? <Search className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            You reported a <span className={a.kind === "lost" ? "text-rose-600" : "text-emerald-600"}>{a.kind}</span> item: {a.name}
                          </p>
                          <p className="text-xs text-slate-400">{timeAgo(a.created_at)}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${STATUS_STYLE[a.status] || STATUS_STYLE.searching}`}>{a.status}</span>
                        <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                      </Link>
                    </li>
                  ))}
                </ol>
              )
            )}

            {/* Security */}
            {tab === "security" && (
              <div className="space-y-6">
                <form noValidate onSubmit={changePassword} className="space-y-5">
                  <div>
                    <h3 className="flex items-center gap-2 font-bold text-slate-900"><KeyRound className="h-4 w-4 text-brand" /> Change password</h3>
                    <p className="text-sm text-slate-500">Use 8+ characters with letters and numbers.</p>
                  </div>
                  {pwMsg && <FormAlert tone={pwMsg.ok ? "success" : "error"}>{pwMsg.text}</FormAlert>}
                  <Field
                    label="New password"
                    icon={Lock}
                    name="new-password"
                    password
                    autoComplete="new-password"
                    placeholder="8+ characters, letters and numbers"
                    value={pw.next}
                    onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                    error={pwTried ? pwErrors.next : ""}
                  />
                  <Field
                    label="Confirm new password"
                    icon={Lock}
                    name="confirm-password"
                    password
                    autoComplete="new-password"
                    placeholder="Type it again"
                    value={pw.confirm}
                    onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                    error={pwTried ? pwErrors.confirm : ""}
                  />
                  <div className="max-w-xs">
                    <SubmitButton loading={pwSaving} loadingText="Updating…">
                      <KeyRound className="h-4 w-4" /> Update password
                    </SubmitButton>
                  </div>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Sign out of this device</p>
                    <p className="text-xs text-slate-500">You can sign back in any time.</p>
                  </div>
                  <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Side: strength + badges ── */}
        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" strokeLinecap="round"
                    stroke={strength === 100 ? "#10b981" : "#2563eb"}
                    strokeDasharray={`${(strength / 100) * 97.4} 97.4`}
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-900">{strength}%</span>
              </div>
              <div>
                <p className="font-bold text-slate-900">Profile strength</p>
                <p className="text-xs text-slate-500">{strength === 100 ? "All done. Great profile!" : "Complete these to build trust."}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2.5 text-sm">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.done ? "bg-emerald-500 text-white" : "border-2 border-slate-200"}`}>
                    {c.done && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </span>
                  <span className={c.done ? "text-slate-400 line-through" : "font-medium text-slate-700"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <p className="flex items-center gap-2 font-bold text-slate-900"><Award className="h-4 w-4 text-amber-500" /> Achievements</p>
            <p className="text-xs text-slate-500">{BADGES.filter((b) => b.earned).length} of {BADGES.length} earned</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {BADGES.map((b) => (
                <div
                  key={b.title}
                  title={b.text}
                  className={`flex flex-col items-center rounded-2xl border p-3 text-center transition ${b.earned ? "border-slate-100 bg-white hover:-translate-y-0.5 hover:shadow-card" : "border-dashed border-slate-200 bg-slate-50/60"}`}
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${b.earned ? `bg-gradient-to-br ${b.color} text-white shadow-lg` : "bg-slate-100 text-slate-300"}`}>
                    {b.earned ? <b.icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                  </span>
                  <p className={`mt-2 text-xs font-bold ${b.earned ? "text-slate-900" : "text-slate-400"}`}>{b.title}</p>
                  <p className="text-[10px] leading-tight text-slate-400">{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Toast */}
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
