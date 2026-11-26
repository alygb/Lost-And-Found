import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CATEGORIES = [
  "electronics", "documents", "clothing", "bags",
  "books", "jewelry", "keys", "other",
];

const PROMPT = `You help a lost-and-found service in Azad Kashmir. Look at the photo of one item.
Reply with ONLY a JSON object with these keys:
{"name": string, "category": string, "color": string, "brand": string,
 "description": string, "marks": string, "sensitive": boolean, "confidence": number}
Rules:
- category must be exactly one of: ${CATEGORIES.join(", ")}
- name: 2 to 5 words
- description: one or two plain sentences about colour, brand, size and condition
- marks: visible unique marks, stickers or damage, or an empty string
- sensitive: true if the photo shows an ID card, CNIC, passport, bank card or any personal document
- Never read out or repeat numbers or personal data printed on documents
- If you cannot identify the item, use category "other" and a confidence below 0.3
- confidence is a number from 0 to 1`;

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { image } = await req.json();
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "bad image" }, { status: 400 });
    }
    if (image.length > 3_000_000) {
      return NextResponse.json({ error: "image too large" }, { status: 413 });
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AI_VISION_MODEL,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "ai unavailable" }, { status: 502 });

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "no result" }, { status: 502 });

    const raw = JSON.parse(match[0]);
    const category = CATEGORIES.includes(raw.category) ? raw.category : "other";

    return NextResponse.json({
      name: String(raw.name || "").slice(0, 60),
      category,
      color: String(raw.color || ""),
      brand: String(raw.brand || ""),
      description: String(raw.description || "").slice(0, 400),
      marks: String(raw.marks || ""),
      sensitive: Boolean(raw.sensitive),
      confidence: Number(raw.confidence) || 0,
    });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}