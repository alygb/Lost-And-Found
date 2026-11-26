import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GUIDE_FOR_AI } from "@/lib/recoveryGuide";

/**
 * Recovery Assistant chat. Signed-in users only (protects the OpenRouter key from abuse).
 * Model: AI_CHAT_MODEL in .env.local (any OpenRouter model id); defaults below.
 */

const DEFAULT_MODEL = "deepseek/deepseek-chat";

const SYSTEM = `You are the "Recovery Assistant" of AJK Lost & Found, a website for Azad Jammu & Kashmir (Pakistan) where people report lost and found items.

Your job: help people who lost something, especially important items such as a CNIC/ID card, driving licence, passport, mobile phone, bank card, certificates or vehicle documents. Tell them practical next steps: where to report (police station, NADRA, passport office, bank, mobile company, issuing office), what to bring, how to protect themselves from misuse, and to report the item on this website.

Rules:
- Reply in the same language the user writes in (English, Urdu, or Roman Urdu).
- Be short and clear: a one-line intro, then numbered steps. Use **bold** for office names. No tables, no headings.
- Base your advice on the reference guide below. Do not invent phone numbers, websites, fees or office addresses. The only numbers you may give are: police emergency 15, NADRA helpline 1777, PTA SIM check SMS 668.
- Say that procedures and fees can change and should be confirmed with the office.
- Always end by suggesting they report the item on this site (Report Lost page) if they haven't.
- If the user asks about something unrelated to lost/found items or recovering documents, politely say you can only help with lost and found matters.
- Never ask for or repeat CNIC numbers, passwords, card numbers or other private data. If the user shares them, tell them not to share such details in chat.
- If there is danger or a crime in progress, tell them to call police on 15.

Reference guide:
${GUIDE_FOR_AI}`;

// Simple per-user rate limit (resets when the server restarts)
const hits = new Map<string, number[]>();
const LIMIT = 20;
const WINDOW_MS = 10 * 60 * 1000;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "signin" }, { status: 401 });
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "signin" }, { status: 401 });

    const now = Date.now();
    const recent = (hits.get(user.id) || []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= LIMIT) return NextResponse.json({ error: "slow down" }, { status: 429 });
    hits.set(user.id, [...recent, now]);

    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: "unavailable" }, { status: 503 });

    const body = await req.json().catch(() => ({}));
    const raw: unknown[] = Array.isArray(body.messages) ? body.messages : [];
    const messages: Msg[] = raw
      .filter((m): m is Msg => !!m && typeof m === "object" && ["user", "assistant"].includes((m as Msg).role) && typeof (m as Msg).content === "string")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_CHAT_MODEL || DEFAULT_MODEL,
        temperature: 0.3,
        max_tokens: 700,
        messages: [{ role: "system", content: SYSTEM }, ...messages],
      }),
    });
    if (!res.ok) {
      console.error("assistant AI error:", res.status, (await res.text()).slice(0, 300));
      return NextResponse.json({ error: "unavailable" }, { status: 502 });
    }
    const data = await res.json();
    const reply: string = data.choices?.[0]?.message?.content?.trim() || "";
    if (!reply) return NextResponse.json({ error: "unavailable" }, { status: 502 });
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("assistant error:", e);
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }
}
