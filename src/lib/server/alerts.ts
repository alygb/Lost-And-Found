import { adminDb } from "./core";

/** In-app notifications (the 🔔 bell), used for match alerts and moderation alerts. */

/** True if this exact notification (same type + link) was already sent to this user. */
export async function alreadyNotified(userId: string, type: string, link: string) {
  const { count } = await adminDb
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", type)
    .eq("link", link);
  return (count || 0) > 0;
}

type Alert = {
  title: string;
  message: string;
  type: string;
  link: string;
  /** Skip if the same type+link was already sent to this user. Default true. */
  once?: boolean;
};

/** Saves an in-app notification for one user. */
export async function alertUser(userId: string, a: Alert) {
  if (a.once !== false && (await alreadyNotified(userId, a.type, a.link))) return { skipped: true };
  await adminDb.from("notifications").insert({ user_id: userId, title: a.title, message: a.message, type: a.type, link: a.link });
  return { skipped: false };
}

/** Alerts every active admin. */
export async function alertAdmins(a: Alert) {
  const { data: admins } = await adminDb.from("profiles").select("id").eq("role", "admin").or("is_banned.is.null,is_banned.eq.false");
  await Promise.all((admins || []).map((x) => alertUser(x.id, a)));
}
