"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Backpack, BookOpen, Calendar, Check, CheckCircle2, FileText, Gem, ImagePlus, Info,
  AlertCircle, Bot, KeyRound, ShieldCheck, Loader2, Lock, MapPin, Mic, Package, Search, Send, Shirt, Smartphone, Sparkles, Upload, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import LocationPicker, { type LocationValue } from "@/components/ui/LocationPicker";
import LocationMapPicker from "@/components/map/LocationMapPicker";
import { districtCenter, type MapLocation } from "@/lib/mapLocation";
import { AI_IMAGE_THRESHOLD, analyzeImage, detectAiImage } from "@/lib/aiClient";
import AiImageDialog, { AiTag, type AiDecision } from "@/components/report/AiImageDialog";
import VoiceReport, { type VoiceFields } from "@/components/report/VoiceReport";
import ReviewDialog from "@/components/report/ReviewDialog";
import { FIELD_TEXT, REPORT_TEXT, type Lang } from "@/lib/reportI18n";
import { processPost } from "@/lib/processPost";
import {
  normalizePhone, validateDate, validateDescription, validateEmail, validateImageFile, validateItemName,
  oldestReportDate, validateOtherType, validatePhone, validatePlace,
} from "@/lib/validation";

type Mode = "lost" | "found";

const CATEGORIES = [
  { value: "electronics", label: "Electronics", icon: Smartphone },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "clothing", label: "Clothing", icon: Shirt },
  { value: "bags", label: "Bags", icon: Backpack },
  { value: "books", label: "Books", icon: BookOpen },
  { value: "jewelry", label: "Jewelry", icon: Gem },
  { value: "keys", label: "Keys", icon: KeyRound },
  { value: "other", label: "Other", icon: Package },
];

const CONFIG = {
  lost: {
    table: "lost_items",
    dateColumn: "date_lost",
    status: "searching",
    Icon: Search,
    badge: "LOST",
    title: "Report a lost item",
    subtitle: "Tell us what you lost and where. We compare it with found items across all districts.",
    heroImage: "/images/home/wallet.jpg",
    namePlaceholder: "e.g. Black leather wallet",
    placeLabel: "Last seen near",
    placePlaceholder: "e.g. Main bazaar bus stand",
    dateLabel: "Date lost",
    submit: "Submit lost report",
    hero: "from-rose-600 via-rose-500 to-orange-500",
    btn: "bg-gradient-to-r from-rose-500 to-orange-500 shadow-rose-500/30",
    ring: "focus:ring-rose-300",
    soft: "bg-rose-50",
    text: "text-rose-600",
    border: "border-rose-500",
    num: "bg-rose-500",
    bar: "from-rose-500 to-orange-400",
    mapColor: "#f43f5e",
    mapTitle: "Where did you lose it?",
    mapHint: "Pin the exact spot, mark an area, or draw the route you took (e.g. between home and the bazaar).",
    successTitle: "Report submitted!",
    successText: "has been reported. We will start looking for matches.",
    steps: ["We compare it with found items", "You are notified when there is a match", "The admin verifies and arranges the handover"],
    next: { label: "Find matches now", href: "/matches" },
  },
  found: {
    table: "found_items",
    dateColumn: "date_found",
    status: "available",
    Icon: Package,
    badge: "FOUND",
    title: "Report a found item",
    subtitle: "Found something? Help it get back to its owner. It only takes two minutes.",
    heroImage: "/images/home/backpack.jpg",
    namePlaceholder: "e.g. Blue backpack",
    placeLabel: "Found near",
    placePlaceholder: "e.g. Outside the district hospital",
    dateLabel: "Date found",
    submit: "Submit found report",
    hero: "from-emerald-600 via-emerald-500 to-teal-500",
    btn: "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30",
    ring: "focus:ring-emerald-300",
    soft: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-500",
    num: "bg-emerald-500",
    bar: "from-emerald-500 to-teal-400",
    mapColor: "#10b981",
    mapTitle: "Where did you find it?",
    mapHint: "Pin the exact spot where you found it. This helps the owner confirm it is theirs.",
    successTitle: "Thank you!",
    successText: "has been reported. You are helping someone get it back.",
    steps: ["We match it with lost reports", "The owner submits a claim", "You hand the item to the admin office"],
    next: { label: "Go to dashboard", href: "/dashboard" },
  },
};

/** Today as YYYY-MM-DD in the user's own timezone. */
const localToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-transparent focus:bg-white focus:ring-2";

function Section({
  n, title, hint, done, num, delay, children,
}: { n: number; title: string; hint: string; done: boolean; num: string; delay: number; children: React.ReactNode }) {
  return (
    <section
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fade-up rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition-shadow hover:shadow-[0_14px_34px_-14px_rgba(15,23,42,0.18)]"
    >
      <div className="mb-5 flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white transition-all duration-300 ${done ? "scale-105 bg-emerald-500" : num}`}
        >
          {done ? <Check key="c" className="animate-scale-in h-4 w-4" /> : n}
        </span>
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm font-semibold text-slate-700">{children}</span>;
}

export default function ReportForm({ mode }: { mode: Mode }) {
  const cfg = CONFIG[mode];
  const router = useRouter();

  const [today] = useState(localToday);

  const [form, setForm] = useState({
    itemName: "",
    category: "",
    otherType: "",
    description: "",
    place: "",
    date: today,
    contactEmail: "",
    contactPhone: "",
  });
  const [loc, setLoc] = useState<LocationValue>({ divisionId: null, districtId: null, areaId: null });
  const [districtName, setDistrictName] = useState("");
  const [mapLoc, setMapLoc] = useState<MapLocation | null>(null);
  // Each photo also carries the result of the AI-generated-image check
  type Photo = {
    file: File;
    url: string;
    check: "checking" | "original" | "unchecked" | "flagged" | "real" | "ai";
    score?: number;
    reason?: string;
  };
  const [images, setImages] = useState<Photo[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  // Voice reporting + "confirm before posting"
  const [lang, setLang] = useState<Lang>("en");
  const [reviewing, setReviewing] = useState(false);

  // AI photo intake
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<{ text: string; warn: boolean } | null>(null);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  // ── Validation ──
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const touch = (k: string) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const errors: Record<string, string> = {
    itemName: validateItemName(form.itemName),
    category: form.category ? "" : "Please choose a category.",
    otherType: form.category === "other" ? validateOtherType(form.otherType) : "",
    description: validateDescription(form.description),
    district: loc.districtId ? "" : "Please select a division and a district.",
    map: mapLoc?.mode === "route" && mapLoc.points.length < 2 ? "You marked the start point (A). Tap the end point (B), or switch to \"Exact spot\"." : "",
    place: validatePlace(form.place),
    date: validateDate(form.date, cfg.dateLabel.toLowerCase()),
    contactEmail: validateEmail(form.contactEmail),
    contactPhone: validatePhone(form.contactPhone),
  };
  const FIELD_ORDER = ["itemName", "category", "otherType", "description", "district", "map", "place", "date", "contactEmail", "contactPhone"];
  const shown = (k: string) => (touched[k] || submitted) && !!errors[k];
  const fieldCls = (k: string) => (shown(k) ? " border-rose-400 bg-rose-50/40 focus:ring-rose-300" : "");
  const errText = (k: string) =>
    shown(k) ? (
      <p key={errors[k]} id={`${k}-error`} role="alert" className="animate-fade-down mt-1.5 flex items-start gap-1.5 text-xs font-medium text-rose-600">
        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {errors[k]}
      </p>
    ) : null;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setForm((f) => (f.contactEmail ? f : { ...f, contactEmail: user.email! }));
    });
  }, []);

  // District name for the live preview
  useEffect(() => {
    if (!loc.districtId) return;
    supabase
      .from("districts")
      .select("name")
      .eq("id", loc.districtId)
      .single()
      .then(({ data }) => setDistrictName(data?.name || ""));
  }, [loc.districtId]);

  const runAI = async (file: File) => {
    setAiBusy(true);
    setAiNote(null);
    const r = await analyzeImage(file);
    setAiBusy(false);

    if (!r) {
      setAiNote({ text: "AI could not read this photo. Please fill the form yourself.", warn: false });
      return;
    }

    // Only fill fields the user has not typed yet
    setForm((f) => ({
      ...f,
      itemName: f.itemName || r.name,
      category: f.category || r.category,
      description: f.description || [r.description, r.marks && `Marks: ${r.marks}`].filter(Boolean).join(" "),
    }));

    setAiNote(
      r.sensitive
        ? { text: "This photo appears to show an ID or personal document. Avoid publishing it. Hand it to the admin office instead.", warn: true }
        : { text: "Filled from your photo. Please check the details.", warn: false }
    );
  };

  const addFiles = (picked: File[]) => {
    const bad = picked.map(validateImageFile).find(Boolean);
    const onlyImages = picked.filter((f) => !validateImageFile(f));
    if (bad) setError(bad);
    if (onlyImages.length === 0) return;
    if (images.length + onlyImages.length > 5) {
      setError("You can add up to 5 photos");
      return;
    }
    if (!bad) setError("");
    const added: Photo[] = onlyImages.map((file) => ({ file, url: URL.createObjectURL(file), check: "checking" }));
    setImages((prev) => [...prev, ...added]);
    // Read the first photo with AI
    if (images.length === 0) runAI(onlyImages[0]);
    // Check every new photo for AI generation
    added.forEach((ph) => {
      detectAiImage(ph.file).then((score) =>
        setImages((prev) =>
          prev.map((p) =>
            p.url !== ph.url
              ? p
              : { ...p, score: score ?? undefined, check: score === null ? "unchecked" : score >= AI_IMAGE_THRESHOLD ? "flagged" : "original" }
          )
        )
      );
    });
  };

  // The first photo waiting for the user's answer opens the AI dialog
  const flagged = images.find((p) => p.check === "flagged");
  const lastReason = images.find((p) => p.check === "ai")?.reason || "";
  const decideAi = (url: string, d: AiDecision) => {
    if (d.kind === "remove") {
      const i = images.findIndex((p) => p.url === url);
      if (i >= 0) removeImage(i);
      return;
    }
    setImages((prev) =>
      prev.map((p) => (p.url !== url ? p : d.kind === "real" ? { ...p, check: "real" } : { ...p, check: "ai", reason: d.reason }))
    );
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files || []));
  };

  const removeImage = (i: number) =>
    setImages((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, x) => x !== i);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitted(true);

    if (images.some((p) => p.check === "checking")) {
      setError("Please wait a few seconds. We are still checking your photos, then press the button again.");
      return;
    }
    if (images.some((p) => p.check === "flagged")) {
      setError("Please answer the question about your AI-looking photo first.");
      return;
    }

    const firstBad = FIELD_ORDER.find((k) => errors[k]);
    if (firstBad) {
      const count = FIELD_ORDER.filter((k) => errors[k]).length;
      setError(count === 1 ? errors[firstBad] : `Please fix the ${count} highlighted fields before submitting.`);
      document.getElementById(`field-${firstBad}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Everything is valid: ask the user to confirm the details before posting
    setReviewing(true);
  };

  // Fill the form from what the user said. Returns the required fields still missing.
  const applyVoice = (v: VoiceFields): string[] => {
    const next = {
      ...form,
      itemName: v.itemName || form.itemName,
      category: v.category || form.category,
      otherType: v.category === "other" ? v.otherType || form.otherType : form.otherType,
      description: v.description || form.description,
      place: v.place || form.place,
      date: v.date && !validateDate(v.date, cfg.dateLabel.toLowerCase()) ? v.date : form.date,
      contactPhone: v.contactPhone && !validatePhone(v.contactPhone) ? v.contactPhone : form.contactPhone,
    };
    setForm(next);
    const districtId = v.district?.id ?? loc.districtId;
    if (v.district) setLoc({ divisionId: v.district.division_id, districtId: v.district.id, areaId: null });

    // Show errors only on fields the voice filled, so the user sees what to fix
    const filled = (["itemName", "category", "otherType", "description", "place", "date"] as const).filter((k) => v[k]);
    setTouched((t) => ({ ...t, ...Object.fromEntries(filled.map((k) => [k, true])), ...(v.district ? { district: true } : {}) }));

    const missing: string[] = [];
    if (validateItemName(next.itemName)) missing.push("itemName");
    if (!next.category) missing.push("category");
    if (validateDescription(next.description)) missing.push("description");
    if (!districtId) missing.push("district");
    if (validatePlace(next.place)) missing.push("place");
    setTimeout(() => document.getElementById(`field-${missing[0] || "itemName"}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
    return missing.map((k) => FIELD_TEXT[lang][k]);
  };

  /** Shows a failure next to the Submit button and closes the confirm popup. */
  const failPost = (text: string, detail?: unknown) => {
    console.error("Report posting failed:", text, detail ?? "");
    setError(text);
    setLoading(false);
    setReviewing(false);
    setTimeout(() => document.getElementById("report-submit")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const postReport = async () => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      await savePost();
    } catch (e) {
      // Network drop or unexpected error: never leave the popup stuck on "Posting…"
      failPost("Could not post your report. Please check your internet connection and try again.", e);
    }
  };

  const savePost = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setReviewing(false);
      router.push("/login");
      return;
    }

    const urls: string[] = [];
    const aiUrls: string[] = [];
    for (const ph of images) {
      const ext = ph.file.name.split(".").pop();
      const name = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("item-images").upload(name, ph.file);
      if (upErr) {
        console.error("Photo upload failed:", upErr.message);
        continue;
      }
      const publicUrl = supabase.storage.from("item-images").getPublicUrl(name).data.publicUrl;
      urls.push(publicUrl);
      if (ph.check === "ai") aiUrls.push(publicUrl);
    }
    const aiReason = [...new Set(images.filter((p) => p.check === "ai" && p.reason).map((p) => p.reason!))].join(" | ");

    const payload: Record<string, unknown> = {
      user_id: user.id,
      item_name: form.itemName.trim(),
      category: form.category,
      description:
        form.category === "other" && form.otherType.trim()
          ? `Item type: ${form.otherType.trim()}\n${form.description.trim()}`
          : form.description.trim(),
      location: form.place.trim(),
      district_id: loc.districtId,
      area_id: loc.areaId,
      contact_email: form.contactEmail.trim(),
      contact_phone: normalizePhone(form.contactPhone),
      image_url: urls[0] || "",
      image_urls: urls,
      status: cfg.status,
      [cfg.dateColumn]: form.date,
    };
    // Only sent when needed, so reports still work before the AI-tag SQL has been run
    if (mapLoc) payload.map_location = mapLoc;
    if (aiUrls.length) {
      payload.ai_image_urls = aiUrls;
      payload.ai_image_reason = aiReason;
    }

    const { data: inserted, error: insErr } = await supabase.from(cfg.table).insert(payload).select("id").single();
    if (insErr) {
      failPost(
        insErr.message.includes("map_location")
          ? "Map locations are not set up yet. Ask the admin to run the map_location SQL in Supabase, or clear the map pin."
          : insErr.message.includes("ai_image")
          ? "AI image tags are not set up yet. Ask the admin to run the ai_image_tags SQL in Supabase, or remove the AI image."
          : `Could not post: ${insErr.message}`,
        insErr
      );
      return;
    }

    // Scam check + match alerts run on the server in the background
    if (inserted?.id) processPost(mode, inserted.id);

    setReviewing(false);
    setSaved(form.itemName.trim());
    setLoading(false);
  };

  const closeReview = useCallback(() => setReviewing(false), []);

  const reportAnother = () => {
    setSaved(null);
    setForm((f) => ({ itemName: "", category: "", otherType: "", description: "", place: "", date: today, contactEmail: f.contactEmail, contactPhone: "" }));
    setLoc({ divisionId: null, districtId: null, areaId: null });
    setMapLoc(null);
    setImages([]);
    setAiNote(null);
    setTouched({});
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ring = `${inputBase} ${cfg.ring}`;

  // Progress
  const done = {
    details: !errors.itemName && !errors.category && !errors.otherType && !errors.description,
    where: !errors.district && !errors.map && !errors.place && !errors.date,
    photos: images.length > 0,
    contact: !errors.contactEmail && !errors.contactPhone,
  };
  const progress = Math.round((Object.values(done).filter(Boolean).length / 4) * 100);
  const categoryMeta = CATEGORIES.find((c) => c.value === form.category);

  return (
    <div className="pb-16">
      {/* ── Hero ── */}
      <div className={`relative isolate overflow-hidden bg-gradient-to-br ${cfg.hero} px-4 pb-28 pt-8 sm:px-6`}>
        <div className="animate-float absolute -right-16 -top-20 -z-10 h-72 w-72 rounded-full bg-white/10" />
        <div className="animate-float absolute -bottom-24 left-1/3 -z-10 h-56 w-56 rounded-full bg-white/10 [animation-delay:2s]" />

        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8">
          <div className="text-white">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/30"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {/* Lost / Found switch */}
              <div className="relative flex rounded-full bg-black/15 p-1 backdrop-blur">
                <span
                  className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-white shadow transition-transform duration-300 ease-out ${mode === "lost" ? "translate-x-0" : "translate-x-full"}`}
                />
                <Link href="/report-lost" className={`relative z-10 w-24 rounded-full py-1.5 text-center text-xs font-bold transition-colors ${mode === "lost" ? "text-rose-600" : "text-white/80 hover:text-white"}`}>
                  I lost
                </Link>
                <Link href="/report-found" className={`relative z-10 w-24 rounded-full py-1.5 text-center text-xs font-bold transition-colors ${mode === "found" ? "text-emerald-600" : "text-white/80 hover:text-white"}`}>
                  I found
                </Link>
              </div>
            </div>

            <div className="animate-fade-up mt-7 flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-pop">
                <cfg.Icon className={`h-7 w-7 ${cfg.text}`} />
              </span>
              <div>
                <h1 className="text-3xl font-extrabold sm:text-4xl">{cfg.title}</h1>
                <p className="mt-1 max-w-xl text-sm text-white/85">{cfg.subtitle}</p>
              </div>
            </div>
          </div>

          <div className="animate-scale-in relative hidden h-44 w-40 shrink-0 rotate-6 md:block [animation-delay:200ms]">
            <div className="animate-float h-full w-full overflow-hidden rounded-3xl border-4 border-white/80 shadow-pop">
              <Image src={cfg.heroImage} alt="" fill sizes="160px" className="object-cover" />
            </div>
            <span className={`absolute -left-3 top-4 rounded-full bg-white px-3 py-1 text-[10px] font-extrabold tracking-wide shadow ${cfg.text}`}>{cfg.badge}</span>
          </div>
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit} className="relative mx-auto -mt-16 grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {error && (
            <div className="animate-fade-down flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-card">
              <X className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* Voice report (English / Urdu) — optional shortcut that fills the form */}
          <section className="animate-fade-up overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-card">
            <div className="flex items-center gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-white px-6 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white">
                <Mic className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-x-2 font-bold text-slate-900">
                  {REPORT_TEXT[lang].voiceTitle}
                  <span className="text-xs font-semibold text-violet-500">English · اردو</span>
                </h2>
                <p className="text-xs text-slate-500" dir={lang === "ur" ? "rtl" : "ltr"}>{REPORT_TEXT[lang].voiceHint}</p>
              </div>
              <span className="hidden rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-2.5 py-1 text-[10px] font-bold text-white sm:inline-flex sm:items-center sm:gap-1">
                <Sparkles className="h-3 w-3" /> AI
              </span>
            </div>
            <div className="p-6">
              <VoiceReport
                mode={mode}
                lang={lang}
                onLangChange={setLang}
                today={today}
                onResult={applyVoice}
                accentText={cfg.text}
                accentBtn={cfg.btn}
              />
            </div>
          </section>

          {/* 1. Photos first — AI can fill the rest */}
          <Section n={1} title={`Photos (${images.length}/5)`} hint="Add a photo and AI fills in the details for you" done={done.photos} num={cfg.num} delay={0}>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`group relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all duration-200 ${
                dragging ? `${cfg.border} ${cfg.soft} scale-[1.01]` : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
              } ${images.length >= 5 ? "pointer-events-none opacity-50" : ""}`}
            >
              <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-card transition-transform duration-300 group-hover:-translate-y-1 ${cfg.text}`}>
                <Upload className="h-6 w-6" />
              </span>
              <p className="text-sm font-bold text-slate-800">
                {dragging ? "Drop your photos here" : <>Drag photos here or <span className={cfg.text}>browse</span></>}
              </p>
              <p className="text-xs text-slate-500">Up to 5 images · JPG, PNG</p>
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-2.5 py-1 text-[10px] font-bold text-white">
                <Sparkles className="h-3 w-3" /> AI autofill
              </span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={onPick} disabled={images.length >= 5} />
            </label>

            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {images.map((img, i) => (
                  <div key={img.url} className="animate-scale-in group relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={`Photo ${i + 1}`} className="h-full w-full rounded-xl object-cover" />
                    {i === 0 && img.check !== "ai" && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold text-white">Cover</span>}
                    {img.check === "checking" && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-slate-950/55 text-[10px] font-bold text-white backdrop-blur-[2px]">
                        <Loader2 className="h-4 w-4 animate-spin" /> Checking…
                      </span>
                    )}
                    {img.check === "original" && (
                      <span title="Looks like an original photo" className="animate-scale-in absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                        <ShieldCheck className="h-3 w-3" />
                      </span>
                    )}
                    {img.check === "ai" && <AiTag className="animate-scale-in absolute bottom-1.5 left-1.5" />}
                    {img.check === "flagged" && (
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">Needs answer</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-white shadow transition hover:scale-110"
                      aria-label="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-600">
                    <ImagePlus className="h-6 w-6" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
                  </label>
                )}
              </div>
            )}

            {images.some((p) => p.check === "ai") && (
              <p className="animate-fade-up mt-4 flex items-start gap-2 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">
                <Bot className="mt-0.5 h-4 w-4 shrink-0" /> Photos marked <strong>&nbsp;AI IMAGE&nbsp;</strong> will show that tag and your reason to everyone.
              </p>
            )}

            {aiBusy && (
              <div className="animate-fade-in mt-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-50 to-blue-50 px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                <p className="text-sm font-semibold text-violet-700">AI is reading your photo…</p>
                <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-white">
                  <div className="animate-gradient h-full w-full bg-gradient-to-r from-violet-500 via-blue-400 to-violet-500 bg-[length:200%_auto]" />
                </div>
              </div>
            )}
            {aiNote && !aiBusy && (
              <p className={`animate-fade-up mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${aiNote.warn ? "bg-amber-50 text-amber-800" : "bg-violet-50 text-violet-800"}`}>
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> {aiNote.text}
              </p>
            )}
          </Section>

          {/* 2. Item */}
          <Section n={2} title="Item details" hint="What is it and how can it be recognised?" done={done.details} num={cfg.num} delay={80}>
            <div className="space-y-5">
              <label className="block" id="field-itemName">
                <Label>Item name</Label>
                <input
                  className={ring + fieldCls("itemName")}
                  maxLength={60}
                  placeholder={cfg.namePlaceholder}
                  value={form.itemName}
                  onChange={(e) => set("itemName")(e.target.value)}
                  onBlur={touch("itemName")}
                  aria-invalid={shown("itemName")}
                  aria-describedby="itemName-error"
                />
                {errText("itemName")}
              </label>

              <div id="field-category">
                <Label>Category</Label>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {CATEGORIES.map((c) => {
                    const active = form.category === c.value;
                    return (
                      <button
                        type="button"
                        key={c.value}
                        onClick={() => set("category")(c.value)}
                        className={`group flex flex-col items-center gap-1.5 rounded-xl border-2 px-1 py-3 text-[11px] font-semibold transition-all duration-200 sm:text-xs ${
                          active ? `${cfg.border} ${cfg.soft} ${cfg.text} scale-[1.03] shadow-card` : "border-slate-100 bg-slate-50 text-slate-600 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                        }`}
                      >
                        <c.icon className={`h-6 w-6 transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-110"}`} />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                {errText("category")}

                {form.category === "other" && (
                  <div id="field-otherType" className={`animate-fade-down mt-4 rounded-2xl border-2 border-dashed p-4 ${cfg.border} ${cfg.soft}`}>
                    <label className="block">
                      <span className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-800">
                        <Package className={`h-4 w-4 ${cfg.text}`} /> What kind of item is it?
                      </span>
                      <span className="mb-2.5 block text-xs text-slate-500">
                        None of the categories fit, so tell us in a few words. Example: Umbrella, Wrist watch, Toy car, Water bottle.
                      </span>
                      <input
                        autoFocus
                        maxLength={40}
                        className={`${ring} bg-white${fieldCls("otherType")}`}
                        placeholder="e.g. Umbrella"
                        value={form.otherType}
                        onChange={(e) => set("otherType")(e.target.value)}
                        onBlur={touch("otherType")}
                        aria-invalid={shown("otherType")}
                        aria-describedby="otherType-error"
                      />
                    </label>
                    {errText("otherType")}
                  </div>
                )}
              </div>

              <label className="block" id="field-description">
                <span className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Description</span>
                  <span className={`text-xs ${form.description.length > 450 ? "text-amber-600" : "text-slate-400"}`}>{form.description.length}/500</span>
                </span>
                <textarea
                  rows={4}
                  maxLength={500}
                  className={`${ring} resize-none${fieldCls("description")}`}
                  placeholder="Colour, brand, size and any marks that identify it"
                  value={form.description}
                  onChange={(e) => set("description")(e.target.value)}
                  onBlur={touch("description")}
                  aria-invalid={shown("description")}
                  aria-describedby="description-error"
                />
                {errText("description")}
              </label>
            </div>
          </Section>

          {/* 3. Where and when */}
          <Section n={3} title="Where and when" hint="The exact district helps us find local matches first" done={done.where} num={cfg.num} delay={160}>
            <div className="space-y-5">
              <div id="field-district">
                <LocationPicker value={loc} onChange={(v) => { setLoc(v); if (v.districtId) setTouched((t) => ({ ...t, district: true })); }} />
                {errText("district")}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block" id="field-place">
                  <Label>{cfg.placeLabel}</Label>
                  <div className="relative">
                    <input
                      className={ring + fieldCls("place")}
                      placeholder={cfg.placePlaceholder}
                      value={form.place}
                      onChange={(e) => set("place")(e.target.value)}
                      onBlur={touch("place")}
                      aria-invalid={shown("place")}
                      aria-describedby="place-error"
                    />
                  </div>
                  {errText("place")}
                </label>
                <label className="block" id="field-date">
                  <Label>{cfg.dateLabel}</Label>
                  <input
                    type="date"
                    min={oldestReportDate()}
                    max={today}
                    className={ring + fieldCls("date")}
                    value={form.date}
                    onChange={(e) => { set("date")(e.target.value); setTouched((t) => ({ ...t, date: true })); }}
                    aria-invalid={shown("date")}
                    aria-describedby="date-error"
                  />
                  {errText("date") || <p className="mt-1.5 text-[11px] text-slate-400">Any day from the last 2 years up to today.</p>}
                </label>
              </div>

              {/* Map */}
              <div id="field-map" className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                      <MapPin className={`h-4 w-4 ${cfg.text}`} /> {cfg.mapTitle}
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-400 ring-1 ring-slate-200">Recommended</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{cfg.mapHint}</p>
                  </div>
                </div>
                <LocationMapPicker
                  value={mapLoc}
                  onChange={setMapLoc}
                  accent={cfg.mapColor}
                  flyTo={loc.districtId ? districtCenter(districtName) : null}
                  onPlaceName={(name) => setForm((f) => (f.place.trim() ? f : { ...f, place: name }))}
                />
                {errText("map")}
              </div>
            </div>
          </Section>

          {/* 4. Contact */}
          <Section n={4} title="Contact details" hint="Only you and the admin can see these" done={done.contact} num={cfg.num} delay={240}>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block" id="field-contactEmail">
                <Label>Email</Label>
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  className={ring + fieldCls("contactEmail")}
                  placeholder="name@gmail.com"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail")(e.target.value)}
                  onBlur={touch("contactEmail")}
                  aria-invalid={shown("contactEmail")}
                  aria-describedby="contactEmail-error"
                />
                {errText("contactEmail")}
              </label>
              <label className="block" id="field-contactPhone">
                <Label>Phone (optional)</Label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={16}
                  className={ring + fieldCls("contactPhone")}
                  placeholder="03001234567 or +923001234567"
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone")(e.target.value)}
                  onBlur={touch("contactPhone")}
                  aria-invalid={shown("contactPhone")}
                  aria-describedby="contactPhone-error"
                />
                {errText("contactPhone")}
              </label>
            </div>
            <div className="mt-5 flex gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              Your contact details are private. They are never shown on the public listing.
            </div>
          </Section>

          {/* Repeat the message next to the button so it is never missed at the top of the page */}
          {error && (
            <div role="alert" className="animate-fade-down flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          {images.some((p) => p.check === "checking") && (
            <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking your photos… you can post as soon as this finishes.
            </p>
          )}

          <button
            id="report-submit"
            type="submit"
            disabled={loading}
            className={`group flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 disabled:translate-y-0 disabled:opacity-60 ${cfg.btn}`}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Submitting…
              </>
            ) : (
              <>
                <Send className="h-5 w-5 transition-transform group-hover:-rotate-12 group-hover:translate-x-0.5" /> {cfg.submit}
              </>
            )}
          </button>
        </div>

        {/* ── Sidebar: progress, preview, tips ── */}
        <aside className="h-fit space-y-5 lg:sticky lg:top-24">
          {/* Progress */}
          <div className="animate-fade-up rounded-2xl border border-slate-100 bg-white p-5 shadow-card [animation-delay:120ms]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">Report progress</p>
              <p className={`text-sm font-extrabold ${progress === 100 ? "text-emerald-600" : cfg.text}`}>{progress}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${progress === 100 ? "from-emerald-500 to-teal-400" : cfg.bar}`} style={{ width: `${Math.max(progress, 4)}%` }} />
            </div>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                { label: "Photos", ok: done.photos, optional: true },
                { label: "Item details", ok: done.details },
                { label: "Where and when", ok: done.where },
                { label: "Contact details", ok: done.contact },
              ].map((s) => (
                <li key={s.label} className="flex items-center gap-2.5">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-300 ${s.ok ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-300"}`}>
                    <Check className="h-3 w-3" />
                  </span>
                  <span className={s.ok ? "font-medium text-slate-800" : "text-slate-500"}>{s.label}</span>
                  {s.optional && !s.ok && <span className="text-[11px] text-slate-400">(recommended)</span>}
                </li>
              ))}
            </ul>
          </div>

          {/* Live preview */}
          <div className="animate-fade-up overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card [animation-delay:200ms]">
            <p className="border-b border-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">Live preview</p>
            <div className="relative h-40 bg-slate-100">
              {images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={images[0].url} src={images[0].url} alt="" className="animate-fade-in h-full w-full object-cover" />
              ) : (
                <div className={`flex h-full items-center justify-center ${cfg.soft} ${cfg.text} opacity-60`}>
                  <cfg.Icon className="h-10 w-10" />
                </div>
              )}
              <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-extrabold tracking-wide text-white ${cfg.num}`}>{cfg.badge}</span>
              {images[0]?.check === "ai" && <AiTag className="absolute bottom-3 left-3" />}
            </div>
            <div className="space-y-2 p-4">
              <p className={`line-clamp-1 font-bold ${form.itemName ? "text-slate-900" : "text-slate-300"}`}>{form.itemName || "Item name"}</p>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-1">
                  {[form.place, loc.districtId ? districtName : ""].filter(Boolean).join(", ") || "Location"}
                </span>
              </p>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="h-3.5 w-3.5" /> {form.date}
                  {mapLoc && <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 text-[10px] font-bold text-blue-600"><MapPin className="h-2.5 w-2.5" /> On map</span>}
                </p>
                {categoryMeta && (
                  <span className="animate-scale-in inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    <categoryMeta.icon className="h-3 w-3" /> {form.category === "other" && form.otherType.trim() ? form.otherType.trim() : categoryMeta.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="animate-fade-up rounded-2xl border border-slate-100 bg-white p-5 shadow-card [animation-delay:280ms]">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Info className={`h-4 w-4 ${cfg.text}`} /> Reports that get results
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600">
              {["Pick the exact district so local matches show first", "Add at least one clear photo", "Mention unique marks, stickers or scratches", "Use a landmark everyone knows"].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.text}`} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </form>

      {/* ── Success ── */}
      {flagged && !saved && (
        <AiImageDialog
          key={flagged.url}
          preview={flagged.url}
          score={flagged.score ?? 1}
          defaultReason={lastReason}
          onDecide={(d) => decideAi(flagged.url, d)}
        />
      )}

      {reviewing && !saved && (
        <ReviewDialog
          mode={mode}
          lang={lang}
          onLangChange={setLang}
          busy={loading}
          accentText={cfg.text}
          accentBtn={cfg.btn}
          accentNum={cfg.num}
          onConfirm={postReport}
          onEdit={closeReview}
          data={{
            itemName: form.itemName.trim(),
            category: form.category,
            otherType: form.otherType.trim(),
            description: form.description.trim(),
            district: districtName,
            place: form.place.trim(),
            date: form.date,
            hasMap: !!mapLoc,
            email: form.contactEmail.trim(),
            phone: normalizePhone(form.contactPhone),
            photos: images.map((p) => ({ url: p.url, ai: p.check === "ai" })),
          }}
        />
      )}

      {saved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
          <div className="animate-fade-in absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <div className="animate-scale-in relative w-full max-w-md overflow-hidden rounded-3xl bg-white text-center shadow-pop">
            <div className={`relative bg-gradient-to-br ${cfg.hero} px-8 pb-10 pt-8`}>
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
              <span className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-pop">
                <span className="absolute inset-0 animate-ping rounded-full bg-white/60" />
                <CheckCircle2 className={`relative h-11 w-11 ${cfg.text}`} />
              </span>
              <h2 className="mt-5 text-2xl font-extrabold text-white">{cfg.successTitle}</h2>
              <p className="mt-1 text-sm text-white/90">
                <span className="font-bold">&quot;{saved}&quot;</span> {cfg.successText}
              </p>
            </div>

            <div className="p-6">
              <p className="mb-3 text-left text-sm font-bold text-slate-900">What happens next</p>
              <ol className="space-y-3 text-left">
                {cfg.steps.map((s, i) => (
                  <li key={s} style={{ animationDelay: `${300 + i * 120}ms` }} className="animate-fade-up flex items-center gap-3 text-sm text-slate-600">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${cfg.num}`}>{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>

              <div className="mt-6 space-y-3">
                <button onClick={() => router.push(cfg.next.href)} className={`w-full rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:brightness-105 ${cfg.btn}`}>
                  {cfg.next.label}
                </button>
                <button
                  onClick={() => router.push(mode === "lost" ? "/dashboard" : "/")}
                  className="w-full rounded-xl bg-slate-100 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                >
                  {mode === "lost" ? "Go to dashboard" : "Back to home"}
                </button>
                <button onClick={reportAnother} className="text-sm font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline">
                  Report another item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
