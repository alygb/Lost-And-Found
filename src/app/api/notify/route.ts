import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function sendEmailViaN8n(payload: object) {
  try {
    await fetch(process.env.N8N_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("n8n email error:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      type,
      lostUserId,
      foundUserId,
      userEmail,
      userName,
      finderEmail,
      finderName,
      itemName,
      adminNote,
    } = await req.json();

    // ─────────────────────────────────────────
    // 1. NEW CLAIM — notify all admins
    // ─────────────────────────────────────────
    if (type === "new_claim") {
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");

      for (const admin of admins || []) {
        await supabase.from("notifications").insert({
          user_id: admin.id,
          title: "New Item Claim 🔔",
          message: `A student has submitted a new claim for "${itemName}". Please review and verify in the Claims tab.`,
          type: "new_claim",
        });
      }

      await sendEmailViaN8n({
        type: "new_claim",
        userName,
        itemName,
      });
    }

    // ─────────────────────────────────────────
    // 2. CLAIM APPROVED — notify BOTH users
    // ─────────────────────────────────────────
    if (type === "claim_approved") {

      // Notify OWNER — go to admin office to collect
      await supabase.from("notifications").insert({
        user_id: lostUserId,
        title: "Claim Approved! ✅",
        message: `Your claim for "${itemName}" has been verified by admin. Please visit the Admin Office to collect your item. Bring your University ID card for verification. Do NOT contact the finder directly.`,
        type: "claim_approved",
      });

      // Notify FINDER — submit item to admin office
      if (foundUserId) {
        await supabase.from("notifications").insert({
          user_id: foundUserId,
          title: "Please Submit Item to Admin Office 📦",
          message: `The "${itemName}" you found has been claimed and verified by admin. Please submit it to the Admin Office within 2 days so the owner can collect it.`,
          type: "item_submit_required",
        });
      }

      // Email OWNER
      await sendEmailViaN8n({
        type: "claim_approved_owner",
        userEmail,
        userName,
        itemName,
        adminNote: adminNote || "Please bring your University ID card.",
      });

      // Email FINDER
      if (finderEmail) {
        await sendEmailViaN8n({
          type: "claim_approved_finder",
          userEmail: finderEmail,
          userName: finderName,
          itemName,
          adminNote: adminNote || "Please submit the item to Admin Office within 2 days.",
        });
      }
    }

    // ─────────────────────────────────────────
    // 3. CLAIM REJECTED — notify owner only
    // ─────────────────────────────────────────
    if (type === "claim_rejected") {
      await supabase.from("notifications").insert({
        user_id: lostUserId,
        title: "Claim Rejected ❌",
        message: `Your claim for "${itemName}" was not verified by admin. This item may not belong to you. You can continue searching for your item.`,
        type: "claim_rejected",
      });

      await sendEmailViaN8n({
        type: "claim_rejected",
        userEmail,
        userName,
        itemName,
        adminNote: adminNote || "No note provided",
      });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}