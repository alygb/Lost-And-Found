"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, BadgeCheck, Bell, Compass, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";

const SLIDES = [
  { icon: Sparkles, title: "AI-powered matching", text: "Photos and descriptions are compared across all ten districts automatically." },
  { icon: Bell, title: "Instant alerts", text: "Get notified the moment a possible match for your item appears." },
  { icon: ShieldCheck, title: "Verified handover", text: "Admins check every claim. Items are collected safely at the district office." },
];

/** Split-screen layout shared by login, register and password reset. */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 4500);
    return () => clearInterval(t);
  }, []);
  const S = SLIDES[slide];

  return (
    <div className="flex min-h-screen bg-white">
      {/* ── Left: photo + story ── */}
      <aside className="relative isolate hidden w-[46%] overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <Image src="/images/home/valley.jpg" alt="" fill preload sizes="46vw" className="-z-20 scale-110 animate-[float_20s_ease-in-out_infinite] object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950/90 via-blue-950/80 to-indigo-900/60" />

        <Link href="/" className="animate-fade-down flex w-fit items-center gap-2.5 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-glow">
            <Compass className="h-5 w-5" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            AJK <span className="text-blue-300">Lost &amp; Found</span>
          </span>
        </Link>

        <div className="text-white">
          <h2 className="animate-fade-up max-w-md text-4xl font-extrabold leading-tight xl:text-5xl">
            Lost something?
            <br />
            <span className="animate-gradient bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 bg-[length:200%_auto] bg-clip-text text-transparent">
              Let&apos;s bring it home.
            </span>
          </h2>
          <p className="animate-fade-up mt-4 max-w-md text-blue-100/90 [animation-delay:120ms]">
            The district-wide lost &amp; found platform for Azad Jammu &amp; Kashmir.
          </p>

          {/* Rotating feature card */}
          <div className="animate-fade-up mt-10 max-w-md [animation-delay:240ms]">
            <div key={slide} className="animate-fade-up flex gap-4 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <S.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold">{S.title}</p>
                <p className="mt-1 text-sm text-blue-100/80">{S.text}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`Show feature ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === slide ? "w-8 bg-white" : "w-3 bg-white/30 hover:bg-white/50"}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-blue-100/80">
          <BadgeCheck className="h-5 w-5 text-emerald-400" />
          Free for everyone · Your contact details stay private
        </div>
      </aside>

      {/* ── Right: form ── */}
      <main className="flex flex-1 flex-col">
        {/* Mobile header */}
        <div className="relative isolate overflow-hidden px-6 pb-14 pt-8 text-white lg:hidden">
          <Image src="/images/home/valley.jpg" alt="" fill sizes="100vw" className="-z-20 object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950/90 to-blue-900/75" />
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
              <Compass className="h-5 w-5" />
            </span>
            <span className="font-extrabold">AJK Lost &amp; Found</span>
          </Link>
        </div>

        <div className="-mt-8 flex flex-1 items-start justify-center rounded-t-3xl bg-white px-6 py-10 lg:mt-0 lg:items-center lg:rounded-none lg:px-10">
          <div className="w-full max-w-md">
            <div className="animate-fade-up">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
              <p className="mt-1.5 text-slate-500">{subtitle}</p>
            </div>
            <div className="animate-fade-up mt-8 [animation-delay:100ms]">{children}</div>
            {footer && <div className="animate-fade-up mt-8 text-center text-sm text-slate-500 [animation-delay:200ms]">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Small shared form pieces ──

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success"; children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className={`animate-fade-down flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium ${
        tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {tone === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

export function Field({
  label,
  icon: Icon,
  error,
  right,
  hint,
  password,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  error?: string;
  right?: React.ReactNode;
  hint?: React.ReactNode;
  password?: boolean;
}) {
  const [show, setShow] = useState(false);
  const id = input.id || input.name;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-semibold text-slate-700">{label}</label>
        {right}
      </div>
      <div className="group relative">
        <Icon className={`pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 transition-colors ${error ? "text-rose-400" : "text-slate-400 group-focus-within:text-brand"}`} />
        <input
          {...input}
          id={id}
          type={password ? (show ? "text" : "password") : input.type}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-xl border bg-slate-50 py-3 pl-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${password ? "pr-11" : "pr-4"} ${
            error ? "border-rose-300 bg-rose-50/40 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200 focus:border-brand focus:ring-blue-100"
          }`}
        />
        {password && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p key={error} id={`${id}-error`} className="animate-fade-down mt-1.5 flex items-start gap-1.5 text-xs font-medium text-rose-600">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}

export function GoogleButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card disabled:translate-y-0 disabled:opacity-60"
    >
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {loading ? "Redirecting to Google…" : "Continue with Google"}
    </button>
  );
}

export function Divider({ text }: { text: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs font-medium text-slate-400">
      <span className="h-px flex-1 bg-slate-200" />
      {text}
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

export function SubmitButton({ loading, children, loadingText }: { loading: boolean; children: React.ReactNode; loadingText: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:translate-y-0 disabled:opacity-70"
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      {loading ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
