import { describe, expect, it } from "vitest";
import { COACH_SCOPE, SCOPE_MESSAGE, isOffTopic, ruleCoachAnswer, type CoachContext } from "../src/lib/coachRules";
import { formatCoachAnswer } from "../src/server/ai";

const ctx: CoachContext = {
  baby: { nickname: "하은이", ageMonths: 7, ageGroup: "7~9개월", usualWakeTime: "07:00", usualBedtime: "20:00" },
  now: "11:00",
  state: "깨어 있어요",
  today: { events: [], napCount: 1, napMinutes: 60, lastNapMinutes: 60 },
  prediction: { next: "낮잠 13:10~13:30", schedule: [], reason: "r", personalization: "GUIDE" },
  norms: { wakeWindow: "2시간 30분~3시간 30분", naps: 2, totalSleep: "12~16시간", typicalNap: "1시간 10분" },
  week: { daysWithData: 0, avgNight: null, avgNap: null, avgBedtime: null, avgWakings: null, prevAvgNight: null, prevAvgWakings: null, avgNapMinutes: null },
};

describe("coach scope", () => {
  it.each(["이유식은 언제 시작해?", "분유 수유량이 얼마나 돼야 해?", "예방접종 일정 알려줘", "변비가 있어요", "7개월 아기랑 할 놀이 추천해줘"])(
    "off-topic: %s",
    (q) => {
      expect(isOffTopic(q)).toBe(true);
      expect(ruleCoachAnswer(q, ctx)).toBe(SCOPE_MESSAGE);
    },
  );

  it.each([
    "밤중 수유를 끊으면 잠을 더 잘까?",
    "이앓이 때문에 자꾸 깨요",
    "낮잠이 짧은 이유가 뭐야?",
    "자기 전에 놀이 해도 돼?",
    "이번 주 수면 패턴을 요약해줘",
    "다음 낮잠은 언제 재우는 게 좋아?",
  ])("in scope: %s", (q) => {
    expect(isOffTopic(q)).toBe(false);
  });

  it("health red flags still win over scope", () => {
    expect(ruleCoachAnswer("이유식 먹고 숨을 이상하게 쉬어요", ctx)).toContain("119");
  });

  it("the scope message lists what the coach covers", () => {
    for (const s of COACH_SCOPE) expect(SCOPE_MESSAGE).toContain(s);
  });

  it("an LLM in_scope=false reply becomes the scope message", () => {
    expect(formatCoachAnswer(JSON.stringify({ in_scope: false, facts: [], info: [] }))).toBe(SCOPE_MESSAGE);
    expect(formatCoachAnswer(JSON.stringify({ in_scope: true, facts: [], info: ["정보"] }))).toBe("💡 일반적인 정보\n· 정보");
  });
});

describe("caregiver comfort", () => {
  it("opens with empathy when the caregiver is exhausted, then still answers", () => {
    const a = ruleCoachAnswer("요즘 밤에 자주 깨서 너무 힘들어요", ctx);
    expect(a.startsWith("🤍")).toBe(true);
    expect(a).toContain("💡 일반적인 정보");
    expect(a).toContain("밤중 각성");
    expect(a).not.toContain("1577-0199");
  });

  it("adds a support line for signs of heavier distress", () => {
    expect(ruleCoachAnswer("재우다가 눈물이 나고 이제 못하겠어요", ctx)).toContain("1577-0199");
  });

  it("does not add comfort to neutral questions", () => {
    expect(ruleCoachAnswer("다음 낮잠은 언제 재우는 게 좋아?", ctx).startsWith("🤍")).toBe(false);
  });
});
