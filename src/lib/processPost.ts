import { supabase } from "@/lib/supabase";

/**
 * Tells the server a new report or comment was saved, so it can run the scam check and
 * send match alerts (in-app notifications). Fire-and-forget: the post is already saved.
 */
export async function processPost(kind: "lost" | "found" | "comment", id: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/reports/process", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ kind, id }),
      keepalive: true,
    });
  } catch {
    // Best-effort only
  }
}
