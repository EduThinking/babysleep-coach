// AI endpoints shared by the local Express server (server.ts) and Vercel Functions (api/).
// Reads GEMINI_API_KEY / GEMINI_MODEL from the environment; without a key every endpoint
// falls back to the built-in rule engine.
// Relative imports use explicit .js extensions because Vercel runs these as Node ES modules.
import { GoogleGenAI, Type } from "@google/genai";
import { parseVoice, toOffsetIso } from "../lib/voiceParser.js";
import { ruleCoachAnswer, SAFETY_NOTE, RED_FLAG, SCOPE_MESSAGE, isOffTopic, type CoachContext } from "../lib/coachRules.js";
import { searchGuides } from "../data/guides.js";
import type { SleepEventType, VoiceParseResult } from "../lib/types";

export interface HandlerResult {
  status: number;
  body: unknown;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const INTENTS: SleepEventType[] = ["WAKE_UP", "NAP_START", "NAP_END", "NIGHT_SLEEP_START", "NIGHT_WAKE", "BACK_TO_SLEEP"];

let ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY") return null;
  ai ??= new GoogleGenAI({ apiKey: key });
  return ai;
}

// Reasoning models spend output tokens on thinking, so leave headroom beyond the visible answer.
const THINKING = { includeThoughts: false };

/**
 * Visible text of a Gemini response: non-thought parts of the first candidate only.
 * `res.text` alone can include a reasoning model's draft notes.
 */
export function visibleText(res: { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }): string {
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();
}

const cleanLine = (x: unknown) =>
  typeof x === "string"
    ? x
        .replace(/^[\s·•\-*]+/, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300)
    : "";

/**
 * Turn the coach's JSON ({ facts, info }) into the two-section answer the app shows.
 * Returns null when the payload is unusable, so the caller falls back to the rule engine.
 */
export function formatCoachAnswer(raw: string): string | null {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (data?.in_scope === false) return SCOPE_MESSAGE;
  const facts = (Array.isArray(data?.facts) ? data.facts : []).map(cleanLine).filter(Boolean).slice(0, 5);
  const info = (Array.isArray(data?.info) ? data.info : []).map(cleanLine).filter(Boolean).slice(0, 5);
  if (!facts.length && !info.length) return null;
  const sections: string[] = [];
  if (facts.length) sections.push("📋 기록에서 확인된 내용\n" + facts.map((f: string) => `· ${f}`).join("\n"));
  if (info.length) sections.push("💡 일반적인 정보\n" + info.map((f: string) => `· ${f}`).join("\n"));
  return sections.join("\n\n");
}

/** The client sends its local time + UTC offset so server-side parsing matches the user's clock. */
function clientNow(body: any): Date {
  const t = typeof body?.now === "string" ? new Date(body.now) : new Date();
  return isNaN(t.getTime()) ? new Date() : t;
}

/** Shift a server Date so that getHours() etc. reflect the client's wall clock. */
function asClientClock(now: Date, offsetMin: number) {
  const serverOffset = -now.getTimezoneOffset();
  return new Date(now.getTime() + (offsetMin - serverOffset) * 60_000);
}

async function llmParseVoice(text: string, clientClock: Date): Promise<VoiceParseResult | null> {
  const client = getAI();
  if (!client) return null;
  const hhmm = `${String(clientClock.getHours()).padStart(2, "0")}:${String(clientClock.getMinutes()).padStart(2, "0")}`;
  const res = await client.models.generateContent({
    model: MODEL,
    contents: `현재 시각: ${hhmm}\n보호자 발화: "${text}"`,
    config: {
      temperature: 0,
      maxOutputTokens: 1024,
      thinkingConfig: THINKING,
      systemInstruction: [
        "You classify a Korean caregiver's short utterance about their baby's sleep into exactly one event.",
        "Intents: WAKE_UP(아침 기상/일어났어), NAP_START(낮잠 들었어), NAP_END(낮잠에서 깼어), NIGHT_SLEEP_START(밤잠 들었어), NIGHT_WAKE(밤중에 깼어), BACK_TO_SLEEP(다시 잠들었어).",
        "Use intent=null if the utterance is not about sleep.",
        "Time: if a relative time is said (e.g. '10분 전'), set minutes_ago. If a clock time is said (e.g. '2시 반'), set clock_time as 24h HH:MM choosing the most recent past occurrence.",
        "If the time is vague (e.g. '아까', '좀 전에'), set ambiguous=true and leave both null — never guess.",
        "If no time is mentioned, it means 'now': leave both null and ambiguous=false.",
      ].join("\n"),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING, enum: INTENTS, nullable: true },
          minutes_ago: { type: Type.NUMBER, nullable: true },
          clock_time: { type: Type.STRING, nullable: true },
          ambiguous: { type: Type.BOOLEAN },
          confidence: { type: Type.NUMBER },
        },
        required: ["intent", "ambiguous", "confidence"],
      },
    },
  });
  const raw = JSON.parse(visibleText(res) || "{}");
  const intent: SleepEventType | null = INTENTS.includes(raw.intent) ? raw.intent : null;
  let time: Date | null = clientClock;
  if (raw.ambiguous) time = null;
  else if (typeof raw.minutes_ago === "number" && raw.minutes_ago >= 0 && raw.minutes_ago < 24 * 60)
    time = new Date(clientClock.getTime() - raw.minutes_ago * 60_000);
  else if (typeof raw.clock_time === "string" && /^\d{1,2}:\d{2}$/.test(raw.clock_time)) {
    const [h, m] = raw.clock_time.split(":").map(Number);
    time = new Date(clientClock);
    time.setHours(h % 24, m % 60, 0, 0);
    if (time > clientClock) time.setDate(time.getDate() - 1);
  }
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));
  return {
    intent,
    event_time: time ? toOffsetIso(time) : null,
    confidence,
    requires_confirmation: !intent || !time || confidence < 0.8,
    transcript: text,
    source: "llm",
  };
}

const COACH_SYSTEM = `당신은 한국의 0~24개월 영유아 보호자를 돕는 'AI 수면 코치'입니다.
원칙:
1. JSON으로만 답하세요. facts에는 [아기 기록 요약]에서 확인되는 사실을, info에는 [검증된 가이드]의 일반 정보와 제안을 한 문장씩 넣으세요. 제목·이모지·글머리표는 넣지 마세요(앱이 붙여요).
2. 진단하지 마세요. "수면장애", "문제가 있다" 같은 표현을 쓰지 말고, 관찰된 변화를 중립적으로 설명하세요.
3. 확정적 표현을 줄이고("~일 수 있어요", "~해 보세요"), 추천에는 짧은 이유를 붙이세요.
4. 상관관계를 인과관계처럼 말하지 마세요.
5. 호흡 이상, 고열, 의식 저하 등 건강 우려가 보이면 수면 조언 대신 119/의료진 상담을 먼저 안내하세요.
6. 가이드에 없는 새로운 의학적 권고를 만들지 마세요. 안전수면 원칙(바로 눕혀 재우기, 단단하고 평평한 매트리스, 침대에 부드러운 물건 두지 않기)과 충돌하는 조언은 절대 하지 마세요.
7. 보호자에게 죄책감이나 불안을 주지 말고 따뜻하게, 한국어 존댓말(해요체)로 facts와 info를 합쳐 8문장 이내로 쓰세요. 검토 메모, 규칙 확인, 초안, 영어 문장은 절대 넣지 말고 보호자에게 보여줄 최종 문장만 쓰세요.
8. 다음 수면 시간은 [아기 기록 요약]의 prediction 값을 그대로 사용하고 새로 계산하지 마세요.
9. 질문이 아기 수면과 관련 없으면(이유식 메뉴, 배변, 예방접종, 놀이 등) in_scope를 false로 하고 facts와 info는 빈 배열로 두세요. 밤중 수유, 이앓이, 발달처럼 잠과 이어진 질문은 수면 관점에서 답하세요.
10. 보호자가 지치거나 자책하는 마음을 드러내면 info의 첫 문장에서 먼저 그 마음을 알아주고, 보호자 탓이 아니라고 말한 뒤, 오늘 바로 해볼 수 있는 작은 행동 하나를 제안하세요. 우울감이 오래가거나 감당하기 어렵다고 하면 가족·전문가 도움과 정신건강 위기상담 전화(1577-0199)를 안내하세요.`;

async function llmCoach(question: string, ctx: CoachContext, history: { role: string; text: string }[]) {
  const client = getAI();
  if (!client) return null;
  const guides = searchGuides(question, ctx.baby.ageMonths, 3);
  const guideText = guides.length
    ? guides.map((g) => `■ ${g.title} (${g.source})\n${g.body.join("\n")}`).join("\n\n")
    : "(관련 가이드 없음 — 일반적인 안전수면 원칙만 사용)";
  const contents = [
    ...history.slice(-6).map((h) => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.text.slice(0, 1500) }] })),
    {
      role: "user",
      parts: [{ text: `[아기 기록 요약]\n${JSON.stringify(ctx, null, 1)}\n\n[검증된 가이드]\n${guideText}\n\n[보호자 질문]\n${question}` }],
    },
  ];
  const res = await client.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: COACH_SYSTEM,
      temperature: 0.4,
      maxOutputTokens: 4096,
      thinkingConfig: THINKING,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          in_scope: { type: Type.BOOLEAN, description: "질문이 아기 수면(또는 잠과 이어진 수유·이앓이·발달)에 관한 것이면 true" },
          facts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "기록에서 확인된 사실, 문장마다 1개 (0~4개)" },
          info: { type: Type.ARRAY, items: { type: Type.STRING }, description: "일반적인 정보와 제안, 문장마다 1개 (1~4개)" },
        },
        required: ["in_scope", "facts", "info"],
      },
    },
  });
  return formatCoachAnswer(visibleText(res));
}

/** Re-express event_time with the client's UTC offset. */
function fixOffset(r: VoiceParseResult, offsetMin: number): VoiceParseResult {
  if (!r.event_time) return r;
  // r.event_time was built from a client-clock-shifted Date using the server offset
  const local = r.event_time.slice(0, 19);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return { ...r, event_time: `${local}${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}` };
}

/** POST /api/voice/parse { text, now, tzOffset } */
export async function handleVoiceParse(body: any): Promise<HandlerResult> {
  const text = String(body?.text ?? "").slice(0, 300).trim();
  if (!text) return { status: 400, body: { error: "EMPTY_TEXT" } };
  const offset = Number.isFinite(body?.tzOffset) ? Number(body.tzOffset) : -new Date().getTimezoneOffset();
  const clock = asClientClock(clientNow(body), offset);
  try {
    const llm = await llmParseVoice(text, clock);
    if (llm) return { status: 200, body: fixOffset(llm, offset) };
  } catch (err: any) {
    console.warn("[voice/parse] LLM failed, using rules:", err?.message);
  }
  return { status: 200, body: fixOffset(parseVoice(text, clock), offset) };
}

/** POST /api/coach/chat { question, context, history } */
export async function handleCoachChat(body: any): Promise<HandlerResult> {
  const question = String(body?.question ?? "").slice(0, 1000).trim();
  const ctx = body?.context as CoachContext | undefined;
  const history = Array.isArray(body?.history) ? body.history : [];
  if (!question || !ctx?.baby) return { status: 400, body: { error: "BAD_REQUEST" } };

  if (RED_FLAG.test(question)) {
    // safety answers are deterministic — never delegated to the LLM
    return { status: 200, body: { answer: ruleCoachAnswer(question, ctx), source: "rules" } };
  }
  if (isOffTopic(question)) {
    return { status: 200, body: { answer: SCOPE_MESSAGE, source: "rules" } };
  }
  try {
    const answer = await llmCoach(question, ctx, history);
    if (answer === SCOPE_MESSAGE) return { status: 200, body: { answer, source: "llm" } };
    if (answer) return { status: 200, body: { answer: `${answer}\n\n_${SAFETY_NOTE}_`, source: "llm" } };
  } catch (err: any) {
    console.warn("[coach/chat] LLM failed, using rules:", err?.message);
  }
  return { status: 200, body: { answer: ruleCoachAnswer(question, ctx), source: "rules" } };
}

/** GET /api/health */
export function handleHealth(): HandlerResult {
  return { status: 200, body: { ok: true, ai: !!getAI(), model: getAI() ? MODEL : null } };
}
