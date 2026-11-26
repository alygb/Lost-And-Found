import { NextRequest, NextResponse, after } from "next/server";
import { adminDb, userFromRequest } from "@/lib/server/core";
import { FOUND_FIELDS, LOST_FIELDS, rankMatches, type MatchItem } from "@/lib/server/matching";
import { moderate } from "@/lib/server/moderation";
import { alertUser } from "@/lib/server/alerts";

/**
 * Called by the browser right after a new report or comment is saved. Body: { kind, id }.
 * Answers immediately, then in the background:
 *   - scam / fake-report check (all kinds)
 *   - match alerts (reports only):
 *       found item -> alert owners of strongly matching lost items (in-app notification)
 *       lost item  -> tell the reporter if strong matches already exist
 */

export const maxDuration = 60;

const ALERT_AT = 70;

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = body.kind;
  const id = String(body.id || "");
  if (!["lost", "found", "comment"].includes(kind) || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Only the author may trigger processing, and only for fresh content (stops replaying old posts)
  const table = kind === "lost" ? "lost_items" : kind === "found" ? "found_items" : "comments";
  const { data: row } = await adminDb.from(table).select("user_id,created_at").eq("id", id).maybeSingle();
  if (!row || row.user_id !== user.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (Date.now() - new Date(row.created_at).getTime() > 15 * 60 * 1000) return NextResponse.json({ ok: true, skipped: true });

  after(async () => {
    try {
      await moderate({ type: kind, id });
    } catch (e) {
      console.error("moderation failed:", e);
    }
    if (kind === "comment") return;
    try {
      await matchAlerts(kind, id);
    } catch (e) {
      console.error("match alerts failed:", e);
    }
  });

  return NextResponse.json({ ok: true });
}

async function matchAlerts(kind: "lost" | "found", id: string) {
  if (kind === "found") {
    const { data: found } = await adminDb.from("found_items").select(FOUND_FIELDS).eq("id", id).maybeSingle<MatchItem>();
    if (!found) return;
    const { data: lost } = await adminDb
      .from("lost_items")
      .select(LOST_FIELDS)
      .eq("status", "searching")
      .order("created_at", { ascending: false })
      .limit(300)
      .returns<MatchItem[]>();
    const strong = (await rankMatches(found, "found", lost || [], { limit: 5 })).filter((m) => m.score >= ALERT_AT);

    for (const m of strong) {
      const owner = (lost || []).find((l) => l.id === m.id);
      if (!owner) continue;
      const link = `/matches?lost=${owner.id}`;
      await alertUser(owner.user_id, {
        title: "Possible match found! 🎯",
        message: `Someone reported a found "${found.item_name}" that looks like your "${owner.item_name}" (${m.score}% match). ${m.reason}`,
        type: "match_alert",
        link: `${link}&found=${found.id}`,
      });
    }
    return;
  }

  const { data: lostItem } = await adminDb.from("lost_items").select(LOST_FIELDS).eq("id", id).maybeSingle<MatchItem>();
  if (!lostItem) return;
  const { data: found } = await adminDb
    .from("found_items")
    .select(FOUND_FIELDS)
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(300)
    .returns<MatchItem[]>();
  const strong = (await rankMatches(lostItem, "lost", found || [], { limit: 5 })).filter((m) => m.score >= ALERT_AT);
  if (!strong.length) return;

  const link = `/matches?lost=${lostItem.id}`;
  await alertUser(lostItem.user_id, {
    title: "We may already have your item! 🎯",
    message: `${strong.length} found ${strong.length === 1 ? "item looks" : "items look"} like your "${lostItem.item_name}" (best: ${strong[0].score}%). Open Matches to check.`,
    type: "match_alert",
    link,
  });
}
