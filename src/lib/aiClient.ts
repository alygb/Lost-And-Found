import { supabase } from "@/lib/supabase";

export type AiResult = {
  name: string;
  category: string;
  color: string;
  brand: string;
  description: string;
  marks: string;
  sensitive: boolean;
  confidence: number;
};

// Shrink the photo first so the request stays small and fast
function resize(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function analyzeImage(file: File): Promise<AiResult | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const image = await resize(file);
    const res = await fetch("/api/ai/analyze-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ image }),
      signal: AbortSignal.timeout(35000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
/** How sure the detector must be before we ask the user about a photo. */
export const AI_IMAGE_THRESHOLD = 0.5;

/**
 * Asks the server whether a photo looks AI-generated.
 * Returns the 0–1 score, or null when the check is unavailable (no keys, offline, error).
 */
export async function detectAiImage(file: File): Promise<number | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const body = new FormData();
    body.append("image", file);
    const res = await fetch("/api/ai/detect-image", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body,
      // If the check takes too long the photo is marked "unchecked" and the report can still be posted
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.available && typeof data.score === "number" ? data.score : null;
  } catch {
    return null;
  }
}
