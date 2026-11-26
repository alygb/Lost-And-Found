import { adminDb, aiChat, parseJson } from "./core";
import { alertAdmins } from "./alerts";

/**
 * Scam / spam / fake-report detection.
 * Fixed rules catch the obvious patterns (asking for money, links, CNIC numbers, copy-paste, flooding);
 * the AI reads the text for the rest. Anything scoring >= FLAG_AT is saved in moderation_flags for admins.
 * Nothing is hidden or deleted automatically: an admin always decides.
 */

export const FLAG_AT = 50;
const ALERT_ADMINS_AT = 75;

export type Target = { type: "lost" | "found" | "comment"; id: string };

export const FLAG_LABELS: Record<string, string> = {
  money_request: "Asks for money",
  external_link: "Outside link",
  personal_data: "Shares CNIC / card number",
  contact_in_comment: "Phone number in public comment",
  duplicate_self: "Repeated report",
  duplicate_other: "Copied from another user",
  flooding: "Too many posts",
  scam: "Possible scam",
  spam: "Spam / advert",
  fake: "Looks fake or a test",
  abusive: "Abusive language",
};

const MONEY = /\b(send|pay|transfer|deposit|advance|fee|charges?|reward\s+first|first\s+pay|paise?\s*(bhej|do|bhejo)|raqam|jazz\s*cash|easy\s*paisa|easypaisa|jazzcash|western\s+union|bank\s+account)\b|پیسے\s*بھیج|رقم|ایزی\s*پیسہ|جاز\s*کیش|ایڈوانس/i;
const LINK = /(https?:\/\/|www\.|bit\.ly|wa\.me|t\.me|\b[a-z0-9-]+\.(com|net|xyz|pk|info|link|shop)\b)/i;
const CNIC = /\b\d{5}-?\d{7}-?\d\b/;
const CARD = /\b(?:\d[ -]?){16}\b/;
const PHONE = /(\+?92|0)3\d{2}[\s-]?\d{7}\b/;

type Loaded = { text: string; userId: string; itemId: string | null; createdAt: string };

async function load(t: Target): Promise<Loaded | null> {
  if (t.type === "comment") {
    const { data } = await adminDb.from("comments").select("body,user_id,item_id,created_at").eq("id", t.id).maybeSingle();
    return data ? { text: data.body, userId: data.user_id, itemId: data.item_id, createdAt: data.created_at } : null;
  }
  const { data } = await adminDb
    .from(t.type === "lost" ? "lost_items" : "found_items")
    .select("item_name,description,location,user_id,created_at")
    .eq("id", t.id)
    .maybeSingle();
  if (!data) return null;
  return {
    text: [data.item_name, data.description, data.location].filter(Boolean).join("\n"),
    userId: data.user_id,
    itemId: t.id,
    createdAt: data.created_at,
  };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

async function ruleChecks(t: Target, c: Loaded) {
  const flags: string[] = [];
  let score = 0;
  const add = (flag: string, pts: number) => {
    if (!flags.includes(flag)) {
      flags.push(flag);
      score += pts;
    }
  };

  if (MONEY.test(c.text)) add("money_request", 40);
  if (LINK.test(c.text)) add("external_link", 25);
  if (CNIC.test(c.text) || CARD.test(c.text)) add("personal_data", 35);
  if (t.type === "comment" && PHONE.test(c.text)) add("contact_in_comment", 15);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  if (t.type === "comment") {
    const { count } = await adminDb.from("comments").select("id", { count: "exact", head: true }).eq("user_id", c.userId).gte("created_at", since);
    if ((count || 0) > 20) add("flooding", 30);
  } else {
    const [lost, found] = await Promise.all([
      adminDb.from("lost_items").select("id", { count: "exact", head: true }).eq("user_id", c.userId).gte("created_at", since),
      adminDb.from("found_items").select("id", { count: "exact", head: true }).eq("user_id", c.userId).gte("created_at", since),
    ]);
    if ((lost.count || 0) + (found.count || 0) > 6) add("flooding", 30);

    // Same description posted before, by this user (repeat) or by someone else (copy-paste)
    const table = t.type === "lost" ? "lost_items" : "found_items";
    const { data: me } = await adminDb.from(table).select("description").eq("id", t.id).maybeSingle();
    const desc = norm(me?.description || "");
    if (desc.length >= 25) {
      const { data: same } = await adminDb.from(table).select("id,user_id").ilike("description", desc.slice(0, 200).replace(/[%_]/g, "") + "%").neq("id", t.id).limit(5);
      if (same?.some((s) => s.user_id !== c.userId)) add("duplicate_other", 30);
      else if (same?.length) add("duplicate_self", 20);
    }
  }
  return { flags, score: Math.min(100, score) };
}

async function aiCheck(t: Target, text: string) {
  const what = t.type === "comment" ? "a public comment under an item" : `a ${t.type.toUpperCase()} item report`;
  const prompt = `You are a safety checker for AJK Lost & Found (Azad Kashmir, Pakistan). Users write in English, Urdu or Roman Urdu.
Check ${what} for:
- scam: asking for money, fees, "reward first", JazzCash/EasyPaisa transfers, fake finder/owner tricks, phishing
- spam: adverts, selling things, unrelated promotion
- fake: test posts, nonsense, jokes, obviously made-up reports
- abusive: insults, harassment, hate
A normal report describing a lost/found item, even with a phone number or a reward offered by the OWNER, is fine (score low).

Text:
"""${text.slice(0, 1500).replace(/"""/g, "'")}"""

Reply with ONLY JSON: {"risk": 0-100, "labels": ["scam"|"spam"|"fake"|"abusive"], "reason": "one short sentence for the admin"}`;
  const r = parseJson<{ risk: number; labels: string[]; reason: string }>(await aiChat(prompt, { maxTokens: 200 }));
  if (!r || typeof r.risk !== "number") return null;
  return {
    risk: Math.max(0, Math.min(100, Math.round(r.risk))),
    labels: (Array.isArray(r.labels) ? r.labels : []).filter((l) => ["scam", "spam", "fake", "abusive"].includes(l)),
    reason: String(r.reason || "").slice(0, 300),
  };
}

/** Checks one report or comment and saves a flag if it looks risky. */
export async function moderate(t: Target) {
  const c = await load(t);
  if (!c) return null;

  const [rules, ai] = await Promise.all([ruleChecks(t, c), aiCheck(t, c.text)]);
  const aiRisk = ai && ai.labels.length ? ai.risk : Math.min(ai?.risk ?? 0, 40);
  // Both agreeing is stronger than either alone
  const score = Math.min(100, Math.max(rules.score, aiRisk) + (rules.score >= 25 && aiRisk >= 40 ? 15 : 0));
  const flags = [...new Set([...rules.flags, ...(ai?.labels || [])])];

  if (score < FLAG_AT || !flags.length) return { score, flags, flagged: false };

  const reason =
    ai?.reason && ai.labels.length ? ai.reason : flags.map((f) => FLAG_LABELS[f] || f).join(", ");
  await adminDb.from("moderation_flags").upsert(
    {
      target_type: t.type,
      target_id: t.id,
      item_id: c.itemId,
      user_id: c.userId,
      score,
      flags,
      reason,
      excerpt: c.text.slice(0, 300),
      status: "open",
    },
    { onConflict: "target_type,target_id" }
  );

  if (score >= ALERT_ADMINS_AT) {
    await alertAdmins({
      title: "Suspicious post flagged 🚩",
      message: `A ${t.type === "comment" ? "comment" : `${t.type} report`} was flagged (${score}% risk): ${reason}`,
      type: "moderation_flag",
      link: `/admin#flag-${t.type}-${t.id}`,
    });
  }
  return { score, flags, flagged: true };
}
