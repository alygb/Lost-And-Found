"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Phone, RotateCcw, Send, Sparkles, X } from "lucide-react";
import AssistantLogo from "./AssistantLogo";
import { supabase } from "@/lib/supabase";
import { GUIDE, matchTopic, type GuideAction } from "@/lib/recoveryGuide";

type Msg = {
  id: number;
  role: "user" | "assistant";
  text: string;
  actions?: GuideAction[];
  chips?: boolean;
  ai?: boolean;
};

const GREETING: Msg = {
  id: 0,
  role: "assistant",
  text: "Assalam-o-Alaikum! 👋 I'm your **Recovery Assistant**.\nLost something important? Pick one below or type your question in English or Urdu. I'll tell you where to report it and how to get it back.",
  chips: true,
};

/** Renders the assistant's light markdown: **bold**, "- " bullets and "1. " steps. */
function RichText({ text }: { text: string }) {
  const bold = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      )
    );

  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: { text: string; sub: boolean }[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list;
    blocks.push(
      L.ordered ? (
        <ol key={blocks.length} className="my-1.5 space-y-1.5">
          {L.items.map((it, i) => (
            <li key={i} className={`flex gap-2 ${it.sub ? "ml-7" : ""}`}>
              {!it.sub && (
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand">
                  {L.items.slice(0, i + 1).filter((x) => !x.sub).length}
                </span>
              )}
              {it.sub && <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />}
              <span>{bold(it.text)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul key={blocks.length} className="my-1.5 space-y-1">
          {L.items.map((it, i) => (
            <li key={i} className={`flex gap-2 ${it.sub ? "ml-5" : ""}`}>
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span>{bold(it.text)}</span>
            </li>
          ))}
        </ul>
      )
    );
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    const ul = line.match(/^(\s*)[-*•]\s+(.*)$/);
    if (ol) {
      if (!list || !list.ordered) {
        flush();
        list = { ordered: true, items: [] };
      }
      list.items.push({ text: ol[2], sub: false });
    } else if (ul) {
      const sub = ul[1].length >= 2;
      if (list && (list.ordered || sub)) list.items.push({ text: ul[2], sub: true });
      else {
        if (!list) list = { ordered: false, items: [] };
        list.items.push({ text: ul[2], sub });
      }
    } else if (!line.trim()) {
      flush();
    } else {
      flush();
      blocks.push(<p key={blocks.length} className="my-1">{bold(line.replace(/^#+\s*/, ""))}</p>);
    }
  }
  flush();
  return <div className="text-[13px] leading-relaxed text-slate-700">{blocks}</div>;
}

export default function RecoveryAssistant({
  open,
  onOpenChange,
  hideLauncher = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hideLauncher?: boolean;
}) {
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => onOpenChange(typeof v === "function" ? v(open) : v);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // A small "Lost your CNIC?" bubble once per visit
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("ajk-assistant-teaser") === "1";
    } catch {}
    if (seen) return;
    const t = setTimeout(() => setTeaser(true), 5000);
    return () => clearTimeout(t);
  }, []);
  const hideTeaser = () => {
    setTeaser(false);
    try {
      sessionStorage.setItem("ajk-assistant-teaser", "1");
    } catch {}
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, typing, open]);

  const push = (m: Omit<Msg, "id">) => setMsgs((prev) => [...prev, { ...m, id: idRef.current++ }]);

  const answerFromGuide = (text: string, signedIn: boolean) => {
    const topic = matchTopic(text);
    if (topic) {
      push({ role: "assistant", text: topic.answer, actions: topic.actions });
    } else {
      push({
        role: "assistant",
        text: signedIn
          ? "Sorry, I couldn't get a full answer right now. Pick the closest topic below, or report your item on this site so we can match it."
          : "I can help with the common cases below. **Sign in** to ask me anything in your own words.",
        chips: true,
        actions: signedIn ? [{ label: "Report a lost item", href: "/report-lost" }] : [{ label: "Sign in", href: "/login" }],
      });
    }
  };

  const pickTopic = (id: string) => {
    const t = GUIDE.find((g) => g.id === id);
    if (!t || typing) return;
    push({ role: "user", text: t.label });
    setTyping(true);
    setTimeout(() => {
      push({ role: "assistant", text: t.answer, actions: t.actions });
      setTyping(false);
    }, 550);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;
    setInput("");
    const history = [...msgs, { id: -1, role: "user" as const, text }];
    push({ role: "user", text });
    setTyping(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setTimeout(() => {
        answerFromGuide(text, false);
        setTyping(false);
      }, 450);
      return;
    }

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          messages: history.filter((m) => m.id !== 0).map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      if (res.status === 429) {
        push({ role: "assistant", text: "You're sending messages quickly. Please wait a few minutes, or pick a topic below.", chips: true });
      } else if (!res.ok) {
        answerFromGuide(text, true);
      } else {
        const { reply } = await res.json();
        const topic = matchTopic(text + " " + reply);
        push({ role: "assistant", text: reply, ai: true, actions: topic?.actions || [{ label: "Report a lost item", href: "/report-lost" }] });
      }
    } catch {
      answerFromGuide(text, true);
    }
    setTyping(false);
  };

  const reset = () => {
    setMsgs([GREETING]);
    setInput("");
  };

  return (
    <>
      {/* Launcher */}
      <div className={`fixed bottom-5 right-5 z-40 flex items-end gap-3 transition-all duration-300 ${hideLauncher ? "pointer-events-none translate-y-4 scale-75 opacity-0" : ""}`}>
        {teaser && !open && (
          <div className="animate-fade-up relative hidden max-w-[220px] rounded-2xl rounded-br-sm bg-white p-3 pr-7 text-sm shadow-pop sm:block">
            <button onClick={hideTeaser} className="absolute right-1.5 top-1.5 rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="font-semibold text-slate-900">Lost your CNIC or licence?</p>
            <p className="text-xs text-slate-500">I can tell you exactly what to do.</p>
          </div>
        )}
        <button
          onClick={() => {
            setOpen((o) => !o);
            hideTeaser();
            setTimeout(() => inputRef.current?.focus(), 250);
          }}
          className={`group relative flex h-16 w-16 items-center justify-center rounded-[20px] transition hover:scale-110 active:scale-95 ${
            open ? "bg-slate-900 text-white shadow-pop" : "animate-bob shadow-[0_12px_30px_-6px_rgba(99,102,241,0.6)]"
          }`}
          aria-label={open ? "Close assistant" : "Open recovery assistant"}
        >
          {!open && <span className="absolute inset-0 animate-ping rounded-[20px] bg-indigo-500/25 [animation-duration:2.8s]" />}
          {open ? <X className="h-6 w-6" /> : <AssistantLogo size={64} className="relative" />}
        </button>
      </div>

      {/* Panel */}
      {open && (
        <div className="animate-scale-in fixed inset-x-3 bottom-24 z-40 flex h-[min(620px,calc(100vh-8rem))] origin-bottom-right flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-pop sm:inset-x-auto sm:right-5 sm:w-[400px]">
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-700 px-5 py-4 text-white">
            <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-3">
              <span className="relative rounded-[16px] ring-2 ring-white/30">
                <AssistantLogo size={46} />
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-indigo-700" />
              </span>
              <p className="min-w-0 flex-1 text-base font-bold">Recovery Assistant</p>
              <button onClick={reset} className="rounded-lg p-2 text-blue-100 transition hover:bg-white/15 hover:text-white" title="Start over" aria-label="Start over">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-blue-100 transition hover:bg-white/15 hover:text-white" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto bg-slate-50/70 px-4 py-4">
            {msgs.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="animate-fade-up flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-[13px] text-white shadow-sm">{m.text}</p>
                </div>
              ) : (
                <div key={m.id} className="animate-fade-up flex gap-2.5">
                  <AssistantLogo size={30} animated={false} className="mt-1 shrink-0" />
                  <div className="min-w-0 max-w-[88%]">
                    <div className="rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-3 shadow-sm">
                      <RichText text={m.text} />
                      {m.ai && (
                        <p className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                          <Sparkles className="h-3 w-3" /> AI answer. Please confirm details with the office.
                        </p>
                      )}
                    </div>

                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.actions.map((a) => (
                          <Link
                            key={a.href + a.label}
                            href={a.href}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand-soft"
                          >
                            {a.label} <ArrowRight className="h-3 w-3" />
                          </Link>
                        ))}
                      </div>
                    )}

                    {m.chips && (
                      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                        {GUIDE.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => pickTopic(g.id)}
                            disabled={typing}
                            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-brand disabled:opacity-50"
                          >
                            <span className="text-base leading-none">{g.emoji}</span> {g.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {typing && (
              <div className="flex gap-2.5">
                <AssistantLogo size={30} className="shrink-0" />
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-3">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Emergency strip */}
          <div className="flex items-center justify-center gap-4 border-t border-slate-100 bg-white px-4 py-1.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-rose-500" /> Police <strong className="text-slate-700">15</strong></span>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-emerald-600" /> NADRA <strong className="text-slate-700">1777</strong></span>
            <span>SIM check: SMS CNIC to <strong className="text-slate-700">668</strong></span>
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2 border-t border-slate-100 bg-white p-3"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={600}
              placeholder="e.g. Mera shanakhti card gum ho gaya…"
              className="max-h-28 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-glow transition hover:bg-brand-dark active:scale-95 disabled:opacity-40 disabled:shadow-none"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
