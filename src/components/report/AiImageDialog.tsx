"use client";

import { useState } from "react";
import { AlertCircle, ArrowLeft, Bot, Camera, Check, Info, Trash2 } from "lucide-react";
import { validateAiReason } from "@/lib/validation";

export type AiDecision =
  | { kind: "real" }
  | { kind: "remove" }
  | { kind: "declare"; reason: string };

const QUICK_REASONS = [
  "I don't have any photo of the item, so I used an AI image to show what it looks like.",
  "My original photo was lost or deleted, so I created a similar picture with AI.",
  "I want to show the exact model and colour; the AI image is close to the real item.",
];

/** Small purple tag shown on any photo the reporter confirmed is AI-generated. */
export function AiTag({ className = "" }: { className?: string }) {
  return (
    <span
      title="The reporter confirmed this image is AI-generated, not an original photo."
      className={`inline-flex items-center gap-1 rounded-full bg-violet-600/90 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white shadow backdrop-blur ${className}`}
    >
      <Bot className="h-3 w-3" /> AI IMAGE
    </span>
  );
}

/** Asked when the detector thinks an uploaded photo is AI-generated. */
export default function AiImageDialog({
  preview,
  score,
  defaultReason = "",
  onDecide,
}: {
  preview: string;
  score: number;
  defaultReason?: string;
  onDecide: (d: AiDecision) => void;
}) {
  const [step, setStep] = useState<"ask" | "why">("ask");
  const [reason, setReason] = useState(defaultReason);
  const [tried, setTried] = useState(false);
  const pct = Math.round(score * 100);
  const err = validateAiReason(reason);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-slate-950/65 backdrop-blur-sm" />
      <div className="animate-scale-in relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-pop">
        {/* Photo + score */}
        <div className="relative h-44 bg-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Uploaded photo" className="h-full w-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3 text-white">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-300">
                <Bot className="h-4 w-4" /> AI image check
              </p>
              <p className="mt-0.5 text-lg font-extrabold leading-tight">This photo looks AI-generated</p>
            </div>
            <div className="shrink-0 rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur">
              <p className="text-2xl font-extrabold leading-none">{pct}%</p>
              <p className="text-[10px] font-semibold text-violet-200">AI likelihood</p>
            </div>
          </div>
        </div>

        {step === "ask" ? (
          <div className="p-6">
            <p className="text-sm leading-relaxed text-slate-600">
              Our detector thinks this is <strong>not an original photo</strong>. Real photos help owners recognise their items, so please tell us honestly:
            </p>
            <p className="mt-4 text-sm font-bold text-slate-900">Is this an AI-generated image?</p>
            <div className="mt-3 space-y-2.5">
              <button
                onClick={() => setStep("why")}
                className="group flex w-full items-center gap-3 rounded-xl border-2 border-violet-200 bg-violet-50 p-3.5 text-left transition hover:border-violet-400"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white"><Bot className="h-5 w-5" /></span>
                <span>
                  <span className="block text-sm font-bold text-violet-900">Yes, it is AI-generated</span>
                  <span className="block text-xs text-violet-700">Keep it with a visible “AI image” tag</span>
                </span>
              </button>
              <button
                onClick={() => onDecide({ kind: "real" })}
                className="group flex w-full items-center gap-3 rounded-xl border-2 border-slate-200 p-3.5 text-left transition hover:border-slate-400"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Camera className="h-5 w-5" /></span>
                <span>
                  <span className="block text-sm font-bold text-slate-900">No, it is a real photo I took</span>
                  <span className="block text-xs text-slate-500">Keep it as an original photo</span>
                </span>
              </button>
              <button
                onClick={() => onDecide({ kind: "remove" })}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4" /> Remove this photo
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in p-6">
            <button onClick={() => setStep("ask")} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <p className="text-sm font-bold text-slate-900">Why are you using an AI-generated image?</p>
            <p className="mt-1 text-xs text-slate-500">Your explanation is shown with the photo, so everyone knows why it isn&apos;t original.</p>

            <div className="mt-3 flex flex-col gap-1.5">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition ${reason === r ? "border-violet-400 bg-violet-50 text-violet-900" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Or write your own reason…"
              className={`mt-3 w-full resize-none rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none transition focus:bg-white focus:ring-2 ${tried && err ? "border-rose-300 focus:ring-rose-200" : "border-slate-200 focus:ring-violet-300"}`}
            />
            {tried && err && (
              <p className="animate-fade-down mt-1 flex items-start gap-1.5 text-xs font-medium text-rose-600">
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {err}
              </p>
            )}

            <div className="mt-3 flex gap-2 rounded-xl bg-violet-50 p-3 text-xs text-violet-800">
              <Info className="mt-px h-4 w-4 shrink-0" /> The photo will carry an <strong>&nbsp;AI IMAGE&nbsp;</strong> tag wherever it appears.
            </div>

            <button
              onClick={() => {
                setTried(true);
                if (!err) onDecide({ kind: "declare", reason: reason.trim() });
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700"
            >
              <Check className="h-4 w-4" /> Keep photo with AI tag
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
