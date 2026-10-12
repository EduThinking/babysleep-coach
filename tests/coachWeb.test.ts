import { describe, expect, it } from "vitest";
import { matchTrustedSite } from "../src/data/trustedSources";
import { chunkHost, extractTrustedAnswer, formatCoachAnswer, formatWebAnswer } from "../src/server/ai";
import { NOT_FOUND_MESSAGE, ruleCoachAnswer, type CoachContext } from "../src/lib/coachRules";

describe("trusted sites", () => {
  it("matches exact domains and subdomains, preferring the most specific", () => {
    expect(matchTrustedSite("health.kdca.go.kr")?.name).toBe("질병관리청 국가건강정보포털");
    expect(matchTrustedSite("www.kdca.go.kr")?.name).toBe("질병관리청");
    expect(matchTrustedSite("www.healthychildren.org")?.domain).toBe("healthychildren.org");
  });

  it("rejects look-alikes and unlisted sites", () => {
    expect(matchTrustedSite("kdca.go.kr.example.com")).toBeNull();
    expect(matchTrustedSite("notkdca.go.kr")).toBeNull();
    expect(matchTrustedSite("blog.naver.com")).toBeNull();
    expect(matchTrustedSite(null)).toBeNull();
  });

  it("reads the domain from the title when the URI is a Google redirect", () => {
    expect(chunkHost({ uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "kdca.go.kr" })).toBe("kdca.go.kr");
    expect(chunkHost({ uri: "https://www.who.int/news/item/1" })).toBe("www.who.int");
    expect(chunkHost({ uri: "https://vertexaisearch.cloud.google.com/x", title: "이유식 안내" })).toBeNull();
  });
});

const grounded = (supports: { text: string; idx: number[] }[], chunks: { uri: string; title: string }[], text = "본문") => ({
  candidates: [
    {
      content: { parts: [{ text }] },
      groundingMetadata: {
        groundingChunks: chunks.map((web) => ({ web })),
        groundingSupports: supports.map((s) => ({ segment: { text: s.text }, groundingChunkIndices: s.idx })),
      },
    },
  ],
});
const R = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/";

describe("extractTrustedAnswer", () => {
  it("keeps only sentences backed by trusted sites and lists those sites", () => {
    const res = grounded(
      [
        { text: "이유식은 보통 생후 6개월 전후에 시작해요.", idx: [0] },
        { text: "맘카페에서는 4개월에 시작했다는 이야기도 있어요.", idx: [1] },
        { text: "처음에는 한 가지 재료로 시작해요.", idx: [1, 2] },
      ],
      [
        { uri: R + "a", title: "health.kdca.go.kr" },
        { uri: R + "b", title: "cafe.naver.com" },
        { uri: R + "c", title: "who.int" },
      ],
    );
    const out = extractTrustedAnswer(res)!;
    expect(out.lines).toEqual(["이유식은 보통 생후 6개월 전후에 시작해요.", "처음에는 한 가지 재료로 시작해요."]);
    expect(out.sources.map((s) => s.name)).toEqual(["질병관리청 국가건강정보포털", "세계보건기구(WHO)"]);
    expect(out.sources.every((s) => s.url.startsWith(R))).toBe(true);
  });

  it("returns null when no trusted source backs any sentence", () => {
    const res = grounded([{ text: "블로그 내용", idx: [0] }], [{ uri: R + "a", title: "blog.naver.com" }]);
    expect(extractTrustedAnswer(res)).toBeNull();
  });

  it("returns null for ungrounded text or an explicit NOT_FOUND", () => {
    expect(extractTrustedAnswer({ candidates: [{ content: { parts: [{ text: "근거 없는 답" }] } }] })).toBeNull();
    expect(extractTrustedAnswer(grounded([{ text: "x", idx: [0] }], [{ uri: R, title: "kdca.go.kr" }], "NOT_FOUND"))).toBeNull();
  });

  it("ignores thought parts", () => {
    const res = grounded([{ text: "근거 문장", idx: [0] }], [{ uri: R + "a", title: "kdca.go.kr" }]);
    (res.candidates[0].content.parts as any[]).unshift({ text: "Check rules...", thought: true });
    expect(extractTrustedAnswer(res)?.lines).toEqual(["근거 문장"]);
  });

  it("formats the answer with the source header and the doctor / age note", () => {
    const a = formatWebAnswer(["문장 하나"]);
    expect(a.startsWith("🔎 공신력 있는 기관 자료")).toBe(true);
    expect(a).toContain("월령");
    expect(a).toContain("소아청소년과 의사와 상담");
  });
});

const ctx: CoachContext = {
  baby: { nickname: "하은이", ageMonths: 7, ageGroup: "7~9개월", usualWakeTime: "07:00", usualBedtime: "20:00" },
  now: "11:00",
  state: "깨어 있어요",
  today: { events: [{ time: "07:00", label: "아침 기상" }], napCount: 1, napMinutes: 60, lastNapMinutes: 60 },
  prediction: { next: "낮잠 13:10~13:30", schedule: [], reason: "최근 7일 평균", personalization: "MIXED" },
  norms: { wakeWindow: "2시간 30분~3시간 30분", naps: 2, totalSleep: "12~16시간", typicalNap: "1시간 10분" },
  week: { daysWithData: 0, avgNight: null, avgNap: null, avgBedtime: null, avgWakings: null, prevAvgNight: null, prevAvgWakings: null, avgNapMinutes: null },
};

describe("answer layout", () => {
  it("questions about this baby's sleep put the baby's sleep first, then the answer", () => {
    const a = ruleCoachAnswer("다음 낮잠은 언제 재우는 게 좋아?", ctx);
    expect(a.indexOf("🌙 하은이의 잠 기록")).toBe(0);
    expect(a.indexOf("💬 답변")).toBeGreaterThan(0);
  });

  it("general questions show no baby-sleep section", () => {
    const a = ruleCoachAnswer("7개월 아기에게 흔한 수면 변화가 뭐야?", ctx);
    expect(a).not.toContain("🌙 하은이의 잠 기록");
    expect(a.startsWith("💬 답변")).toBe(true);
    const generic = ruleCoachAnswer("안녕하세요", ctx);
    expect(generic).not.toContain("하은이의 잠 기록");
  });

  it("drops the baby-sleep section when Gemini marks the question as general", () => {
    const out = formatCoachAnswer(JSON.stringify({ in_scope: true, about_my_baby: false, facts: ["오늘 낮잠 1회"], info: ["일반 정보"] }), "하은이");
    expect(out).toBe("💬 답변\n· 일반 정보");
  });

  it("non-sleep questions without the web get the not-found guidance", () => {
    expect(ruleCoachAnswer("이유식은 언제 시작해?", ctx)).toBe(NOT_FOUND_MESSAGE);
  });
});
