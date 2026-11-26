"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle, AlertTriangle, ArrowRight, Calendar, CheckCircle2, Clock, Eye, FileCheck2, ImagePlus, MapPin,
  Package, Pencil, Plus, Search, Sparkles, Trash2, X, XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CountUp } from "@/components/ui/Reveal";
import { AI_IMAGE_THRESHOLD, detectAiImage } from "@/lib/aiClient";
import AiImageDialog, { AiTag, type AiDecision } from "@/components/report/AiImageDialog";
import {
  normalizePhone, oldestReportDate, validateDate, validateDescription, validateEmail, validateImageFile, validateItemName,
  validatePhone, validatePlace,
} from "@/lib/validation";

type Item = {
  id: string;
  item_name: string;
  category: string;
  description: string;
  location: string;
  status: string;
  date_lost?: string;
  date_found?: string;
  contact_email?: string;
  contact_phone?: string | null;
  image_urls?: string[] | null;
  image_url?: string | null;
  ai_image_urls?: string[] | null;
  ai_image_reason?: string | null;
};
type ClaimItem = Pick<Item, "item_name" | "category" | "location" | "image_urls" | "image_url"> | null;
type Claim = {
  id: string;
  status: string;
  match_score: number;
  created_at: string;
  admin_notes?: string | null;
  lost_item: ClaimItem;
  found_item: ClaimItem;
};
type Kind = "lost" | "found";
type Tab = Kind | "claims";

const STATUS_STYLE: Record<string, string> = {
  recovered: "bg-emerald-100 text-emerald-700",
  matched: "bg-blue-100 text-blue-700",
  available: "bg-violet-100 text-violet-700",
  searching: "bg-amber-100 text-amber-700",
};

const CLAIM_META: Record<string, { label: string; style: string; icon: typeof Clock }> = {
  pending_verification: { label: "Pending verification", style: "bg-amber-100 text-amber-700", icon: Clock },
  approved: { label: "Approved by admin", style: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rejected: { label: "Rejected by admin", style: "bg-rose-100 text-rose-700", icon: XCircle },
};

const CLAIM_SELECT = `
  *,
  lost_item:lost_items(item_name, category, location, image_urls, image_url),
  found_item:found_items(item_name, category, location, image_urls, image_url)
`;

const firstImage = (i: ClaimItem | Item) => i?.image_urls?.[0] || i?.image_url || "";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

function Thumb({ src, kind, size = "h-14 w-14" }: { src: string; kind: Kind; size?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${size} shrink-0 rounded-xl object-cover`} />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-xl ${kind === "lost" ? "bg-rose-50 text-rose-400" : "bg-emerald-50 text-emerald-400"}`}>
      {kind === "lost" ? <Search className="h-6 w-6" /> : <Package className="h-6 w-6" />}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 transition focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand";

export default function DashboardPage() {
  const router = useRouter();
  const [lostItems, setLostItems] = useState<Item[]>([]);
  const [foundItems, setFoundItems] = useState<Item[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [finderClaims, setFinderClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [tab, setTab] = useState<Tab>("lost");

  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editType, setEditType] = useState<Kind>("lost");
  const [editLoading, setEditLoading] = useState(false);
  const [editImages, setEditImages] = useState<File[]>([]);
  const [editPreviews, setEditPreviews] = useState<string[]>([]);
  // AI-generated check for newly added photos, keyed by preview URL
  const [editChecks, setEditChecks] = useState<Record<string, { check: "checking" | "original" | "unchecked" | "flagged" | "real" | "ai"; score?: number; reason?: string }>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return null;
    }
    const [profile, lost, found, owner, finder] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase.from("lost_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("found_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      // Claims where the user is the OWNER (lost item)
      supabase.from("matches").select(CLAIM_SELECT).eq("lost_user_id", user.id).order("created_at", { ascending: false }),
      // Approved claims where the user is the FINDER — they must hand the item to the admin office
      supabase.from("matches").select(CLAIM_SELECT).eq("found_user_id", user.id).eq("status", "approved").order("created_at", { ascending: false }),
    ]);
    return {
      name: profile.data?.full_name || "",
      lost: (lost.data || []) as Item[],
      found: (found.data || []) as Item[],
      claims: (owner.data || []) as Claim[],
      finder: (finder.data || []) as Claim[],
    };
  }, [router]);

  const applyData = useCallback((d: Awaited<ReturnType<typeof loadData>>) => {
    if (!d) return;
    setUserName(d.name);
    setLostItems(d.lost);
    setFoundItems(d.found);
    setClaims(d.claims);
    setFinderClaims(d.finder);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadData().then((d) => {
      if (!cancelled) applyData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [loadData, applyData]);

  const handleDelete = async (id: string, type: Kind) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    const table = type === "lost" ? "lost_items" : "found_items";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (!error) {
      if (type === "lost") setLostItems((l) => l.filter((i) => i.id !== id));
      else setFoundItems((l) => l.filter((i) => i.id !== id));
    }
  };

  const openEdit = (item: Item, type: Kind) => {
    setEditItem({ ...item });
    setEditType(type);
    setEditImages([]);
    setEditPreviews([]);
    setEditErrors({});
    setEditChecks({});
  };

  const closeEdit = () => {
    setEditItem(null);
    setEditImages([]);
    setEditPreviews([]);
    setEditErrors({});
  };

  const checkEdit = (item: Item) => {
    const all: Record<string, string> = {
      item_name: validateItemName(item.item_name || ""),
      description: validateDescription(item.description || ""),
      location: validatePlace(item.location || ""),
      date: validateDate((editType === "lost" ? item.date_lost : item.date_found) || "", editType === "lost" ? "date lost" : "date found"),
      contact_email: validateEmail(item.contact_email || ""),
      contact_phone: validatePhone(item.contact_phone || ""),
    };
    return Object.fromEntries(Object.entries(all).filter(([, v]) => v));
  };

  const editErr = (k: string) =>
    editErrors[k] ? (
      <p key={editErrors[k]} role="alert" className="animate-fade-down mt-1.5 flex items-start gap-1.5 text-xs font-medium text-rose-600">
        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {editErrors[k]}
      </p>
    ) : null;
  const editCls = (k: string) => inputCls + (editErrors[k] ? " border-rose-400 bg-rose-50/40 focus:ring-rose-300" : "");

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!editItem) return;
    const next = { ...editItem, [e.target.name]: e.target.value };
    setEditItem(next);
    // Re-check fields that already show an error, so the message disappears once fixed
    if (Object.keys(editErrors).length) {
      const fresh = checkEdit(next);
      setEditErrors((prev) => Object.fromEntries(Object.keys(prev).filter((k) => fresh[k]).map((k) => [k, fresh[k]])));
    }
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 5) {
      alert("Maximum 5 images!");
      return;
    }
    const bad = files.map(validateImageFile).find(Boolean);
    if (bad) {
      alert(bad);
      e.target.value = "";
      return;
    }
    const previews = files.map((f) => URL.createObjectURL(f));
    setEditImages(files);
    setEditPreviews(previews);
    setEditChecks(Object.fromEntries(previews.map((u) => [u, { check: "checking" as const }])));
    files.forEach((f, i) => {
      detectAiImage(f).then((score) =>
        setEditChecks((c) =>
          previews[i] in c
            ? { ...c, [previews[i]]: { score: score ?? undefined, check: score === null ? "unchecked" : score >= AI_IMAGE_THRESHOLD ? "flagged" : "original" } }
            : c
        )
      );
    });
  };

  const editFlagged = editPreviews.find((u) => editChecks[u]?.check === "flagged");
  const decideEditAi = (url: string, d: AiDecision) => {
    if (d.kind === "remove") {
      const i = editPreviews.indexOf(url);
      setEditImages((l) => l.filter((_, x) => x !== i));
      setEditPreviews((l) => l.filter((_, x) => x !== i));
      setEditChecks((c) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== url)));
      return;
    }
    setEditChecks((c) => ({ ...c, [url]: d.kind === "real" ? { ...c[url], check: "real" } : { ...c[url], check: "ai", reason: d.reason } }));
  };

  const removeEditImage = (index: number) => {
    if (!editItem) return;
    setEditItem({ ...editItem, image_urls: (editItem.image_urls || []).filter((_, i) => i !== index) });
  };

  const handleEditSave = async () => {
    if (!editItem) return;
    const problems = checkEdit(editItem);
    setEditErrors(problems);
    if (Object.keys(problems).length) return;
    if (editPreviews.some((u) => editChecks[u]?.check === "checking")) {
      alert("Please wait a moment. We are still checking your new photos.");
      return;
    }
    if (editFlagged) return;
    setEditLoading(true);
    const table = editType === "lost" ? "lost_items" : "found_items";
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setEditLoading(false);
      return;
    }

    let imageUrls = editItem.image_urls || [];
    const aiNew: string[] = [];
    if (editImages.length > 0) {
      const newUrls: string[] = [];
      for (const [idx, image] of editImages.entries()) {
        const fileExt = image.name.split(".").pop();
        const fileName = `${user.id}-${Date.now()}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("item-images").upload(fileName, image);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("item-images").getPublicUrl(fileName);
          newUrls.push(urlData.publicUrl);
          if (editChecks[editPreviews[idx]]?.check === "ai") aiNew.push(urlData.publicUrl);
        }
      }
      imageUrls = [...imageUrls, ...newUrls];
    }

    const common = {
      item_name: editItem.item_name,
      category: editItem.category,
      description: editItem.description,
      location: editItem.location,
      contact_email: editItem.contact_email,
      contact_phone: normalizePhone(editItem.contact_phone || ""),
      image_urls: imageUrls,
      image_url: imageUrls[0] || "",
    };
    const updateData: Record<string, unknown> =
      editType === "lost" ? { ...common, date_lost: editItem.date_lost } : { ...common, date_found: editItem.date_found };
    // Keep AI tags in sync (only when the AI-tag columns exist or new AI photos were added)
    if (aiNew.length || Array.isArray(editItem.ai_image_urls)) {
      updateData.ai_image_urls = [...(editItem.ai_image_urls || []).filter((u) => imageUrls.includes(u)), ...aiNew];
      const newReasons = editPreviews.map((u) => editChecks[u]).filter((c) => c?.check === "ai" && c.reason).map((c) => c!.reason!);
      updateData.ai_image_reason = [...new Set([editItem.ai_image_reason, ...newReasons].filter(Boolean))].join(" | ") || null;
    }

    const { error } = await supabase.from(table).update(updateData).eq("id", editItem.id);
    if (error) alert(error.message.includes("ai_image") ? "AI image tags are not set up yet. Run the ai_image_tags SQL in Supabase first." : error.message);
    if (!error) {
      applyData(await loadData());
      closeEdit();
    }
    setEditLoading(false);
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-6 px-4 py-8 sm:px-6">
        <div className="h-40 rounded-3xl bg-slate-200" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-200" />)}
        </div>
        <div className="h-96 rounded-2xl bg-slate-200" />
      </div>
    );
  }

  const approvedCount = claims.filter((c) => c.status === "approved").length;
  const items = tab === "lost" ? lostItems : foundItems;
  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "lost", label: "Lost items", count: lostItems.length },
    { key: "found", label: "Found items", count: foundItems.length },
    { key: "claims", label: "My claims", count: claims.length },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* ── Welcome banner ── */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-700 p-6 text-white shadow-pop sm:p-8">
        <div className="animate-float absolute -right-16 -top-16 -z-10 h-64 w-64 rounded-full bg-white/10" />
        <div className="animate-float absolute -bottom-24 right-40 -z-10 h-48 w-48 rounded-full bg-fuchsia-400/20 [animation-delay:2s]" />
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-200">{greeting()} 👋</p>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">{userName ? `Welcome back, ${userName.split(" ")[0]}!` : "Welcome back!"}</h2>
            <p className="mt-2 max-w-md text-sm text-blue-100">Track your reports, follow your claims, and see what needs your attention.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/report-lost" className="group inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-rose-600 shadow-lg transition hover:-translate-y-0.5">
              <Search className="h-4 w-4" /> Report lost
            </Link>
            <Link href="/report-found" className="group inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20">
              <Package className="h-4 w-4" /> Report found
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total reports", value: lostItems.length + foundItems.length, icon: FileCheck2, tint: "bg-blue-50 text-blue-600" },
          { label: "Lost items", value: lostItems.length, icon: Search, tint: "bg-rose-50 text-rose-500" },
          { label: "Found items", value: foundItems.length, icon: Package, tint: "bg-emerald-50 text-emerald-600" },
          { label: "Approved claims", value: approvedCount, icon: CheckCircle2, tint: "bg-violet-50 text-violet-600" },
        ].map((s, i) => (
          <div
            key={s.label}
            style={{ animationDelay: `${i * 80}ms` }}
            className="animate-fade-up card-hover flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card"
          >
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

      {/* ── Finder alert ── */}
      {finderClaims.length > 0 && (
        <section className="animate-scale-in overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 shadow-card">
          <div className="flex items-start gap-4 border-b border-orange-200/70 p-5">
            <span className="animate-pulse-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-orange-900">Action required: hand items to the admin office</h2>
              <p className="text-sm text-orange-700">These items you found were claimed and verified. Please bring them to the admin office within 2 days.</p>
            </div>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {finderClaims.map((claim) => (
              <div key={claim.id} className="flex items-center gap-4 rounded-xl border border-orange-100 bg-white p-4">
                <Thumb src={firstImage(claim.found_item)} kind="found" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{claim.found_item?.item_name}</p>
                  <p className="truncate text-xs capitalize text-slate-500">{claim.found_item?.category} · {claim.found_item?.location}</p>
                  <p className="mt-1 text-xs font-semibold text-orange-600">Do not hand it to the owner directly.</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Tabs ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none]">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ${
                  tab === t.key ? "bg-white text-slate-900 shadow-card" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${tab === t.key ? "bg-brand text-white" : "bg-slate-200 text-slate-600"}`}>{t.count}</span>
              </button>
            ))}
          </div>
          {tab !== "claims" ? (
            <Link href={tab === "lost" ? "/report-lost" : "/report-found"} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
              <Plus className="h-4 w-4" /> New {tab} report
            </Link>
          ) : (
            <Link href="/matches" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
              <Sparkles className="h-4 w-4" /> Find matches
            </Link>
          )}
        </div>

        <div key={tab} className="animate-fade-in p-4 sm:p-5">
          {/* Lost / Found items */}
          {tab !== "claims" &&
            (items.length === 0 ? (
              <div className="py-14 text-center">
                <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${tab === "lost" ? "bg-rose-50 text-rose-400" : "bg-emerald-50 text-emerald-400"}`}>
                  {tab === "lost" ? <Search className="h-7 w-7" /> : <Package className="h-7 w-7" />}
                </span>
                <p className="mt-4 font-bold text-slate-800">No {tab} items yet</p>
                <p className="mt-1 text-sm text-slate-500">Your {tab} reports will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item, i) => {
                  const img = firstImage(item);
                  const kind = tab as Kind;
                  return (
                    <div
                      key={item.id}
                      style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                      className="animate-fade-up card-hover group overflow-hidden rounded-2xl border border-slate-100 bg-white"
                    >
                      <div className="relative h-40 overflow-hidden bg-slate-100">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={item.item_name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                        ) : (
                          <div className={`flex h-full items-center justify-center ${kind === "lost" ? "bg-rose-50 text-rose-300" : "bg-emerald-50 text-emerald-300"}`}>
                            {kind === "lost" ? <Search className="h-10 w-10" /> : <Package className="h-10 w-10" />}
                          </div>
                        )}
                        {img && item.ai_image_urls?.includes(img) && <AiTag className="absolute left-3 top-3" />}
                        <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold capitalize ${STATUS_STYLE[item.status] || STATUS_STYLE.searching}`}>
                          {item.status}
                        </span>
                        {/* Hover actions */}
                        <div className="absolute inset-x-0 bottom-0 flex translate-y-full justify-center gap-2 bg-gradient-to-t from-slate-950/70 to-transparent p-3 pt-8 transition-transform duration-300 group-hover:translate-y-0 max-sm:translate-y-0">
                          <button onClick={() => router.push(`/item/${item.id}`)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 transition hover:scale-110 hover:text-brand" title="View" aria-label="View">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => openEdit(item, kind)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 transition hover:scale-110 hover:text-amber-600" title="Edit" aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(item.id, kind)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 transition hover:scale-110 hover:text-rose-600" title="Delete" aria-label="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 p-4">
                        <h3 className="line-clamp-1 font-bold text-slate-900">{item.item_name}</h3>
                        <p className="flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="line-clamp-1">{item.location}</span>
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <p className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Calendar className="h-3.5 w-3.5" /> {kind === "lost" ? item.date_lost : item.date_found}
                          </p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-slate-600">{item.category}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

          {/* Claims */}
          {tab === "claims" &&
            (claims.length === 0 ? (
              <div className="py-14 text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-400">
                  <Sparkles className="h-7 w-7" />
                </span>
                <p className="mt-4 font-bold text-slate-800">No claims yet</p>
                <p className="mt-1 text-sm text-slate-500">Check the Matches page to find and claim your lost items.</p>
                <Link href="/matches" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-glow transition hover:bg-brand-dark">
                  Find matches <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {claims.map((claim, i) => {
                  const meta = CLAIM_META[claim.status] || { label: claim.status, style: "bg-slate-100 text-slate-700", icon: Clock };
                  const step = claim.status === "approved" ? 2 : claim.status === "rejected" ? -1 : 1;
                  return (
                    <div
                      key={claim.id}
                      style={{ animationDelay: `${Math.min(i, 6) * 70}ms` }}
                      className="animate-fade-up rounded-2xl border border-slate-100 p-5 transition hover:border-slate-200 hover:shadow-card"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${meta.style}`}>
                            <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                          </span>
                          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-600">{claim.match_score}% match</span>
                        </div>
                        <p className="text-xs text-slate-400">{new Date(claim.created_at).toLocaleDateString()}</p>
                      </div>

                      {/* Items side by side */}
                      <div className="mt-4 grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
                        <div className="flex items-center gap-3 rounded-xl bg-rose-50/70 p-3">
                          <Thumb src={firstImage(claim.lost_item)} kind="lost" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-extrabold tracking-wide text-rose-500">YOUR LOST ITEM</p>
                            <p className="truncate font-bold text-slate-900">{claim.lost_item?.item_name}</p>
                            <p className="truncate text-xs text-slate-500">{claim.lost_item?.location}</p>
                          </div>
                        </div>
                        <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 max-md:rotate-90">
                          <ArrowRight className="h-4 w-4" />
                        </span>
                        <div className="flex items-center gap-3 rounded-xl bg-emerald-50/70 p-3">
                          <Thumb src={firstImage(claim.found_item)} kind="found" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-extrabold tracking-wide text-emerald-600">MATCHED FOUND ITEM</p>
                            <p className="truncate font-bold text-slate-900">{claim.found_item?.item_name}</p>
                            <p className="truncate text-xs text-slate-500">{claim.found_item?.location}</p>
                          </div>
                        </div>
                      </div>

                      {/* Progress */}
                      {step > 0 && (
                        <div className="mt-5 flex items-center gap-2">
                          {["Claim submitted", "Admin verified", "Collect item"].map((label, s) => (
                            <div key={label} className="flex flex-1 items-center gap-2">
                              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${s < step ? "bg-emerald-500 text-white" : s === step ? "bg-brand text-white ring-4 ring-blue-100" : "bg-slate-100 text-slate-400"}`}>
                                {s < step ? "✓" : s + 1}
                              </span>
                              <span className={`hidden text-xs font-semibold sm:block ${s <= step ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
                              {s < 2 && <span className={`h-0.5 flex-1 rounded-full ${s < step ? "bg-emerald-400" : "bg-slate-100"}`} />}
                            </div>
                          ))}
                        </div>
                      )}

                      {claim.status === "approved" && (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                          <p className="font-bold text-emerald-800">Next step: collect your item</p>
                          <p className="mt-1 text-emerald-700">
                            Visit the <strong>Admin Office</strong> and bring your <strong>CNIC or another photo ID</strong>.
                          </p>
                          <p className="mt-2 text-xs font-semibold text-orange-600">Do not contact the finder directly. The admin handles the handover.</p>
                        </div>
                      )}
                      {claim.status === "rejected" && (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                          Your claim was not verified by the admin. This item may not belong to you.
                        </div>
                      )}
                      {claim.status === "pending_verification" && (
                        <p className="mt-4 text-sm text-slate-500">An admin is reviewing your claim. You will be notified once it is verified.</p>
                      )}
                      {claim.admin_notes && (
                        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          <strong>Admin note:</strong> {claim.admin_notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      </section>

      {editItem && editFlagged && (
        <AiImageDialog
          key={editFlagged}
          preview={editFlagged}
          score={editChecks[editFlagged]?.score ?? 1}
          defaultReason={editItem.ai_image_reason || ""}
          onDecide={(d) => decideEditAi(editFlagged, d)}
        />
      )}

      {/* ── Edit modal ── */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="animate-fade-in absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={closeEdit} />
          <div className="animate-scale-in relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit item</h2>
                <p className="text-xs text-slate-500">Update your {editType} report</p>
              </div>
              <button onClick={closeEdit} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Item name</label>
                <input type="text" name="item_name" title="item_name" maxLength={60} value={editItem.item_name} onChange={handleEditChange} className={editCls("item_name")} />
                {editErr("item_name")}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Category</label>
                  <select name="category" value={editItem.category} onChange={handleEditChange} title="category" className={inputCls}>
                    <option value="electronics">Electronics</option>
                    <option value="documents">Documents / ID Cards</option>
                    <option value="clothing">Clothing</option>
                    <option value="bags">Bags / Backpacks</option>
                    <option value="books">Books / Stationery</option>
                    <option value="jewelry">Jewelry / Accessories</option>
                    <option value="keys">Keys</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">{editType === "lost" ? "Date lost" : "Date found"}</label>
                  <input
                    type="date"
                    min={oldestReportDate()}
                    max={oldestReportDate(0)}
                    name={editType === "lost" ? "date_lost" : "date_found"}
                    title="date"
                    value={(editType === "lost" ? editItem.date_lost : editItem.date_found) || ""}
                    onChange={handleEditChange}
                    className={editCls("date")}
                  />
                  {editErr("date")}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description</label>
                <textarea name="description" title="description" maxLength={500} value={editItem.description || ""} onChange={handleEditChange} rows={3} className={`${editCls("description")} resize-none`} />
                {editErr("description")}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Location</label>
                <input type="text" name="location" title="location" value={editItem.location || ""} onChange={handleEditChange} className={editCls("location")} />
                {editErr("location")}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Contact email</label>
                  <input type="text" inputMode="email" name="contact_email" title="contact_email" placeholder="name@gmail.com" value={editItem.contact_email || ""} onChange={handleEditChange} className={editCls("contact_email")} />
                  {editErr("contact_email")}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Contact phone</label>
                  <input type="tel" inputMode="tel" maxLength={16} name="contact_phone" title="contact_phone" placeholder="03001234567" value={editItem.contact_phone || ""} onChange={handleEditChange} className={editCls("contact_phone")} />
                  {editErr("contact_phone")}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Images</label>
                <div className="grid grid-cols-3 gap-2">
                  {(editItem.image_urls || []).map((url, i) => (
                    <div key={url + i} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Image ${i + 1}`} className="h-20 w-full rounded-xl object-cover" />
                      {editItem.ai_image_urls?.includes(url) && <AiTag className="absolute bottom-1 left-1" />}
                      <button
                        type="button"
                        onClick={() => removeEditImage(i)}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white opacity-90 transition hover:scale-110"
                        aria-label="Remove image"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {editPreviews.map((preview, i) => (
                    <div key={preview} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt={`New ${i + 1}`} className="h-20 w-full rounded-xl object-cover ring-2 ring-brand" />
                      <span className="absolute left-1 top-1 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">NEW</span>
                      {editChecks[preview]?.check === "checking" && (
                        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/50 text-[10px] font-bold text-white">Checking…</span>
                      )}
                      {editChecks[preview]?.check === "ai" && <AiTag className="absolute bottom-1 left-1" />}
                    </div>
                  ))}
                  <label className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition hover:border-brand hover:bg-brand-soft hover:text-brand">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[11px] font-semibold">Add photos</span>
                    <input type="file" accept="image/*" multiple onChange={handleEditImageChange} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            {Object.keys(editErrors).length > 0 && (
              <p className="animate-fade-in border-t border-rose-100 bg-rose-50 px-6 py-2.5 text-xs font-semibold text-rose-700">
                Please fix the highlighted {Object.keys(editErrors).length === 1 ? "field" : "fields"} before saving.
              </p>
            )}
            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button onClick={closeEdit} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={editLoading} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow-glow transition hover:bg-brand-dark disabled:opacity-50">
                {editLoading ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
