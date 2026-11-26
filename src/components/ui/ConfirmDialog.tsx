"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

type Tone = "rose" | "amber" | "emerald" | "slate";

const TONES: Record<Tone, { ring: string; icon: string; button: string; glow: string }> = {
  rose: {
    ring: "bg-rose-50 ring-rose-100",
    icon: "text-rose-600",
    button: "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-300",
    glow: "from-rose-500/15",
  },
  amber: {
    ring: "bg-amber-50 ring-amber-100",
    icon: "text-amber-600",
    button: "bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-300",
    glow: "from-amber-500/15",
  },
  emerald: {
    ring: "bg-emerald-50 ring-emerald-100",
    icon: "text-emerald-600",
    button: "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-300",
    glow: "from-emerald-500/15",
  },
  slate: {
    ring: "bg-slate-100 ring-slate-200",
    icon: "text-slate-700",
    button: "bg-slate-900 hover:bg-slate-700 focus-visible:ring-slate-300",
    glow: "from-slate-500/10",
  },
};

export type ConfirmDialogProps = {
  open: boolean;
  tone?: Tone;
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  /** Optional content between the description and the buttons (e.g. who is affected). */
  children?: React.ReactNode;
  /** Bullet points describing what will happen. */
  points?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Centered modal confirmation with backdrop, Esc / click-outside to close, and a busy state. */
export default function ConfirmDialog({
  open,
  tone = "slate",
  icon,
  title,
  description,
  children,
  points,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const t = TONES[tone];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  // Portal to <body> so no animated / transformed parent can push the popup off-screen
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="animate-scale-in relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-pop"
      >
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${t.glow} to-transparent`} />

        <button
          onClick={onClose}
          disabled={busy}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative px-6 pb-6 pt-8 text-center sm:px-8">
          <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ring-8 ${t.ring} ${t.icon}`}>
            {icon}
          </span>
          <h2 id="confirm-dialog-title" className="mt-5 text-xl font-bold text-slate-900">
            {title}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-500">{description}</div>

          {children && <div className="mt-5">{children}</div>}

          {points && points.length > 0 && (
            <ul className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-4 text-left text-sm text-slate-600">
              {points.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${t.button.split(" ")[0]}`} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              onClick={onConfirm}
              disabled={busy}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition focus:outline-none focus-visible:ring-4 disabled:opacity-70 ${t.button}`}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Please wait..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
