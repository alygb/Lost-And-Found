import { NextRequest, NextResponse } from "next/server";
import { adminDb, userFromRequest } from "@/lib/server/core";
import { FOUND_FIELDS, LOST_FIELDS, rankMatches, type MatchItem } from "@/lib/server/matching";

/**
 * Smart matching for one of the caller's lost items.
 * Body: { lostItemId }. The server loads the lost item (must belong to the caller) and all available
 * found items itself, so results can't be faked from the browser.
 */

export const maxDuration = 60;

// Simple per-user rate limit (each run makes several AI calls)
const hits = new Map<string, number[]>();
const LIMIT = 15;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    if (!user) return NextResponse.json({ error: "signin", matches: [] }, { status: 401 });

    const now = Date.now();
    const recent = (hits.get(user.id) || []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= LIMIT) return NextResponse.json({ error: "Too many scans. Please wait a few minutes.", matches: [] }, { status: 429 });
    hits.set(user.id, [...recent, now]);

    const { lostItemId } = await req.json().catch(() => ({}));
    if (typeof lostItemId !== "string" || !/^[0-9a-f-]{36}$/i.test(lostItemId)) {
      return NextResponse.json({ error: "bad request", matches: [] }, { status: 400 });
    }

    const { data: lost } = await adminDb.from("lost_items").select(LOST_FIELDS).eq("id", lostItemId).maybeSingle<MatchItem>();
    if (!lost || lost.user_id !== user.id) return NextResponse.json({ error: "not found", matches: [] }, { status: 404 });

    const { data: found } = await adminDb
      .from("found_items")
      .select(FOUND_FIELDS)
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(300)
      .returns<MatchItem[]>();

    const matches = await rankMatches(lost, "lost", found || []);
    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Matching error:", error);
    return NextResponse.json({ matches: [], error: "Matching failed" }, { status: 500 });
  }
}
