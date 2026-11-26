import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Voice report: turns what the user said (English, Urdu or Roman Urdu) into report fields.
 * Signed-in users only. Model: AI_CHAT_MODEL in .env.local (any OpenRouter model id).
 */

const DEFAULT_MODEL = "deepseek/deepseek-chat";
const CATEGORIES = ["electronics", "documents", "clothing", "bags", "books", "jewelry", "keys", "other"];

// Simple per-user rate limit (resets when the server restarts)
const hits = new Map<string, number[]>();
const LIMIT = 15;
const WINDOW_MS = 10 * 60 * 1000;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

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
    const transcript = str(body.transcript, 3000);
    const mode = body.mode === "found" ? "found" : "lost";
    const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
    const districts: string[] = Array.isArray(body.districts)
      ? body.districts.filter((d: unknown): d is string => typeof d === "string").slice(0, 100).map((d: string) => d.slice(0, 60))
      : [];
    if (transcript.length < 3) return NextResponse.json({ error: "empty" }, { status: 400 });

    const weekday = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });

    const prompt = `You fill in a ${mode === "lost" ? "LOST" : "FOUND"} item report for AJK Lost & Found (Azad Jammu & Kashmir, Pakistan).
The person spoke in English, Urdu or Roman Urdu. Read what they said and reply with ONLY a JSON object:
{"itemName": string, "category": string, "otherType": string, "description": string, "place": string, "district": string, "date": string, "contactPhone": string}

Rules:
- Write every value in simple English (translate Urdu), except proper place names which you keep as spoken (in Latin letters).
- itemName: 2 to 5 words, e.g. "Black leather wallet". Empty string if unknown.
- category: exactly one of ${CATEGORIES.join(", ")}. CNIC, ID card, passport, licence, certificates = documents. Phone, laptop, charger = electronics.
- otherType: only when category is "other", the kind of item in 1 to 3 words (e.g. "Umbrella"); otherwise "".
- description: 1 to 3 sentences about colour, brand, size, contents and unique marks. Do NOT include CNIC numbers, card numbers, passwords or other private numbers; say "number not shared" instead.
- place: the landmark or spot where it was ${mode === "lost" ? "lost / last seen" : "found"}, e.g. "Main bazaar bus stand". Empty if not said.
- district: copy EXACTLY one name from this list if the person mentions it or a city/town inside it, else "": ${districts.length ? districts.join(", ") : "(no list)"}
- date: YYYY-MM-DD. Today is ${today} (${weekday}). Resolve words like "today/aaj", "yesterday/kal" (kal means yesterday here, it is in the past), "parson" (2 days ago), "last Monday". Never a future date. Empty if not said.
- contactPhone: a Pakistani mobile number if the person said one for contact (digits only, e.g. 03001234567), else "".
- Do not invent details that were not said. Use "" for anything missing.

What the person said:
"""${transcript.replace(/"""/g, "'")}"""`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_CHAT_MODEL || DEFAULT_MODEL,
        temperature: 0.1,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error("voice-report AI error:", res.status, (await res.text()).slice(0, 300));
      return NextResponse.json({ error: "unavailable" }, { status: 502 });
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "no result" }, { status: 502 });
    const raw = JSON.parse(match[0]);

    const category = CATEGORIES.includes(raw.category) ? raw.category : "";
    const district = districts.find((d) => d.toLowerCase() === str(raw.district, 60).toLowerCase()) || "";
    let date = str(raw.date, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) date = "";

    return NextResponse.json({
      itemName: str(raw.itemName, 60),
      category,
      otherType: category === "other" ? str(raw.otherType, 40) : "",
      description: str(raw.description, 500),
      place: str(raw.place, 100),
      district,
      date,
      contactPhone: str(raw.contactPhone, 16).replace(/[^\d+]/g, ""),
    });
  } catch (e) {
    console.error("voice-report error:", e);
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }
}
