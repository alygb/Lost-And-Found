"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Bell, Calendar, CheckCircle2, ClipboardList, Handshake, MapPin,
  Package, Search, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CountUp, Reveal } from "@/components/ui/Reveal";
import { AiTag } from "@/components/report/AiImageDialog";

type Division = { id: number; name: string };
type District = { id: number; name: string; division_id: number };
type Item = {
  id: string;
  item_name: string;
  category: string;
  status: string;
  location: string | null;
  description: string | null;
  district_id: number | null;
  district?: { name: string } | null;
  image_urls?: string[] | null;
  image_url?: string | null;
  ai_image_urls?: string[] | null;
  date_lost?: string;
  date_found?: string;
};

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "electronics", label: "Electronics" },
  { key: "documents", label: "Documents" },
  { key: "clothing", label: "Clothing" },
  { key: "bags", label: "Bags" },
  { key: "books", label: "Books" },
  { key: "jewelry", label: "Jewelry" },
  { key: "keys", label: "Keys" },
  { key: "other", label: "Other" },
];

const STEPS = [
  { icon: ClipboardList, title: "Report", text: "Post a lost or found item with photos and the exact district.", color: "from-rose-500 to-orange-400" },
  { icon: Sparkles, title: "AI matches", text: "Smart matching compares items across all ten districts.", color: "from-violet-500 to-fuchsia-500" },
  { icon: ShieldCheck, title: "Admin verifies", text: "Every claim is checked by an admin before handover.", color: "from-blue-500 to-cyan-400" },
  { icon: Handshake, title: "Safe handover", text: "Collect from the local admin office with your ID.", color: "from-emerald-500 to-teal-400" },
];

const STATUS: Record<string, string> = {
  recovered: "bg-emerald-100 text-emerald-700",
  matched: "bg-blue-100 text-blue-700",
  available: "bg-violet-100 text-violet-700",
  searching: "bg-amber-100 text-amber-700",
};

const PAGE = 12;

async function fetchItems(table: "lost_items" | "found_items"): Promise<Item[]> {
  const withDistrict = await supabase
    .from(table)
    .select("*, district:districts(name)")
    .order("created_at", { ascending: false });
  if (!withDistrict.error) return withDistrict.data || [];

  // Fallback if the district join is unavailable
  const plain = await supabase.from(table).select("*").order("created_at", { ascending: false });
  return plain.data || [];
}

export default function HomePage() {
  const feedRef = useRef<HTMLDivElement>(null);

  const [lost, setLost] = useState<Item[]>([]);
  const [found, setFound] = useState<Item[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"lost" | "found">("lost");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [districtId, setDistrictId] = useState<number | null>(null);

  // "Show more" count, reset whenever the filters change
  const filterKey = `${tab}|${search}|${category}|${districtId}`;
  const [more, setMore] = useState({ key: filterKey, n: PAGE });
  const visible = more.key === filterKey ? more.n : PAGE;

  useEffect(() => {
    (async () => {
      const [l, f, d, s] = await Promise.all([
        fetchItems("lost_items"),
        fetchItems("found_items"),
        supabase.from("divisions").select("id,name").order("name"),
        supabase.from("districts").select("id,name,division_id").order("name"),
      ]);
      setLost(l);
      setFound(f);
      setDivisions(d.data || []);
      setDistricts(s.data || []);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const all = [...lost, ...found];
    return {
      lost: lost.length,
      found: found.length,
      recovered: all.filter((i) => i.status === "recovered").length,
      districts: new Set(all.map((i) => i.district_id).filter(Boolean)).size,
    };
  }, [lost, found]);

  const countByDistrict = useMemo(() => {
    const map: Record<number, number> = {};
    [...lost, ...found].forEach((i) => {
      if (i.district_id) map[i.district_id] = (map[i.district_id] || 0) + 1;
    });
    return map;
  }, [lost, found]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tab === "lost" ? lost : found).filter(
      (i) =>
        (category === "all" || i.category === category) &&
        (districtId === null || i.district_id === districtId) &&
        (!q ||
          i.item_name?.toLowerCase().includes(q) ||
          i.location?.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q))
    );
  }, [tab, lost, found, category, districtId, search]);

  const scrollToFeed = () => feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const pickDistrict = (id: number) => {
    setDistrictId(id);
    setTimeout(scrollToFeed, 50);
  };

  const clearFilters = () => {
    setDistrictId(null);
    setCategory("all");
    setSearch("");
  };

  const isLost = tab === "lost";
  const hasFilters = districtId !== null || category !== "all" || search !== "";

  return (
    <div className="overflow-x-hidden">
      {/* ───────────── HERO ───────────── */}
      <section className="relative isolate overflow-hidden">
        <Image
          src="/images/home/valley.jpg"
          alt="Mountain valley in Azad Kashmir"
          fill
          preload
          sizes="100vw"
          className="-z-20 scale-105 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-blue-950/75 to-blue-900/40" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-surface to-transparent" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-36 pt-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-24">
          {/* Copy */}
          <div className="text-white">
            <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Serving all 10 districts of Azad Kashmir
            </span>

            <h1 className="animate-fade-up mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight [animation-delay:100ms] sm:text-5xl xl:text-6xl">
              Lost something?
              <br />
              <span className="animate-gradient bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 bg-[length:200%_auto] bg-clip-text text-transparent">
                Let&apos;s bring it home.
              </span>
            </h1>

            <p className="animate-fade-up mt-5 max-w-xl text-base leading-relaxed text-blue-100/90 [animation-delay:200ms] sm:text-lg">
              Report lost and found items by district, get AI-powered matches, and collect safely from your local admin office.
            </p>

            {/* Search */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                scrollToFeed();
              }}
              className="animate-fade-up mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-pop [animation-delay:300ms] sm:flex-row"
            >
              <div className="flex flex-1 items-center gap-3 px-3">
                <Search className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search a wallet, phone, keys…"
                  className="w-full bg-transparent py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
              <select
                value={districtId ?? ""}
                onChange={(e) => setDistrictId(e.target.value ? Number(e.target.value) : null)}
                className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none sm:w-44"
              >
                <option value="">All districts</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button type="submit" className="rounded-xl bg-brand px-7 py-3 text-sm font-bold text-white transition hover:bg-brand-dark active:scale-[0.98]">
                Search
              </button>
            </form>

            <div className="animate-fade-up mt-6 flex flex-wrap gap-3 [animation-delay:400ms]">
              <Link href="/report-lost" className="group inline-flex items-center gap-2 rounded-xl bg-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition hover:-translate-y-0.5 hover:bg-rose-600">
                <Search className="h-4 w-4" /> I lost something
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/report-found" className="group inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20">
                <Package className="h-4 w-4" /> I found something
              </Link>
            </div>
          </div>

          {/* Floating item collage */}
          <div className="relative hidden h-[440px] lg:block">
            <div className="animate-scale-in absolute right-8 top-0 w-60 [animation-delay:250ms]">
              <div className="animate-float overflow-hidden rounded-3xl bg-white p-2 shadow-pop">
                <div className="relative h-56 overflow-hidden rounded-2xl">
                  <Image src="/images/home/wallet.jpg" alt="Lost wallet" fill sizes="240px" className="object-cover" />
                  <span className="absolute left-2 top-2 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white">LOST</span>
                </div>
                <div className="px-2 pb-1 pt-3">
                  <p className="text-sm font-bold text-slate-900">Brown leather wallet</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" /> Muzaffarabad</p>
                </div>
              </div>
            </div>

            <div className="animate-scale-in absolute bottom-0 left-0 w-56 [animation-delay:450ms]">
              <div className="animate-float overflow-hidden rounded-3xl bg-white p-2 shadow-pop [animation-delay:1.5s]">
                <div className="relative h-44 overflow-hidden rounded-2xl">
                  <Image src="/images/home/phone.jpg" alt="Found phone" fill sizes="224px" className="object-cover" />
                  <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white">FOUND</span>
                </div>
                <div className="px-2 pb-1 pt-3">
                  <p className="text-sm font-bold text-slate-900">Smartphone, blue case</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" /> Mirpur</p>
                </div>
              </div>
            </div>

            <div className="animate-scale-in absolute bottom-16 right-0 w-40 [animation-delay:650ms]">
              <div className="animate-float overflow-hidden rounded-2xl bg-white p-1.5 shadow-pop [animation-delay:3s]">
                <div className="relative h-36 overflow-hidden rounded-xl">
                  <Image src="/images/home/backpack.jpg" alt="Found backpack" fill sizes="160px" className="object-cover" />
                </div>
              </div>
            </div>

            {/* Match toast */}
            <div className="animate-fade-up absolute left-10 top-24 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-pop backdrop-blur [animation-delay:1s]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">Match found!</p>
                <p className="text-xs text-slate-500">94% similarity</p>
              </div>
            </div>

            <div className="animate-fade-up absolute right-24 top-[300px] flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg [animation-delay:1.3s]">
              <BadgeCheck className="h-4 w-4" /> Verified handover
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── STATS ───────────── */}
      <section className="relative z-10 mx-auto -mt-20 grid max-w-6xl grid-cols-2 gap-4 px-4 sm:px-6 lg:grid-cols-4">
        {[
          { label: "Lost reports", value: stats.lost, icon: Search, tint: "bg-rose-50 text-rose-500" },
          { label: "Found reports", value: stats.found, icon: Package, tint: "bg-emerald-50 text-emerald-500" },
          { label: "Items recovered", value: stats.recovered, icon: CheckCircle2, tint: "bg-blue-50 text-blue-600" },
          { label: "Districts active", value: stats.districts, icon: MapPin, tint: "bg-violet-50 text-violet-600" },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 90}>
            <div className="card-hover flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.tint}`}>
                <s.icon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-3xl font-extrabold text-slate-900">{loading ? "–" : <CountUp value={s.value} />}</p>
                <p className="text-sm font-medium text-slate-500">{s.label}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ───────────── HOW IT WORKS ───────────── */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-brand">How it works</p>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">From lost to found in four steps</h2>
        </Reveal>
        <div className="relative mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-8 hidden h-0.5 bg-gradient-to-r from-rose-200 via-violet-200 to-emerald-200 lg:block" />
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 120}>
              <div className="card-hover group relative h-full rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-card">
                <span className={`relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${s.color} text-white shadow-lg transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110`}>
                  <s.icon className="h-7 w-7" />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white ring-4 ring-white">{i + 1}</span>
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────────── TRUST / HANDOVER ───────────── */}
      <section className="mx-auto mt-24 grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <div className="relative">
            <div className="relative h-80 overflow-hidden rounded-3xl shadow-pop sm:h-96">
              <Image src="/images/home/handshake.jpg" alt="Item handed over safely" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover transition duration-700 hover:scale-105" />
            </div>
            <div className="absolute -bottom-6 -right-2 rounded-2xl bg-white p-4 shadow-pop sm:-right-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">ID-verified</p>
                  <p className="text-xs text-slate-500">at the admin office</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <p className="text-sm font-bold uppercase tracking-widest text-brand">Why AJK Lost &amp; Found</p>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">Every handover is safe and verified</h2>
          <p className="mt-4 leading-relaxed text-slate-500">
            Your phone number and address are never shown publicly. Admins review every claim and arrange the handover at the district office.
          </p>
          <ul className="mt-6 space-y-4">
            {[
              { icon: Sparkles, title: "AI-powered matching", text: "Photos and descriptions are compared automatically." },
              { icon: Bell, title: "Instant notifications", text: "Get alerted the moment a possible match appears." },
              { icon: ShieldCheck, title: "Private by default", text: "Chat with admins privately. Your details stay hidden." },
            ].map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <f.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-bold text-slate-900">{f.title}</p>
                  <p className="text-sm text-slate-500">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* ───────────── DISTRICTS ───────────── */}
      <section className="mx-auto mt-28 max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-brand">Coverage</p>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">Browse by district</h2>
          <p className="mt-2 text-slate-500">Tap a district to see its reports</p>
        </Reveal>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {divisions.map((div, i) => (
            <Reveal key={div.id} delay={i * 120}>
              <div className="card-hover h-full rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
                <h3 className="mb-4 flex items-center gap-3 text-base font-bold text-slate-900">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    <MapPin className="h-4 w-4" />
                  </span>
                  {div.name} Division
                </h3>
                <div className="flex flex-wrap gap-2">
                  {districts
                    .filter((d) => d.division_id === div.id)
                    .map((d) => (
                      <button
                        key={d.id}
                        onClick={() => pickDistrict(d.id)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition active:scale-95 ${
                          districtId === d.id
                            ? "border-brand bg-brand text-white shadow-glow"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-brand hover:bg-white hover:text-brand"
                        }`}
                      >
                        {d.name}
                        <span className={`rounded-full px-2 py-0.5 text-xs ${districtId === d.id ? "bg-white/25" : "bg-white text-slate-500"}`}>
                          {countByDistrict[d.id] || 0}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────────── FEED ───────────── */}
      <section ref={feedRef} className="mx-auto mt-28 max-w-7xl scroll-mt-20 px-4 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-brand">Live feed</p>
            <h2 className="mt-1 text-3xl font-extrabold text-slate-900">Recently {isLost ? "lost" : "found"}</h2>
            <p className="mt-1 text-slate-500">{list.length} items match your filters</p>
          </div>

          <div className="relative flex w-fit rounded-xl bg-slate-200/70 p-1">
            <span
              className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-card transition-transform duration-300 ease-out ${isLost ? "translate-x-0" : "translate-x-full"}`}
            />
            {(["lost", "found"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative z-10 w-32 rounded-lg py-2.5 text-sm font-bold transition-colors ${
                  tab === t ? (t === "lost" ? "text-rose-500" : "text-emerald-600") : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "lost" ? `Lost (${lost.length})` : `Found (${found.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                  category === c.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 lg:ml-auto">
            <select
              value={districtId ?? ""}
              onChange={(e) => setDistrictId(e.target.value ? Number(e.target.value) : null)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 outline-none"
            >
              <option value="">All districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="animate-fade-in inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div key={filterKey} className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-card">
                <div className="h-48 bg-slate-100" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                  <div className="h-3 w-1/3 rounded bg-slate-100" />
                </div>
              </div>
            ))}

          {!loading &&
            list.slice(0, visible).map((item, i) => {
              const img = (item.image_urls && item.image_urls[0]) || item.image_url || "";
              const date = isLost ? item.date_lost : item.date_found;
              return (
                <Link
                  key={item.id}
                  href={`/item/${item.id}`}
                  style={{ animationDelay: `${Math.min(i % PAGE, 8) * 60}ms` }}
                  className="animate-fade-up card-hover group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card"
                >
                  <div className="relative h-48 overflow-hidden bg-slate-100">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={item.item_name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center ${isLost ? "bg-rose-50 text-rose-300" : "bg-emerald-50 text-emerald-300"}`}>
                        {isLost ? <Search className="h-12 w-12" /> : <Package className="h-12 w-12" />}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-extrabold tracking-wide text-white shadow ${isLost ? "bg-rose-500" : "bg-emerald-500"}`}>
                      {isLost ? "LOST" : "FOUND"}
                    </span>
                    {img && item.ai_image_urls?.includes(img) && <AiTag className="absolute bottom-3 left-3" />}
                    <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold capitalize ${STATUS[item.status] || STATUS.searching}`}>
                      {item.status}
                    </span>
                    <span className="absolute bottom-3 right-3 inline-flex translate-y-2 items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      View <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>

                  <div className="space-y-2.5 p-5">
                    <h3 className="line-clamp-1 text-base font-bold text-slate-900 transition-colors group-hover:text-brand">{item.item_name}</h3>
                    <p className="flex items-center gap-2 text-sm text-slate-500">
                      <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="line-clamp-1">
                        {item.location}
                        {item.district?.name ? `, ${item.district.name}` : ""}
                      </span>
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <p className="flex items-center gap-2 text-xs text-slate-400">
                        <Calendar className="h-3.5 w-3.5" /> {date}
                      </p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-600">{item.category}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>

        {!loading && list.length === 0 && (
          <div className="animate-scale-in mt-10 rounded-2xl border border-dashed border-slate-200 bg-white p-14 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Search className="h-7 w-7" />
            </span>
            <h3 className="mt-5 text-lg font-bold text-slate-900">Nothing here yet</h3>
            <p className="mt-1 text-sm text-slate-500">Try another district or category.</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-5 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                Clear filters
              </button>
            )}
          </div>
        )}

        {list.length > visible && (
          <div className="mt-10 text-center">
            <button
              onClick={() => setMore({ key: filterKey, n: visible + PAGE })}
              className="rounded-full border border-slate-200 bg-white px-8 py-3 text-sm font-bold text-slate-700 shadow-card transition hover:-translate-y-0.5 hover:border-brand hover:text-brand"
            >
              Show more
            </button>
          </div>
        )}
      </section>

      {/* ───────────── CTA ───────────── */}
      <section className="mx-auto mt-28 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[2rem] px-8 py-16 text-center text-white shadow-pop">
            <Image src="/images/home/sunset.jpg" alt="" fill sizes="(max-width: 1200px) 100vw, 1152px" className="-z-20 object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-950/85 via-indigo-900/75 to-slate-900/70" />
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold sm:text-4xl">Found something? Be the reason it gets back home.</h2>
            <p className="mx-auto mt-3 max-w-xl text-blue-100">It takes two minutes to report, and the admin office handles the rest.</p>
            <Link href="/report-found" className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-brand shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50">
              Report a found item <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-blue-100">
              {["Free to use", "Admin-verified handover", "Private contact details"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
