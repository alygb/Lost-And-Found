import { supabase } from "@/lib/supabase";

/** Asks the server to send claim notifications. The server reads every detail from the database. */
export async function notifyClaim(type: "new_claim" | "claim_approved" | "claim_rejected", matchId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ type, matchId }),
    });
  } catch {
    // Notifications are best-effort; the claim itself is already saved
  }
}
