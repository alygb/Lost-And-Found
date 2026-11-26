"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Mic, MicOff, Sparkles, Wand2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { REPORT_TEXT, SPEECH_LANG, type Lang } from "@/lib/reportI18n";

// ── Minimal Web Speech API types (not in TypeScript's DOM lib) ──
type SpeechAlt = { transcript: string };
type SpeechResult = { isFinal: boolean; 0: SpeechAlt; length: number };
type SpeechEvent = { resultIndex: number; results: { length: number; [i: number]: SpeechResult } };
type SpeechErrorEvent = { error: string };
type Recognizer = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
};
type RecognizerCtor = new () => Recognizer;

const getRecognizer = (): RecognizerCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

type District = { id: number; name: string; division_id: number };

export type VoiceFields = {
  itemName: string;
  category: string;
  otherType: string;
  description: string;
  place: string;
  date: string;
  contactPhone: string;
  district: District | null;
};

type Props = {
  mode: "lost" | "found";
  lang: Lang;
  onLangChange: (l: Lang) => void;
  today: string;
  /** Called with what AI understood. Returns the labels of required fields still missing. */
  onResult: (fields: VoiceFields) => string[];
  accentText: string;
  accentBtn: string;
};

export default function VoiceReport({ mode, lang, onLangChange, today, onResult, accentText, accentBtn }: Props) {
  const t = REPORT_TEXT[lang];
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ ok: boolean; missing: string[] } | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);

  const recRef = useRef<Recognizer | null>(null);
  const wantRef = useRef(false); // user still wants to listen (Chrome stops on silence; we restart)
  const baseRef = useRef(""); // text before this listening session

  useEffect(() => {
    // Feature detection has to run in the browser, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!getRecognizer());
    supabase
      .from("districts")
      .select("id,name,division_id")
      .order("name")
      .then(({ data }) => setDistricts((data as District[]) || []));
    return () => {
      wantRef.current = false;
      recRef.current?.abort();
    };
  }, []);

  const stop = () => {
    wantRef.current = false;
    recRef.current?.stop();
    setListening(false);
  };

  const start = () => {
    const Ctor = getRecognizer();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setError("");
    setResult(null);
    baseRef.current = text.trim();
    let finals = "";

    const rec = new Ctor();
    rec.lang = SPEECH_LANG[lang];
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals += (finals ? " " : "") + r[0].transcript.trim();
        else live += r[0].transcript;
      }
      setText([baseRef.current, finals].filter(Boolean).join(" "));
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") {
        if (e.error === "no-speech" && !finals && !baseRef.current) setError(t.noSpeech);
        return;
      }
      wantRef.current = false;
      setListening(false);
      setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? t.micDenied : e.error === "network" ? t.network : t.aiFailed);
    };
    rec.onend = () => {
      setInterim("");
      if (wantRef.current) {
        // Restart after a pause, keeping what was already said
        baseRef.current = [baseRef.current, finals].filter(Boolean).join(" ");
        finals = "";
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setListening(false);
    };

    recRef.current = rec;
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const fill = async () => {
    if (listening) stop();
    const transcript = [text, interim].join(" ").trim();
    if (transcript.length < 3 || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError(t.signin);
        setBusy(false);
        return;
      }
      const res = await fetch("/api/ai/voice-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ transcript, mode, today, districts: districts.map((d) => d.name) }),
      });
      if (!res.ok) throw new Error(res.status === 401 ? "signin" : "ai");
      const r = await res.json();
      const district = districts.find((d) => d.name === r.district) || null;
      const fields: VoiceFields = { ...r, district };
      if (!fields.itemName && !fields.category && !fields.description) {
        setError(t.nothingFound);
      } else {
        const missing = onResult(fields);
        setResult({ ok: true, missing });
      }
    } catch (e) {
      setError(e instanceof Error && e.message === "signin" ? t.signin : t.aiFailed);
    }
    setBusy(false);
  };

  const rtl = lang === "ur";

  return (
    <div dir={rtl ? "rtl" : "ltr"} className={rtl ? "font-[inherit] leading-loose" : ""}>
      {/* Language switch */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-500">{t.langLabel}</span>
        <div dir="ltr" className="flex rounded-full bg-slate-100 p-1">
          {(["en", "ur"] as const).map((l) => (
            <button
              key={l}
              type="button"
              disabled={listening}
              onClick={() => onLangChange(l)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition disabled:opacity-60 ${lang === l ? `bg-white shadow ${accentText}` : "text-slate-500 hover:text-slate-800"}`}
            >
              {l === "en" ? "English" : "اردو"}
            </button>
          ))}
        </div>
      </div>

      {/* Mic */}
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-br from-slate-50 to-white px-4 py-6 text-center ring-1 ring-slate-100">
        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={!supported || busy}
          aria-label={listening ? t.stop : t.tapToSpeak}
          className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${listening ? "bg-rose-600" : accentBtn}`}
        >
          {listening && <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/40" />}
          {listening ? <MicOff className="relative h-8 w-8" /> : <Mic className="relative h-8 w-8" />}
        </button>
        <p className={`text-sm font-bold ${listening ? "text-rose-600" : "text-slate-800"}`}>{listening ? t.listening : t.tapToSpeak}</p>
        {listening && (
          <div className="flex h-5 items-end gap-1" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                style={{ animationDelay: `${i * 150}ms`, height: `${8 + ((i * 7) % 12)}px` }}
                className="w-1 animate-pulse rounded-full bg-rose-400"
              />
            ))}
          </div>
        )}
        <p className="max-w-lg text-xs text-slate-500">{mode === "lost" ? t.exampleLost : t.exampleFound}</p>
      </div>

      {!supported && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {t.unsupported}
        </p>
      )}

      {/* Transcript */}
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t.transcriptLabel}</span>
        <div className="relative">
          <textarea
            rows={3}
            maxLength={3000}
            value={listening && interim ? `${text} ${interim}`.trim() : text}
            onChange={(e) => setText(e.target.value)}
            readOnly={listening}
            placeholder={t.transcriptPlaceholder}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-violet-300"
          />
        </div>
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={fill}
          disabled={busy || (text + interim).trim().length < 3}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {busy ? t.filling : t.fill}
        </button>
        {text && !listening && !busy && (
          <button
            type="button"
            onClick={() => {
              setText("");
              setResult(null);
              setError("");
            }}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" /> {t.clear}
          </button>
        )}
      </div>

      {error && (
        <p className="animate-fade-down mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {result?.ok && (
        <div className="animate-fade-up mt-3 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">
          <p className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> {t.filled}
          </p>
          {result.missing.length > 0 && (
            <p className="mt-1 font-semibold">
              {t.stillNeeded} {result.missing.join(rtl ? "، " : ", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
