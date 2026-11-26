"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, Lock, MessageCircle, ShieldCheck, X } from "lucide-react";
import ChatThread from "./ChatThread";

/**
 * Floating "Message admin" chat, stacked above the Recovery Assistant button.
 * Uses the same private user ↔ admin conversation as the /messages page.
 */
export default function AdminChatWidget({
  open,
  onOpenChange,
  hideLauncher = false,
  user,
  isAdmin,
  unread,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hideLauncher?: boolean;
  user: User | null;
  isAdmin: boolean;
  unread: number;
}) {
  return (
    <>
      {/* Launcher (above the assistant button) */}
      {!open && (
        <div
          className={`group fixed bottom-[100px] right-[26px] z-40 flex items-center gap-2 transition-all duration-300 ${
            hideLauncher ? "pointer-events-none translate-y-4 scale-75 opacity-0" : ""
          }`}
        >
          <span className="pointer-events-none hidden translate-x-2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:translate-x-0 group-hover:opacity-100 sm:block">
            Message admin
          </span>
          <button
            onClick={() => onOpenChange(true)}
            className="relative flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_10px_24px_-6px_rgba(16,185,129,0.6)] transition hover:scale-110 active:scale-95"
            aria-label={unread ? `Message admin (${unread} unread)` : "Message admin"}
          >
            <MessageCircle className="h-6 w-6" />
            {unread > 0 && (
              <span className="animate-pulse-ring absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {unread}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Close button sits where the assistant button is while this chat is open */}
      {open && (
        <button
          onClick={() => onOpenChange(false)}
          className="animate-scale-in fixed bottom-5 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-[20px] bg-slate-900 text-white shadow-pop transition hover:scale-110 active:scale-95"
          aria-label="Close admin chat"
        >
          <X className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="animate-scale-in fixed inset-x-3 bottom-24 z-40 flex h-[min(620px,calc(100vh-8rem))] origin-bottom-right flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-pop sm:inset-x-auto sm:right-5 sm:w-[400px]">
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 px-5 py-4 text-white">
            <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-3">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/25 backdrop-blur">
                <ShieldCheck className="h-6 w-6" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-300 ring-2 ring-teal-700" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">Admin Team</p>
                <p className="flex items-center gap-1 text-xs text-emerald-50/90">
                  <Lock className="h-3 w-3" /> Private · only you and the admins
                </p>
              </div>
              <button onClick={() => onOpenChange(false)} className="rounded-lg p-2 text-emerald-50 transition hover:bg-white/15 hover:text-white" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          {!user ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <MessageCircle className="h-8 w-8" />
              </span>
              <p className="font-bold text-slate-900">Sign in to message the admins</p>
              <p className="text-sm text-slate-500">Ask about a claim, a found item, or anything you need help with.</p>
              <Link
                href="/login"
                onClick={() => onOpenChange(false)}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Sign in <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : isAdmin ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <ShieldCheck className="h-8 w-8" />
              </span>
              <p className="font-bold text-slate-900">You are an admin</p>
              <p className="text-sm text-slate-500">Read and answer every user&apos;s conversation in the Messages tab of the admin panel.</p>
              <Link
                href="/admin"
                onClick={() => onOpenChange(false)}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
              >
                Open admin inbox <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="min-h-0 flex-1 bg-slate-50/60">
              <ChatThread
                key={user.id}
                threadUserId={user.id}
                currentUserId={user.id}
                otherLabel={() => "Admin"}
                emptyText="👋 Hi! Send a message and an admin will reply here, usually within a day."
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
