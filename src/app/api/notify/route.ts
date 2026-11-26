import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Sends claim notifications (in-app + email via n8n).
 *
 * Security:
 *  - The caller must be signed in (Bearer token).
 *  - The body only says WHICH claim (matchId) and what happened. Every name, email,
 *    item name and note is read from the database, so nothing typed in a browser is trusted.
 *  - "new_claim" may only be sent by the person who made the claim;
 *    "claim_approved" / "claim_rejected" only by an admin, and only once the claim really has that status.
 *  - Each notification is sent once per claim (repeat calls do nothing).
 */

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type Person = { id: string; full_name: string | null; email: string | null } | null;
type Match = {
  id: string;
  status: string;
  admin_notes: string | null;
  lost_user_id: string;
  found_user_id: string | null;
  lost_item: { item_name: string } | null;
  lost_user: Person;
  found_user: Person;
};

async function sendEmailViaN8n(payload: object) {
  if (!process.env.N8N_WEBHOOK_URL) return;
  try {
    await fetch(process.env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("n8n email error:", err);
  }
}

/** True if this exact notification was already sent (prevents spamming by repeating the call). */
async function alreadySent(type: string, link: string) {
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", type)
    .eq("link", link);
  return (count || 0) > 0;
}

const deny = (msg: string, status = 403) => NextResponse.json({ error: msg }, { status });

export async function POST(req: NextRequest) {
  try {
    // ── Who is calling? ──
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return deny("unauthorized", 401);
    const { data: { user } } = await anon.auth.getUser(token);
    if (!user) return deny("unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const type = String(body.type || "");
    const matchId = String(body.matchId || "");
    if (!["new_claim", "claim_approved", "claim_rejected"].includes(type) || !/^[0-9a-f-]{36}$/i.test(matchId)) {
      return deny("bad request", 400);
    }

    // ── Load the claim from the database ──
    const { data: match } = await admin
      .from("matches")
      .select(`
        id, status, admin_notes, lost_user_id, found_user_id,
        lost_item:lost_items(item_name),
        lost_user:profiles!matches_lost_user_id_fkey(id, full_name, email),
        found_user:profiles!matches_found_user_id_fkey(id, full_name, email)
      `)
      .eq("id", matchId)
      .single<Match>();
    if (!match) return deny("claim not found", 404);

    const itemName = match.lost_item?.item_name || "your item";

    // ─────────────────────────────────────────
    // 1. NEW CLAIM — only the claimant, notify all admins
    // ─────────────────────────────────────────
    if (type === "new_claim") {
      if (match.lost_user_id !== user.id) return deny("not your claim");
      if (match.status !== "pending_verification") return deny("claim is not pending");
      const link = `/admin#claim-${match.id}`;
      if (await alreadySent("new_claim", link)) return NextResponse.json({ success: true, skipped: true });

      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
      if (admins?.length) {
        await admin.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.id,
            title: "New Item Claim 🔔",
            message: `${match.lost_user?.full_name || "A user"} submitted a new claim for "${itemName}". Please review it in the Claims tab.`,
            type: "new_claim",
            link,
          }))
        );
      }
      await sendEmailViaN8n({ type: "new_claim", userName: match.lost_user?.full_name, itemName });
      return NextResponse.json({ success: true });
    }

    // Approve / reject: admins only
    const { data: caller } = await admin.from("profiles").select("role, is_banned").eq("id", user.id).single();
    if (caller?.role !== "admin" || caller.is_banned) return deny("admins only");

    const note = match.admin_notes || "";

    // ─────────────────────────────────────────
    // 2. CLAIM APPROVED — notify owner and finder
    // ─────────────────────────────────────────
    if (type === "claim_approved") {
      if (match.status !== "approved") return deny("claim is not approved");
      const link = `/dashboard#claim-${match.id}`;
      if (await alreadySent("claim_approved", link)) return NextResponse.json({ success: true, skipped: true });

      await admin.from("notifications").insert({
        user_id: match.lost_user_id,
        title: "Claim Approved! ✅",
        message: `Your claim for "${itemName}" has been verified by admin. Please visit the Admin Office to collect your item. Bring your CNIC or another photo ID. Do NOT contact the finder directly.`,
        type: "claim_approved",
        link,
      });
      if (match.found_user_id) {
        await admin.from("notifications").insert({
          user_id: match.found_user_id,
          title: "Please Submit Item to Admin Office 📦",
          message: `The "${itemName}" you found has been claimed and verified by admin. Please submit it to the Admin Office within 2 days so the owner can collect it.`,
          type: "item_submit_required",
          link: "/dashboard",
        });
      }

      await sendEmailViaN8n({
        type: "claim_approved_owner",
        userEmail: match.lost_user?.email,
        userName: match.lost_user?.full_name,
        itemName,
        adminNote: note || "Please bring your CNIC or another photo ID.",
      });
      if (match.found_user?.email) {
        await sendEmailViaN8n({
          type: "claim_approved_finder",
          userEmail: match.found_user.email,
          userName: match.found_user.full_name,
          itemName,
          adminNote: note || "Please submit the item to Admin Office within 2 days.",
        });
      }
      return NextResponse.json({ success: true });
    }

    // ─────────────────────────────────────────
    // 3. CLAIM REJECTED — notify owner only
    // ─────────────────────────────────────────
    if (match.status !== "rejected") return deny("claim is not rejected");
    const link = `/dashboard#claim-${match.id}`;
    if (await alreadySent("claim_rejected", link)) return NextResponse.json({ success: true, skipped: true });

    await admin.from("notifications").insert({
      user_id: match.lost_user_id,
      title: "Claim Rejected ❌",
      message: `Your claim for "${itemName}" was not verified by admin. This item may not belong to you. You can continue searching for your item.`,
      type: "claim_rejected",
      link,
    });
    await sendEmailViaN8n({
      type: "claim_rejected",
      userEmail: match.lost_user?.email,
      userName: match.lost_user?.full_name,
      itemName,
      adminNote: note || "No note provided",
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("notify error:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
