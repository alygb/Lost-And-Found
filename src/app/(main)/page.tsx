"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Calendar, CheckCircle2, ClipboardList, Handshake, MapPin,
  Package, Search, ShieldCheck, Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Division = { id: number; name: string };
type District = { id: number; name: string; division_id: number };

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
  { icon: ClipboardList, title: "Report", text: "Post a lost or found item with photos and the exact district." },
  { icon: Sparkles, title: "We match", text: "Smart matching compares items across all districts." },
  { icon: ShieldCheck, title: "Admin verifies", text: "Claims are checked before anything is handed over." },
  { icon: Handshake, title: "Safe handover", text: "Collect from the local admin office with your ID." },
];

const STATUS: Record<string, string> = {
  recovered: "bg-emerald-100 text-emerald-700",
  matched: "bg-blue-100 text-blue-700",
  available: "bg-violet-100 text-violet-700",
  searching: "bg-amber-100 text-amber-700",
};

async function fetchItems(table: "lost_items" | "found_items") {
  const withDistrict = await supabase
    .from(table)
    .select("*, district:districts(name)")
    .order("created_at", { ascending: false });
  if (!withDistrict.error) return withDistrict.data || [];

  // Fallback if the district join is unavailable
  const plain = await supabase
    .from(table)
    .select("*")
    .order("created_at", { ascending: false });
  return plain.data || [];
}

export default function HomePage() {
  const feedRef = useRef<HTMLDivElement>(null);

  const [lost, setLost] = useState<any[]>([]);
  const [found, setFound] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"lost" | "found">("lost");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [visible, setVisible] = useState(12);

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

  useEffect(() => setVisible(12), [tab, search, category, districtId]);

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

  const scrollToFeed = () =>
    feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const pickDistrict = (id: number) => {
    setDistrictId(id);
    setTimeout(scrollToFeed, 50);
  };

  const isLost = tab === "lost";

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-linear-to-br from-blue-800 via-blue-700 to-indigo-700 px-4 pb-32 pt-16 text-white">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/10" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold backdrop-blur">
            <MapPin className="h-3.5 w-3.5" /> Serving all 10 districts of Azad Kashmir
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Lost something in Azad Kashmir?
            <br />
            <span className="text-amber-300">Let&apos;s bring it home.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-blue-100">
            Report lost and found items by district, get smart matches, and collect
            safely from the local admin office.
          </p>

          {/* Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scrollToFeed();
            }}
            className="mx-auto mt-9 flex max-w-3xl flex-col gap-2 rounded-3xl bg-white p-2 shadow-pop sm:flex-row"
          >
            <div className="flex flex-1 items-center gap-3 px-4">
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
              className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none sm:w-52"
            >
              <option value="">All districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-2xl bg-brand px-8 py-3 text-sm font-bold text-white transition hover:bg-brand-dark"
            >
              Search
            </button>
          </form>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/report-lost" className="inline-flex items-center gap-2 rounded-full bg-red-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-red-600">
              <Search className="h-4 w-4" /> I lost something
            </Link>
            <Link href="/report-found" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-600">
              <Package className="h-4 w-4" /> I found something
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 mx-auto -mt-14 grid max-w-6xl grid-cols-2 gap-4 px-4 lg:grid-cols-4">
        {[
          { label: "Lost reports", value: stats.lost, color: "text-red-500" },
          { label: "Found reports", value: stats.found, color: "text-emerald-500" },
          { label: "Items recovered", value: stats.recovered, color: "text-blue-600" },
          { label: "Districts active", value: stats.districts, color: "text-violet-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-3xl bg-white p-6 text-center shadow-card">
            <p className={`text-4xl font-extrabold ${s.color}`}>{loading ? "–" : s.value}</p>
            <p className="mt-1 text-sm font-medium text-slate-500">{s.label}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="mx-auto mt-20 max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-slate-900">How it works</h2>
          <p className="mt-2 text-slate-500">Four simple steps from lost to found</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative rounded-3xl bg-white p-6 shadow-card">
              <span className="absolute right-5 top-4 text-5xl font-black text-slate-100">{i + 1}</span>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <s.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coverage */}
      <section className="mx-auto mt-20 max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-slate-900">Browse by district</h2>
          <p className="mt-2 text-slate-500">Tap a district to see its reports</p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {divisions.map((div) => (
            <div key={div.id} className="rounded-3xl bg-white p-6 shadow-card">
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-soft text-brand">
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
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        districtId === d.id
                          ? "border-brand bg-brand text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-brand hover:text-brand"
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
          ))}
        </div>
      </section>

      {/* Feed */}
      <section ref={feedRef} className="mx-auto mt-20 max-w-7xl scroll-mt-24 px-4">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900">
              Recently {isLost ? "lost" : "found"}
            </h2>
            <p className="mt-1 text-slate-500">{list.length} items match your filters</p>
          </div>

          <div className="flex w-fit rounded-2xl bg-slate-200/70 p-1">
            {(["lost", "found"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-xl px-6 py-2.5 text-sm font-bold transition ${
                  tab === t
                    ? `bg-white shadow-card ${t === "lost" ? "text-red-500" : "text-emerald-600"}`
                    : "text-slate-500 hover:text-slate-700"
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
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  category === c.key
                    ? "border-brand bg-brand text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
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
            {(districtId !== null || category !== "all" || search) && (
              <button
                onClick={() => {
                  setDistrictId(null);
                  setCategory("all");
                  setSearch("");
                }}
                className="text-sm font-semibold text-brand hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-3xl bg-white shadow-card">
                <div className="h-44 bg-slate-100" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                  <div className="h-3 w-1/3 rounded bg-slate-100" />
                </div>
              </div>
            ))}

          {!loading &&
            list.slice(0, visible).map((item) => {
              const img =
                (item.image_urls && item.image_urls[0]) || item.image_url || "";
              const date = isLost ? item.date_lost : item.date_found;
              return (
                <Link
                  key={item.id}
                  href={`/item/${item.id}`}
                  className="group overflow-hidden rounded-3xl bg-white shadow-card transition hover:-translate-y-1 hover:shadow-pop"
                >
                  <div className="relative h-44 overflow-hidden">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={item.item_name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center ${isLost ? "bg-red-50 text-red-400" : "bg-emerald-50 text-emerald-400"}`}>
                        {isLost ? <Search className="h-12 w-12" /> : <Package className="h-12 w-12" />}
                      </div>
                    )}
                    <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-extrabold tracking-wide text-white ${isLost ? "bg-red-500" : "bg-emerald-500"}`}>
                      {isLost ? "LOST" : "FOUND"}
                    </span>
                    <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold capitalize ${STATUS[item.status] || STATUS.searching}`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="space-y-2.5 p-5">
                    <h3 className="line-clamp-1 text-lg font-bold text-slate-900">{item.item_name}</h3>
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
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-600">
                        {item.category}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>

        {!loading && list.length === 0 && (
          <div className="mt-10 rounded-3xl bg-white p-14 text-center shadow-card">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Search className="h-7 w-7" />
            </span>
            <h3 className="mt-5 text-lg font-bold text-slate-900">Nothing here yet</h3>
            <p className="mt-1 text-sm text-slate-500">Try another district or category.</p>
          </div>
        )}

        {list.length > visible && (
          <div className="mt-10 text-center">
            <button
              onClick={() => setVisible((v) => v + 12)}
              className="rounded-full border border-slate-200 bg-white px-8 py-3 text-sm font-bold text-slate-700 shadow-card transition hover:border-brand hover:text-brand"
            >
              Show more
            </button>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="mx-auto mt-20 max-w-6xl px-4">
        <div className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-blue-700 to-indigo-700 px-8 py-14 text-center text-white">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
          <h2 className="relative text-3xl font-extrabold">Found something? Be the reason it gets back.</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-blue-100">
            It takes two minutes to report, and the admin office handles the rest.
          </p>
          <Link href="/report-found" className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-brand shadow-lg transition hover:bg-blue-50">
            Report a found item <ArrowRight className="h-4 w-4" />
          </Link>
          <ul className="relative mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-blue-100">
            {["Free to use", "Admin-verified handover", "Private contact details"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}