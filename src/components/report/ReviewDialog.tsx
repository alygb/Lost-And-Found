"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar, CheckCircle2, ClipboardCheck, FileText, Loader2, Lock, Mail, Map as MapIcon, MapPin, Package, Pencil, Phone, Send, Tag, Volume2, VolumeX,
} from "lucide-react";
import { CATEGORY_TEXT, REPORT_TEXT, SPEECH_LANG, type Lang } from "@/lib/reportI18n";

export type ReviewData = {
  itemName: string;
  category: string;
  otherType: string;
  description: string;
  district: string;
  place: string;
  date: string;
  hasMap: boolean;
  email: string;
  phone: string;
  photos: { url: string; ai: boolean }[];
};

type Props = {
  mode: "lost" | "found";
  lang: Lang;
  onLangChange: (l: Lang) => void;
  data: ReviewData;
  busy: boolean;
  accentText: string;
  accentBtn: string;
  accentNum: string;
  onConfirm: () => void;
  onEdit: () => void;
};

export default function ReviewDialog({ mode, lang, onLangChange, data, busy, accentText, accentBtn, accentNum, onConfirm, onEdit }: Props) {
  const t = REPORT_TEXT[lang];
  const rtl = lang === "ur";
  const [checked, setChecked] = useState(false);
  const [needTick, setNeedTick] = useState(false);
  const tickRef = useRef<HTMLLabelElement>(null);

  const confirm = () => {
    if (busy) return;
    if (!checked) {
      // Don't silently ignore the click: point the user at the checkbox
      setNeedTick(true);
      tickRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onConfirm();
  };
  const [speaking, setSpeaking] = useState(false);

  const categoryLabel =
    data.category === "other" && data.otherType ? data.otherType : CATEGORY_TEXT[lang][data.category] || data.category;
  const dateLabel = data.date
    ? new Date(`${data.date}T12:00:00`).toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", { day: "numeric", month: "long", year: "numeric" })
    : t.notGiven;

  const rows: { icon: typeof Tag; label: string; value: string; private?: boolean }[] = [
    { icon: Package, label: t.itemName, value: data.itemName },
    { icon: Tag, label: t.category, value: categoryLabel },
    { icon: FileText, label: t.description, value: data.description },
    { icon: MapPin, label: t.location, value: data.district || t.notGiven },
    { icon: MapPin, label: t.place[mode], value: data.place },
    { icon: Calendar, label: t.date[mode], value: dateLabel },
    { icon: MapIcon, label: t.map, value: data.hasMap ? t.mapSet : t.mapNone },
    { icon: Mail, label: t.email, value: data.email, private: true },
    { icon: Phone, label: t.phone, value: data.phone || t.notGiven, private: true },
  ];

  // Esc = back to editing; lock page scroll while open; stop speech on close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onEdit();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.speechSynthesis?.cancel();
    };
  }, [busy, onEdit]);

  const readAloud = () => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    // Use an Urdu voice when the device has one; otherwise read the English version.
    const voices = synth.getVoices();
    const urVoice = voices.find((v) => v.lang.toLowerCase().startsWith("ur"));
    const useLang: Lang = lang === "ur" && urVoice ? "ur" : "en";
    const tt = REPORT_TEXT[useLang];
    const cat = data.category === "other" && data.otherType ? data.otherType : CATEGORY_TEXT[useLang][data.category] || data.category;
    const text = [
      tt.reviewTitle,
      `${tt.itemName}: ${data.itemName}`,
      `${tt.category}: ${cat}`,
      `${tt.description}: ${data.description}`,
      `${tt.location}: ${data.district || tt.notGiven}`,
      `${tt.place[mode]}: ${data.place}`,
      `${tt.date[mode]}: ${data.date ? new Date(`${data.date}T12:00:00`).toLocaleDateString(useLang === "ur" ? "ur-PK" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : tt.notGiven}`,
      `${tt.phone}: ${data.phone ? data.phone.split("").join(" ") : tt.notGiven}`,
    ].join(". ");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = SPEECH_LANG[useLang];
    if (useLang === "ur" && urVoice) u.voice = urVoice;
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };

  // Portal to <body> so no animated / transformed parent can push the popup off-screen
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onEdit();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        dir={rtl ? "rtl" : "ltr"}
        className="animate-scale-in flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-pop"
      >
        {/* Header */}
        <div className="border-b border-slate-100 px-6 pb-4 pt-6">
          <div className="flex items-start gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${accentNum}`}>
              <ClipboardCheck className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="review-title" className="text-xl font-bold text-slate-900">{t.reviewTitle}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{t.reviewSubtitle}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div dir="ltr" className="flex rounded-full bg-slate-100 p-1">
              {(["en", "ur"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => onLangChange(l)}
                  className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${lang === l ? `bg-white shadow ${accentText}` : "text-slate-500 hover:text-slate-800"}`}
                >
                  {l === "en" ? "English" : "اردو"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={readAloud}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              {speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              {speaking ? t.stop : t.readAloud}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{t.photos}</p>
          {data.photos.length ? (
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {data.photos.map((p, i) => (
                <div key={p.url} className="relative h-16 w-16 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full rounded-xl object-cover" />
                  {p.ai && <span className="absolute bottom-0.5 left-0.5 rounded bg-violet-600 px-1 text-[8px] font-bold text-white">AI</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-400">{t.noPhotos}</p>
          )}

          <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {rows.map((r) => (
              <div key={r.label} className="flex gap-3 px-4 py-3">
                <r.icon className={`mt-0.5 h-4 w-4 shrink-0 ${accentText}`} />
                <div className="min-w-0 flex-1">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    {r.label}
                    {r.private && <Lock className="h-3 w-3" aria-label={t.private} />}
                  </dt>
                  <dd dir="auto" className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium text-slate-800">{r.value}</dd>
                </div>
              </div>
            ))}
          </dl>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Lock className="h-3 w-3" /> {t.email} / {t.phone}: {t.private}
          </p>

          <label
            ref={tickRef}
            className={`mt-5 flex cursor-pointer items-start gap-3 rounded-xl p-4 transition ${
              needTick && !checked ? "bg-rose-50 ring-2 ring-rose-400" : checked ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50 ring-1 ring-slate-200"
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                setChecked(e.target.checked);
                setNeedTick(false);
              }}
              className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600"
            />
            <span className="text-sm font-medium text-slate-700">
              {t.confirmNote}
              {needTick && !checked && <span className="mt-1 block text-xs font-bold text-rose-600">{t.tickFirst}</span>}
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row">
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Pencil className="h-4 w-4" /> {t.edit}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 ${accentBtn} ${checked ? "" : "opacity-80"}`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : checked ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {busy ? t.posting : t.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
