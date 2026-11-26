import { createClient } from "@supabase/supabase-js";

/**
 * Server-only helpers. Only import from route handlers (src/app/api/**), never from client components.
 * Server-side Supabase client with the secret key (bypasses RLS).
 */
export const adminDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const anonDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

/** The signed-in user behind a request's Bearer token, or null. */
export async function userFromRequest(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await anonDb.auth.getUser(token);
  return user;
}

export const TEXT_MODEL = () => process.env.AI_CHAT_MODEL || "deepseek/deepseek-chat";
export const VISION_MODEL = () => process.env.AI_VISION_MODEL || "google/gemini-2.5-flash";

type ChatContent = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];

/** One OpenRouter chat call. Returns the reply text, or null on any failure. */
export async function aiChat(
  content: ChatContent,
  { model = TEXT_MODEL(), maxTokens = 800, temperature = 0.1, timeoutMs = 25000 } = {}
): Promise<string | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages: [{ role: "user", content }] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.error("AI error:", model, res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("AI call failed:", model, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Pulls the first JSON object or array out of an AI reply. */
export function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  const m = text.match(/[[{][\s\S]*[\]}]/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}
