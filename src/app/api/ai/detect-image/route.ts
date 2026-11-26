import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Checks whether an uploaded photo is AI-generated, using Sightengine's "genai" model.
 * Keys: SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET in .env.local.
 * Without keys it answers { available: false } and the app simply skips the check.
 */

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const apiUser = process.env.SIGHTENGINE_API_USER;
    const apiSecret = process.env.SIGHTENGINE_API_SECRET;
    if (!apiUser || !apiSecret) return NextResponse.json({ available: false });

    const form = await req.formData();
    const image = form.get("image");
    if (!(image instanceof File) || !image.type.startsWith("image/")) {
      return NextResponse.json({ error: "bad image" }, { status: 400 });
    }
    if (image.size > MAX_BYTES) return NextResponse.json({ error: "image too large" }, { status: 413 });

    const body = new FormData();
    body.append("media", image, image.name || "upload.jpg");
    body.append("models", "genai");
    body.append("api_user", apiUser);
    body.append("api_secret", apiSecret);

    const res = await fetch("https://api.sightengine.com/1.0/check.json", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(15000), // never let a slow detector block posting
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.status !== "success") {
      return NextResponse.json({ available: false, error: data?.error?.message || "detector unavailable" });
    }

    const score = Number(data?.type?.ai_generated);
    if (!Number.isFinite(score)) return NextResponse.json({ available: false });
    return NextResponse.json({ available: true, score });
  } catch {
    return NextResponse.json({ available: false, error: "failed" });
  }
}
