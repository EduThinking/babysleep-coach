import type { VoiceParseResult } from "./types";
import { parseVoice } from "./voiceParser";
import { ruleCoachAnswer, type CoachContext } from "./coach";

async function postJson<T>(url: string, body: unknown, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/** Server parse (LLM when configured) with an offline rule-based fallback. */
export async function parseUtterance(text: string): Promise<VoiceParseResult> {
  const now = new Date();
  try {
    return await postJson<VoiceParseResult>("/api/voice/parse", { text, now: now.toISOString(), tzOffset: -now.getTimezoneOffset() }, 8000);
  } catch {
    return parseVoice(text, now);
  }
}

export async function askCoach(
  question: string,
  context: CoachContext,
  history: { role: string; text: string }[],
): Promise<{ answer: string; source: "llm" | "rules" | "web"; sources?: { name: string; title: string; url: string }[] }> {
  try {
    return await postJson("/api/coach/chat", { question, context, history }, 30000);
  } catch {
    return { answer: ruleCoachAnswer(question, context), source: "rules" };
  }
}

export async function aiStatus(): Promise<{ ai: boolean; model: string | null }> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return { ai: false, model: null };
  }
}
