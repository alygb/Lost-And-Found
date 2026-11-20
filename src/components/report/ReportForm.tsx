"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Package, Smartphone, FileText, Shirt, Backpack, BookOpen, Gem,
  KeyRound, ImagePlus, X, Send, CheckCircle2, Info, ArrowLeft, Loader2, Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import LocationPicker, { type LocationValue } from "@/components/ui/LocationPicker";
import { analyzeImage } from "@/lib/aiClient";

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
    title: "Report a lost item",
    subtitle: "Tell us what you lost and where. We compare it with found items across all districts.",
    namePlaceholder: "e.g. Black leather wallet",
    placeLabel: "Last seen near",
    placePlaceholder: "e.g. Main bazaar bus stand",
    dateLabel: "Date lost",
    submit: "Submit lost report",
    hero: "from-red-500 to-rose-600",
    btn: "bg-red-500 hover:bg-red-600 shadow-red-200",
    ring: "focus:ring-red-300",
    soft: "bg-red-50",
    text: "text-red-600",
    border: "border-red-500",
    num: "bg-red-500",
    successTitle: "Report submitted",
    successText: "has been reported. We will start looking for matches.",
    steps: [
      "We compare it with found items",
      "You are notified when there is a match",
      "The admin verifies and arranges the handover",
    ],
    next: { label: "Find matches now", href: "/matches" },
  },
  found: {
    table: "found_items",
    dateColumn: "date_found",
    status: "available",
    Icon: Package,
    title: "Report a found item",
    subtitle: "Found something? Help it get back to its owner.",
    namePlaceholder: "e.g. Blue backpack",
    placeLabel: "Found near",
    placePlaceholder: "e.g. Outside the district hospital",
    dateLabel: "Date found",
    submit: "Submit found report",
    hero: "from-emerald-500 to-teal-600",
    btn: "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200",
    ring: "focus:ring-emerald-300",
    soft: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-500",
    num: "bg-emerald-500",
    successTitle: "Thank you",
    successText: "has been reported. You are helping someone get it back.",
    steps: [
      "We match it with lost reports",
      "The owner submits a claim",
      "You hand the item to the admin office",
    ],
    next: { label: "Go to dashboard", href: "/dashboard" },
  },
};

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-transparent focus:bg-white focus:ring-2";

function Section({
  n, title, num, children,
}: { n: number; title: string; num: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-card">
      <div className="mb-5 flex items-center gap-3">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white ${num}`}>
          {n}
        </span>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
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

  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  const [form, setForm] = useState({
    itemName: "",
    category: "",
    description: "",
    place: "",
    date: today,
    contactEmail: "",
    contactPhone: "",
  });
  const [loc, setLoc] = useState<LocationValue>({
    divisionId: null,
    districtId: null,
    areaId: null,
  });
  const [images, setImages] = useState<{ file: File; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  // AI photo intake
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<{ text: string; warn: boolean } | null>(null);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setForm((f) => (f.contactEmail ? f : { ...f, contactEmail: user.email! }));
      }
    });
  }, []);

  const runAI = async (file: File) => {
    setAiBusy(true);
    setAiNote(null);
    const r = await analyzeImage(file);
    setAiBusy(false);

    if (!r) {
      setAiNote({
        text: "AI could not read this photo. Please fill the form yourself.",
        warn: false,
      });
      return;
    }

    // Only fill fields the user has not typed yet
    setForm((f) => ({
      ...f,
      itemName: f.itemName || r.name,
      category: f.category || r.category,
      description:
        f.description ||
        [r.description, r.marks && `Marks: ${r.marks}`].filter(Boolean).join(" "),
    }));

    setAiNote(
      r.sensitive
        ? {
            text: "This photo appears to show an ID or personal document. Avoid publishing it. Hand it to the admin office instead.",
            warn: true,
          }
        : { text: "Filled from your photo. Please check the details.", warn: false }
    );
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (images.length + picked.length > 5) {
      setError("You can add up to 5 photos");
      return;
    }
    setError("");
    setImages((prev) => [
      ...prev,
      ...picked.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);

    // Read the first photo with AI
    if (images.length === 0 && picked[0]) runAI(picked[0]);

    e.target.value = "";
  };

  const removeImage = (i: number) =>
    setImages((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, x) => x !== i);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.category) return setError("Please choose a category");
    if (!loc.districtId) return setError("Please select a division and a district");

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const urls: string[] = [];
    for (const { file } of images) {
      const ext = file.name.split(".").pop();
      const name = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("item-images")
        .upload(name, file);
      if (!upErr) {
        urls.push(
          supabase.storage.from("item-images").getPublicUrl(name).data.publicUrl
        );
      }
    }

    const payload: Record<string, any> = {
      user_id: user.id,
      item_name: form.itemName.trim(),
      category: form.category,
      description: form.description.trim(),
      location: form.place.trim(),
      district_id: loc.districtId,
      area_id: loc.areaId,
      contact_email: form.contactEmail.trim(),
      contact_phone: form.contactPhone.trim(),
      image_url: urls[0] || "",
      image_urls: urls,
      status: cfg.status,
    };
    payload[cfg.dateColumn] = form.date;

    const { error: insErr } = await supabase.from(cfg.table).insert(payload);

    if (insErr) {
      setError(insErr.message);
      setLoading(false);
      return;
    }

    setSaved(form.itemName.trim());
    setLoading(false);
  };

  const reportAnother = () => {
    setSaved(null);
    setForm((f) => ({
      itemName: "",
      category: "",
      description: "",
      place: "",
      date: today,
      contactEmail: f.contactEmail,
      contactPhone: "",
    }));
    setLoc({ divisionId: null, districtId: null, areaId: null });
    setImages([]);
    setAiNote(null);
  };

  const ring = `${inputBase} ${cfg.ring}`;

  return (
    <div className="min-h-screen pb-16">
      {/* Hero */}
      <div className={`relative overflow-hidden bg-linear-to-br ${cfg.hero} px-4 pb-24 pt-10`}>
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-white/10" />
        <div className="relative mx-auto max-w-6xl">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-card">
              <cfg.Icon className={`h-7 w-7 ${cfg.text}`} />
            </span>
            <div>
              <h1 className="text-3xl font-extrabold text-white">{cfg.title}</h1>
              <p className="mt-1 max-w-xl text-sm text-white/85">{cfg.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto -mt-14 grid max-w-6xl gap-6 px-4 lg:grid-cols-3"
      >
        <div className="space-y-6 lg:col-span-2">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* 1. Item */}
          <Section n={1} title="Item details" num={cfg.num}>
            <div className="space-y-5">
              <label className="block">
                <Label>Item name</Label>
                <input
                  required
                  className={ring}
                  placeholder={cfg.namePlaceholder}
                  value={form.itemName}
                  onChange={(e) => set("itemName")(e.target.value)}
                />
              </label>

              <div>
                <Label>Category</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {CATEGORIES.map((c) => {
                    const active = form.category === c.value;
                    return (
                      <button
                        type="button"
                        key={c.value}
                        onClick={() => set("category")(c.value)}
                        className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-2 py-4 text-xs font-semibold transition ${
                          active
                            ? `${cfg.border} ${cfg.soft} ${cfg.text}`
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <c.icon className="h-6 w-6" />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <Label>Description</Label>
                <textarea
                  required
                  rows={4}
                  className={`${ring} resize-none`}
                  placeholder="Colour, brand, size and any marks that identify it"
                  value={form.description}
                  onChange={(e) => set("description")(e.target.value)}
                />
              </label>
            </div>
          </Section>

          {/* 2. Where and when */}
          <Section n={2} title="Where and when" num={cfg.num}>
            <div className="space-y-5">
              <LocationPicker value={loc} onChange={setLoc} />

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <Label>{cfg.placeLabel}</Label>
                  <input
                    required
                    className={ring}
                    placeholder={cfg.placePlaceholder}
                    value={form.place}
                    onChange={(e) => set("place")(e.target.value)}
                  />
                </label>
                <label className="block">
                  <Label>{cfg.dateLabel}</Label>
                  <input
                    required
                    type="date"
                    max={today}
                    className={ring}
                    value={form.date}
                    onChange={(e) => set("date")(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </Section>

          {/* 3. Photos */}
          <Section n={3} title={`Photos (${images.length}/5)`} num={cfg.num}>
            <div className="flex flex-wrap gap-3">
              {images.map((img, i) => (
                <div key={img.url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={`Photo ${i + 1}`}
                    className="h-24 w-24 rounded-2xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-red-500 text-white"
                    aria-label="Remove photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {images.length < 5 && (
                <label
                  className={`flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-xs font-semibold transition hover:bg-slate-50 ${cfg.border} ${cfg.text}`}
                >
                  <ImagePlus className="h-6 w-6" />
                  Add photo
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={onPick}
                  />
                </label>
              )}
            </div>

            {aiBusy && (
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand">
                <Loader2 className="h-4 w-4 animate-spin" /> AI is reading your photo…
              </p>
            )}
            {aiNote && !aiBusy && (
              <p
                className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
                  aiNote.warn ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"
                }`}
              >
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> {aiNote.text}
              </p>
            )}

            <p className="mt-4 text-xs text-slate-400">
              Clear photos help the owner recognise the item. Add a photo and AI fills the form for you.
            </p>
          </Section>

          {/* 4. Contact */}
          <Section n={4} title="Contact details" num={cfg.num}>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <Label>Email</Label>
                <input
                  required
                  type="email"
                  className={ring}
                  placeholder="you@example.com"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail")(e.target.value)}
                />
              </label>
              <label className="block">
                <Label>Phone (optional)</Label>
                <input
                  type="tel"
                  className={ring}
                  placeholder="03001234567"
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone")(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-5 flex gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Your contact details are private. Only you and the admin can see them.
            </div>
          </Section>

          <button
            type="submit"
            disabled={loading}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-lg transition disabled:opacity-60 ${cfg.btn}`}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Submitting
              </>
            ) : (
              <>
                <Send className="h-5 w-5" /> {cfg.submit}
              </>
            )}
          </button>
        </div>

        {/* Tips */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-6">
          <div className="rounded-3xl bg-white p-6 shadow-card">
            <h3 className="mb-4 text-base font-bold text-slate-900">
              Reports that get results
            </h3>
            <ul className="space-y-3 text-sm text-slate-600">
              {[
                "Pick the exact district so local matches show first",
                "Add at least one clear photo",
                "Mention unique marks, stickers or scratches",
                "Use a landmark everyone knows",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.text}`} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </form>

      {/* Success */}
      {saved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-pop">
            <span className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${cfg.soft}`}>
              <CheckCircle2 className={`h-11 w-11 ${cfg.text}`} />
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900">{cfg.successTitle}</h2>
            <p className="mt-2 text-sm text-slate-500">
              <span className="font-bold text-slate-800">&quot;{saved}&quot;</span>{" "}
              {cfg.successText}
            </p>

            <div className={`mt-6 rounded-2xl p-5 text-left ${cfg.soft}`}>
              <p className={`mb-3 text-sm font-bold ${cfg.text}`}>What happens next</p>
              <ol className="space-y-2.5">
                {cfg.steps.map((s, i) => (
                  <li key={s} className="flex items-center gap-3 text-sm text-slate-600">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${cfg.num}`}>
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => router.push(cfg.next.href)}
                className={`w-full rounded-xl py-3.5 text-sm font-bold text-white ${cfg.btn}`}
              >
                {cfg.next.label}
              </button>
              <button
                onClick={() => router.push(mode === "lost" ? "/dashboard" : "/")}
                className="w-full rounded-xl bg-slate-100 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                {mode === "lost" ? "Go to dashboard" : "Back to home"}
              </button>
              <button
                onClick={reportAnother}
                className="text-sm text-slate-400 underline hover:text-slate-600"
              >
                Report another item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}