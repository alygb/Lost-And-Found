import { NextRequest, NextResponse } from "next/server";

function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 100;

  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w) && w.length > 2);
  const totalWords = Math.max(words1.length, words2.length);
  return Math.round((commonWords.length / totalWords) * 100);
}

function matchItems(lostItem: any, foundItem: any) {
  let score = 0;
  const reasons: string[] = [];

  // Category match (30 points)
  if (lostItem.category && foundItem.category) {
    if (lostItem.category === foundItem.category) {
      score += 30;
      reasons.push("Same category");
    }
  }

  // Item name similarity (25 points)
  const nameSimilarity = calculateSimilarity(lostItem.item_name, foundItem.item_name);
  if (nameSimilarity > 0) {
    const nameScore = Math.round((nameSimilarity / 100) * 25);
    score += nameScore;
    if (nameScore > 10) reasons.push("Similar item name");
  }

  // Description similarity (25 points)
  const descSimilarity = calculateSimilarity(lostItem.description, foundItem.description);
  if (descSimilarity > 0) {
    const descScore = Math.round((descSimilarity / 100) * 25);
    score += descScore;
    if (descScore > 10) reasons.push("Similar description");
  }

  // Location similarity (20 points)
  const locSimilarity = calculateSimilarity(lostItem.location, foundItem.location);
  if (locSimilarity > 0) {
    const locScore = Math.round((locSimilarity / 100) * 20);
    score += locScore;
    if (locScore > 5) reasons.push("Same or nearby location");
  }

  // Date proximity bonus (10 points)
  if (lostItem.date_lost && foundItem.date_found) {
    const lostDate = new Date(lostItem.date_lost).getTime();
    const foundDate = new Date(foundItem.date_found).getTime();
    const diffDays = Math.abs((foundDate - lostDate) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) { score += 10; reasons.push("Found same day"); }
    else if (diffDays <= 3) { score += 7; reasons.push("Found within 3 days"); }
    else if (diffDays <= 7) { score += 5; reasons.push("Found within a week"); }
    else if (diffDays <= 30) { score += 2; reasons.push("Found within a month"); }
  }

  // Cap at 100
  score = Math.min(score, 100);

  const reason = reasons.length > 0
    ? reasons.join(", ")
    : "Partial similarity detected";

  return { score, reason };
}

export async function POST(req: NextRequest) {
  try {
    const { lostItem, foundItems } = await req.json();

    if (!lostItem || !foundItems || foundItems.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const matches = foundItems
      .map((foundItem: any) => {
        const { score, reason } = matchItems(lostItem, foundItem);
        return { id: foundItem.id, score, reason };
      })
      .filter((m: any) => m.score >= 30)
      .sort((a: any, b: any) => b.score - a.score);

    console.log("Smart matching results:", matches);
    return NextResponse.json({ matches });

  } catch (error: any) {
    console.error("Matching error:", error);
    return NextResponse.json({ matches: [], error: error.message });
  }
}