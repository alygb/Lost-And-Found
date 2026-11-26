import { adminDb, aiChat, parseJson, VISION_MODEL } from "./core";

/**
 * Smarter matching in three stages:
 *   1. Quick filter: a cheap score (category, district, dates, shared words) picks the best ~12 candidates.
 *   2. AI by meaning: an LLM scores each candidate. It understands synonyms and English / Urdu / Roman Urdu,
 *      so "black wallet" matches "kala batwa" and "dark leather purse".
 *   3. Photo check: for the top few candidates where both sides have a photo, a vision model compares them.
 * If the AI is unavailable, the quick score is used so matching never breaks.
 */

export type MatchItem = {
  id: string;
  user_id: string;
  item_name: string;
  category: string;
  description?: string | null;
  location?: string | null;
  district_id?: number | null;
  date_lost?: string | null;
  date_found?: string | null;
  image_urls?: string[] | null;
  image_url?: string | null;
};

export type MatchResult = {
  id: string;
  score: number;
  reason: string;
  textScore: number;
  photoScore: number | null;
  photoNote?: string;
  signals: string[];
  ai: boolean;
};

export const ITEM_FIELDS = "id,user_id,item_name,category,description,location,district_id,date_lost,date_found,image_urls,image_url";
export const FOUND_FIELDS = ITEM_FIELDS.replace("date_lost,", "");
export const LOST_FIELDS = ITEM_FIELDS.replace("date_found,", "");

const MIN_SCORE = 35;
const AI_CANDIDATES = 12;
const PHOTO_CHECKS = 3;

const photo = (i: MatchItem) => i.image_urls?.[0] || i.image_url || "";
const words = (s?: string | null) =>
  (s || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);

function overlap(a?: string | null, b?: string | null) {
  const wa = new Set(words(a));
  const wb = new Set(words(b));
  if (!wa.size || !wb.size) return 0;
  let common = 0;
  wa.forEach((w) => wb.has(w) && common++);
  return common / Math.max(wa.size, wb.size);
}

/** Days from losing to finding (negative = found before it was lost). */
function dayGap(lost: MatchItem, found: MatchItem) {
  if (!lost.date_lost || !found.date_found) return null;
  return (new Date(found.date_found).getTime() - new Date(lost.date_lost).getTime()) / 86400000;
}

/** Stage 1: quick score 0-100 with the reasons it found. */
export function quickScore(lost: MatchItem, found: MatchItem) {
  let score = 0;
  const signals: string[] = [];

  if (lost.category && lost.category === found.category) {
    score += 30;
    signals.push("Same category");
  }
  if (lost.district_id && lost.district_id === found.district_id) {
    score += 15;
    signals.push("Same district");
  }
  const name = overlap(lost.item_name, found.item_name);
  if (name > 0) {
    score += Math.round(name * 25);
    if (name >= 0.4) signals.push("Similar name");
  }
  const desc = overlap(lost.description, found.description);
  if (desc > 0) {
    score += Math.round(desc * 15);
    if (desc >= 0.3) signals.push("Similar description");
  }
  const loc = overlap(lost.location, found.location);
  if (loc > 0) {
    score += Math.round(loc * 10);
    if (loc >= 0.4) signals.push("Nearby place");
  }
  const gap = dayGap(lost, found);
  if (gap !== null) {
    if (gap < -2) score -= 25; // found days before it was lost: unlikely
    else if (gap <= 1) { score += 10; signals.push("Found within a day"); }
    else if (gap <= 7) { score += 6; signals.push("Found within a week"); }
    else if (gap <= 30) score += 2;
  }
  return { score: Math.max(0, Math.min(100, score)), signals };
}

async function districtNames(ids: (number | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is number => typeof x === "number"))];
  if (!unique.length) return new Map<number, string>();
  const { data } = await adminDb.from("districts").select("id,name").in("id", unique);
  return new Map((data || []).map((d) => [d.id as number, d.name as string]));
}

function describe(i: MatchItem, kind: "lost" | "found", districts: Map<number, string>) {
  return [
    `name: ${i.item_name}`,
    `category: ${i.category}`,
    i.description ? `description: ${i.description.slice(0, 350)}` : "",
    i.location ? `place: ${i.location}` : "",
    i.district_id ? `district: ${districts.get(i.district_id) || i.district_id}` : "",
    kind === "lost" ? (i.date_lost ? `date lost: ${i.date_lost}` : "") : i.date_found ? `date found: ${i.date_found}` : "",
    photo(i) ? "has photo: yes" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** Stage 2: the AI scores how likely each pair is the same physical item. */
async function aiTextScores(base: MatchItem, baseKind: "lost" | "found", candidates: MatchItem[]) {
  const otherKind = baseKind === "lost" ? "found" : "lost";
  const districts = await districtNames([base.district_id, ...candidates.map((c) => c.district_id)]);
  const list = candidates.map((c, i) => `c${i + 1} -> ${describe(c, otherKind, districts)}`).join("\n");

  const prompt = `You match LOST and FOUND item reports for a lost-and-found service in Azad Jammu & Kashmir, Pakistan.
Reports may be in English, Urdu or Roman Urdu; treat translations and synonyms as the same (e.g. "batwa" = wallet, "kala" = black, "shanakhti card" = CNIC).

The ${baseKind.toUpperCase()} report:
${describe(base, baseKind, districts)}

Candidate ${otherKind.toUpperCase()} reports:
${list}

For EACH candidate give a score 0-100 for how likely it is the very same physical item:
- 85-100: same item type AND matching specific details (colour, brand, contents, marks) AND plausible place/date
- 60-84: same item type, details fit, nothing contradicts
- 30-59: same item type but details are vague or partly differ
- 0-29: different item type, contradicting colour/brand, or the item was found well before it was lost
Ignore writing style. Do not reward a match only because both are in the same category.
"reason": one short, plain English sentence a user will read, naming the concrete details that match or differ.

Reply with ONLY a JSON array: [{"id":"c1","score":0,"reason":"..."}, ...] covering every candidate.`;

  const parsed = parseJson<{ id: string; score: number; reason: string }[]>(await aiChat(prompt, { maxTokens: 1200 }));
  if (!Array.isArray(parsed)) return null;
  const out = new Map<string, { score: number; reason: string }>();
  parsed.forEach((r) => {
    const idx = Number(String(r.id).replace(/\D/g, "")) - 1;
    const c = candidates[idx];
    if (c && typeof r.score === "number") {
      out.set(c.id, { score: Math.max(0, Math.min(100, Math.round(r.score))), reason: String(r.reason || "").slice(0, 240) });
    }
  });
  return out.size ? out : null;
}

/** Stage 3: does the photo of A show the same object as the photo of B? */
async function photoSimilarity(a: string, b: string) {
  const prompt = `Two people uploaded these photos to a lost-and-found site: the first is a LOST item, the second a FOUND item.
Could they show the very same physical object? Compare object type, colour, brand/logo, shape, wear and unique marks.
Different lighting, angle or background does not matter. Do not read out any ID numbers or personal data.
Reply with ONLY JSON: {"similarity": 0-100, "note": "one short sentence"}`;
  const r = parseJson<{ similarity: number; note: string }>(
    await aiChat(
      [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: a } },
        { type: "image_url", image_url: { url: b } },
      ],
      { model: VISION_MODEL(), maxTokens: 200, timeoutMs: 30000 }
    )
  );
  if (!r || typeof r.similarity !== "number") return null;
  return { score: Math.max(0, Math.min(100, Math.round(r.similarity))), note: String(r.note || "").slice(0, 200) };
}

/**
 * Ranks candidates against one item. `base` is a lost item (candidates = found items) or the other way round.
 * Returns matches with score >= 35, best first.
 */
export async function rankMatches(
  base: MatchItem,
  baseKind: "lost" | "found",
  candidates: MatchItem[],
  { photos = true, limit = 10 } = {}
): Promise<MatchResult[]> {
  const pair = (c: MatchItem) => (baseKind === "lost" ? { lost: base, found: c } : { lost: c, found: base });

  // 1. Quick filter
  const quick = candidates
    .filter((c) => c.id !== base.id && c.user_id !== base.user_id)
    .map((c) => {
      const { lost, found } = pair(c);
      return { item: c, ...quickScore(lost, found) };
    })
    .sort((a, b) => b.score - a.score);
  if (!quick.length) return [];
  const shortlist = quick.slice(0, AI_CANDIDATES);

  // 2. AI by meaning
  const ai = await aiTextScores(base, baseKind, shortlist.map((q) => q.item));

  let results: MatchResult[] = shortlist.map((q) => {
    const a = ai?.get(q.item.id);
    return {
      id: q.item.id,
      textScore: a ? a.score : q.score,
      score: a ? a.score : q.score,
      reason: a?.reason || (q.signals.length ? q.signals.join(", ") : "Partial similarity"),
      photoScore: null,
      signals: q.signals,
      ai: !!a,
    };
  });

  // 3. Photo check on the strongest few
  if (photos && photo(base)) {
    const top = results
      .filter((r) => r.score >= 40)
      .sort((a, b) => b.score - a.score)
      .slice(0, PHOTO_CHECKS)
      .map((r) => ({ r, c: shortlist.find((q) => q.item.id === r.id)!.item }))
      .filter(({ c }) => photo(c));
    const checks = await Promise.all(
      top.map(({ c }) => {
        const { lost, found } = pair(c);
        return photoSimilarity(photo(lost), photo(found));
      })
    );
    top.forEach(({ r }, i) => {
      const p = checks[i];
      if (!p) return;
      r.photoScore = p.score;
      r.photoNote = p.note;
      // Photos refine the score: very similar photos lift it, clearly different photos pull it down
      r.score = Math.round(r.textScore * 0.7 + p.score * 0.3);
      if (p.score >= 70) r.signals = [...r.signals, "Photos look alike"];
    });
  }

  results = results.filter((r) => r.score >= MIN_SCORE).sort((a, b) => b.score - a.score).slice(0, limit);
  return results;
}
