// Server-safe coach rules: imported by Vercel Functions, so keep dependencies minimal
// and use explicit .js extensions (Node ESM requires them at runtime).
import { fmtDuration } from "./time.js";
import { searchGuides, recommendedGuides, type Guide } from "../data/guides.js";

/** The minimum data the coach needs. No birth date, no raw history beyond today. */
export interface CoachContext {
  baby: { nickname: string; ageMonths: number; ageGroup: string; usualWakeTime: string; usualBedtime: string };
  now: string;
  state: string;
  today: { events: { time: string; label: string }[]; napCount: number; napMinutes: number; lastNapMinutes: number | null };
  prediction: { next: string | null; schedule: string[]; reason: string; personalization: string };
  norms: { wakeWindow: string; naps: number; totalSleep: string; typicalNap: string };
  week: {
    daysWithData: number;
    avgNight: string | null;
    avgNap: string | null;
    avgBedtime: string | null;
    avgWakings: number | null;
    prevAvgNight: string | null;
    prevAvgWakings: number | null;
    avgNapMinutes: number | null;
  };
}

export const RED_FLAG = /(열이|고열|숨|호흡|경련|파랗|청색|토해|구토|처져|처짐|축\s?늘어|의식|무호흡|응급|다쳤|떨어졌)/;

export const SAFETY_NOTE =
  "AI 수면 코치는 육아 의사결정을 돕는 생활 코칭이며 의료적 진단이 아니에요. 아기의 건강이 걱정되면 소아청소년과 전문의와 상담하세요.";

/** What the coach covers — shown on the coach screen and in the out-of-scope reply. */
export const COACH_SCOPE = [
  "다음 낮잠·밤잠 시간 추천",
  "낮잠이 짧거나 밤에 자주 깨는 이유 살펴보기",
  "월령별 수면 변화와 낮잠 횟수 전환",
  "취침 루틴과 안전한 수면 환경",
  "이번 주 수면 패턴 요약",
  "지친 보호자 마음 다독이기",
];

/** Exhaustion / self-blame in the caregiver's words. */
export const CAREGIVER_STRAIN = /(힘들|지쳐|지친|지침|버겁|우울|눈물|울고\s?싶|자책|내\s?탓|제\s?탓|잘못\s?(하|했)|못하겠|한계|멘붕|피곤해\s?죽|잠을\s?못\s?자서)/;

export const CAREGIVER_COMFORT =
  "🤍 많이 지치셨죠. 아기 잠은 원래 들쭉날쭉해서, 잘 안 되는 날이 있는 건 보호자님 탓이 아니에요. 오늘 할 수 있는 작은 것 하나만 해도 충분해요.";

export const CAREGIVER_SUPPORT_NOTE =
  "마음이 힘든 날이 길게 이어지면 혼자 견디지 말고 가족이나 전문가에게 도움을 요청해 주세요. 정신건강 위기상담 전화 1577-0199에서도 이야기를 들어줘요.";

export const SCOPE_MESSAGE = [
  "저는 우리 아기 수면을 돕는 AI 수면 코치라서, 이 질문에는 정확하게 답하기 어려워요.",
  "",
  "💤 이런 내용을 코칭해 드릴 수 있어요",
  ...COACH_SCOPE.map((s) => `· ${s}`),
  "",
  "수유·이유식·발달·건강처럼 수면 밖의 육아 질문은 소아청소년과나 육아 상담 기관에 확인해 주세요. 밤중 수유나 이앓이처럼 잠과 이어진 고민이라면 편하게 물어봐 주세요.",
].join("\n");

const SLEEP_WORDS = /(잠|재우|재워|재울|수면|깨|깬|졸|잤|자요|자는|자다|자고|취침|기상|일어나|일어났|루틴|백색소음|자장가|밤중|새벽|자기\s?전|웨이크|wake)/i;
const OFF_TOPIC_WORDS =
  /(이유식|분유|수유량|모유량|젖병|배변|변비|설사|대변|소변|응가|기저귀\s?발진|발진|아토피|예방\s?접종|접종|백신|몸무게|체중|키가|성장\s?곡선|놀이|장난감|그림책\s?추천|언어|말하기|옹알이|걸음마|걷기|기어|뒤집기\s?연습|치아|양치|목욕\s?온도|어린이집\s?적응|훈육|떼쓰|간식|반찬|우유)/;

/** True when the question is clearly about parenting topics other than sleep. */
export function isOffTopic(question: string) {
  return OFF_TOPIC_WORDS.test(question) && !SLEEP_WORDS.test(question);
}

export const SUGGESTED_QUESTIONS = [
  "다음 낮잠은 언제 재우는 게 좋아?",
  "오늘 밤은 몇 시쯤 재울까?",
  "오늘 왜 이렇게 낮잠을 짧게 잤을까?",
  "요즘 밤에 자주 깨.",
  "이번 주 수면 패턴을 요약해줘",
];

function guideLines(gs: Guide[]) {
  if (!gs.length) return "";
  return "\n\n📚 함께 보면 좋은 가이드\n" + gs.map((g) => `· ${g.title} — ${g.summary}`).join("\n");
}

/**
 * Deterministic coach used when no LLM is configured (or it fails).
 * Separates "facts from your records" from "general information", never diagnoses.
 */
export function ruleCoachAnswer(question: string, ctx: CoachContext): string {
  const q = question.replace(/\s/g, "");
  const name = ctx.baby.nickname;
  const guides = searchGuides(question, ctx.baby.ageMonths, 2);

  if (RED_FLAG.test(question)) {
    return [
      "말씀하신 내용은 수면 패턴보다 건강과 관련된 신호일 수 있어요.",
      "숨쉬기 힘들어 보이거나 입술이 파래지는 등 호흡이 걱정되면 지체하지 말고 **119** 또는 가까운 응급실에 연락하세요.",
      "열이 나거나 평소와 달리 축 처지는 경우에도 수면 앱보다 의료진의 판단이 먼저예요. 소아청소년과 진료를 권해요.",
      "",
      SAFETY_NOTE,
    ].join("\n");
  }

  if (isOffTopic(question)) return SCOPE_MESSAGE;

  const facts: string[] = [];
  const info: string[] = [];

  if (/(다음낮잠|낮잠은언제|언제재|몇시에재|다음잠|낮잠언제)/.test(q) && !/밤/.test(q)) {
    if (ctx.prediction.next) facts.push(`지금 ${name}는 "${ctx.state}" 상태이고, 다음 예상은 **${ctx.prediction.next}**이에요.`);
    facts.push(ctx.prediction.reason);
    if (ctx.today.lastNapMinutes != null) facts.push(`오늘 마지막 낮잠은 ${fmtDuration(ctx.today.lastNapMinutes)}였어요.`);
    info.push(`${ctx.baby.ageGroup} 아기의 깨어 있는 시간은 보통 ${ctx.norms.wakeWindow} 정도예요.`);
    info.push("예상 시간 15분 전쯤부터 조명을 낮추고 차분한 놀이로 바꿔 보세요. 하품·눈 비비기 같은 졸림 신호가 먼저 보이면 그때 재워도 좋아요.");
  } else if (/(밤잠|오늘밤|몇시쯤재울|취침|자는시간)/.test(q)) {
    const night = ctx.prediction.schedule.find((s) => s.startsWith("밤잠")) ?? (ctx.prediction.next?.startsWith("밤잠") ? ctx.prediction.next : null);
    if (night) facts.push(`오늘 기록 기준으로 예상 밤잠은 **${night.replace("밤잠 ", "")}**이에요.`);
    facts.push(`오늘 낮잠은 ${ctx.today.napCount}회, 총 ${fmtDuration(ctx.today.napMinutes)}였어요.`);
    if (ctx.week.avgBedtime) facts.push(`최근 7일 평균 밤잠 시작은 ${ctx.week.avgBedtime}였어요.`);
    info.push("밤잠 30분 전쯤 수면 루틴을 시작하면 자연스럽게 잠들 준비를 할 수 있어요.");
    info.push("낮잠이 짧았거나 적었던 날은 평소보다 조금 일찍 재우는 것이 도움이 되는 경우가 많아요.");
  } else if (/짧/.test(q) && /낮잠|잠/.test(q)) {
    if (ctx.today.lastNapMinutes != null) facts.push(`오늘 마지막 낮잠은 ${fmtDuration(ctx.today.lastNapMinutes)}였어요.`);
    if (ctx.week.avgNapMinutes != null) facts.push(`최근 낮잠 한 번의 평균 길이는 약 ${fmtDuration(ctx.week.avgNapMinutes)}예요.`);
    info.push("한 번의 수면 주기는 30~45분 정도라, 주기가 끝날 때 깨는 짧은 낮잠은 흔한 일이에요.");
    info.push("너무 오래 깨어 있었거나 반대로 덜 피곤했을 때, 주변이 밝거나 소리가 클 때도 짧아질 수 있어요.");
    info.push("다음 깨어 있는 시간을 15분 정도 짧게 잡아보세요. 앱 예측도 짧은 낮잠을 반영해 조금 당겨서 알려드려요.");
  } else if (/(밤에|밤중|새벽|자주깨|깨요|깨어|각성)/.test(q)) {
    if (ctx.week.avgWakings != null) facts.push(`최근 7일 하룻밤 평균 각성은 ${ctx.week.avgWakings}회예요.`);
    if (ctx.week.prevAvgWakings != null) facts.push(`그 이전 7일은 평균 ${ctx.week.prevAvgWakings}회였어요.`);
    if (ctx.week.avgNight) facts.push(`평균 밤잠(깨어 있던 시간 제외)은 ${ctx.week.avgNight}이에요.`);
    info.push("이 시기에는 운동 발달, 이앓이, 분리불안 등으로 밤중 각성이 일시적으로 늘 수 있어요.");
    info.push("깼을 때는 조명을 어둡게 유지하고 짧고 차분하게 반응해 주세요. 매번 같은 방식으로 반응하면 아기가 예측하기 쉬워요.");
  } else if (/(요약|이번주|주간|패턴|리포트)/.test(q)) {
    if (ctx.week.daysWithData < 3) facts.push(`최근 7일 중 ${ctx.week.daysWithData}일이 기록되어 있어요. 3일 이상 기록하면 패턴을 더 잘 볼 수 있어요.`);
    else {
      if (ctx.week.avgNight) facts.push(`평균 밤잠 ${ctx.week.avgNight}${ctx.week.prevAvgNight ? ` (지난주 ${ctx.week.prevAvgNight})` : ""}`);
      if (ctx.week.avgNap) facts.push(`하루 평균 낮잠 ${ctx.week.avgNap}`);
      if (ctx.week.avgBedtime) facts.push(`평균 밤잠 시작 ${ctx.week.avgBedtime}`);
      if (ctx.week.avgWakings != null) facts.push(`하룻밤 평균 각성 ${ctx.week.avgWakings}회`);
    }
    info.push(`${ctx.baby.ageGroup} 아기의 하루 총 수면은 일반적으로 ${ctx.norms.totalSleep} 범위예요. 개인차가 커서 범위 밖이라고 문제가 있다는 뜻은 아니에요.`);
  } else if (/(개월|월령|변화|발달|퇴행)/.test(q)) {
    info.push(`${ctx.baby.ageGroup} 아기는 보통 낮잠 ${ctx.norms.naps}회, 깨어 있는 시간 ${ctx.norms.wakeWindow}, 하루 총 수면 ${ctx.norms.totalSleep} 정도예요.`);
    const rec = recommendedGuides(ctx.baby.ageMonths, 2);
    rec.forEach((g) => info.push(`${g.title}: ${g.summary}`));
  } else {
    facts.push(`지금 ${name}는 "${ctx.state}" 상태예요.`);
    if (ctx.today.events.length) facts.push(`오늘 기록 ${ctx.today.events.length}건, 낮잠 ${ctx.today.napCount}회(총 ${fmtDuration(ctx.today.napMinutes)}).`);
    if (ctx.prediction.next) facts.push(`다음 예상: ${ctx.prediction.next}`);
    info.push(`이런 내용을 물어보시면 기록을 바탕으로 답해 드릴게요: ${COACH_SCOPE.join(", ")}.`);
  }

  const parts: string[] = [];
  const strained = CAREGIVER_STRAIN.test(question);
  if (strained) parts.push(CAREGIVER_COMFORT);
  if (facts.length) parts.push("📋 기록에서 확인된 내용\n" + facts.map((f) => `· ${f}`).join("\n"));
  if (info.length) parts.push("💡 일반적인 정보\n" + info.map((f) => `· ${f}`).join("\n"));
  if (strained && /(우울|눈물|울고\s?싶|못하겠|한계)/.test(question)) parts.push(CAREGIVER_SUPPORT_NOTE);
  return parts.join("\n\n") + guideLines(guides);
}
