import { describe, expect, it } from "vitest";
import { formatCoachAnswer, visibleText } from "../src/server/ai";

describe("visibleText", () => {
  it("drops thought parts from a reasoning model response", () => {
    const res = {
      candidates: [
        {
          content: {
            parts: [
              { text: "* Check verbatim prediction requirement (Rule 8)...", thought: true },
              { text: '{"facts":["오늘 13:42에 첫 낮잠을 시작했어요."],"info":["졸린 신호를 살펴봐 주세요."]}' },
            ],
          },
        },
      ],
    };
    expect(visibleText(res)).not.toContain("Check verbatim");
    expect(formatCoachAnswer(visibleText(res), "모찌")).toBe(
      "🌙 모찌의 잠 기록\n· 오늘 13:42에 첫 낮잠을 시작했어요.\n\n💬 답변\n· 졸린 신호를 살펴봐 주세요.",
    );
  });

  it("returns empty text when there are no candidates", () => {
    expect(visibleText({})).toBe("");
  });
});

describe("formatCoachAnswer", () => {
  it("renders each section once, stripping model-added bullets", () => {
    const out = formatCoachAnswer(JSON.stringify({ facts: ["· 사실 하나", "- 사실 둘"], info: ["정보"] })) as string;
    expect(out.match(/🌙/g)).toHaveLength(1);
    expect(out.match(/💬/g)).toHaveLength(1);
    expect(out).toContain("· 사실 하나\n· 사실 둘");
  });

  it("omits an empty facts section", () => {
    expect(formatCoachAnswer(JSON.stringify({ facts: [], info: ["정보"] }))).toBe("💬 답변\n· 정보");
  });

  it("rejects non-JSON or empty payloads so the rule engine answers instead", () => {
    expect(formatCoachAnswer("📋 기록에서 확인된 내용\n생후 1개월인 ...")).toBeNull();
    expect(formatCoachAnswer(JSON.stringify({ facts: [], info: [] }))).toBeNull();
    expect(formatCoachAnswer(JSON.stringify({ facts: [42, null], info: [""] }))).toBeNull();
  });
});
