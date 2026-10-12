import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { Header } from "../components/Layout";
import { useMiniPlayerShown } from "../components/SoundProvider";
import { Icon } from "../components/Icon";
import { useEventSheet } from "../components/EventSheet";
import { SleepBand, Timeline, buildTimeline } from "../components/Timeline";
import { buildSessions } from "../lib/events";
import { ageNorm, predict } from "../lib/predict";
import { dayStats, diffLabel, weekSummary, weeklyInsights } from "../lib/stats";
import { addDays, ageInMonths, fmtDateLabel, fmtDuration, fmtShortDate, minToHm, sameDay, startOfDay } from "../lib/time";

export default function Sleep() {
  const [tab, setTab] = useState<"day" | "week">("day");
  return (
    <>
      <Header subtitle="수면 타임라인 · 주간 리포트" />
      <main className="px-5">
        <div className="mb-4 grid grid-cols-2 rounded-full bg-surface-container p-1" role="tablist">
          {(
            [
              ["day", "일간 기록"],
              ["week", "주간 리포트"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`press rounded-full py-2.5 text-[14px] font-semibold ${tab === k ? "bg-card text-primary shadow-soft" : "text-ink-variant"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {tab === "day" ? <DayView /> : <WeekView />}
      </main>
    </>
  );
}

function DayView() {
  const { baby, events, now } = useStore();
  const miniPlayer = useMiniPlayerShown();
  const openSheet = useEventSheet();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const isToday = sameDay(day, now);
  const sessions = useMemo(() => buildSessions(events, now), [events, now]);
  const stats = dayStats(events, day, sessions, now);
  const prediction = useMemo(() => (isToday ? predict(baby!, events, now) : null), [isToday, baby, events, now]);
  const items = buildTimeline(day, events, sessions, prediction?.schedule ?? []);
  const norm = ageNorm(ageInMonths(baby!.birthDate, day));
  const inRange = stats.totalMin >= norm.totalSleep[0] * 60 * 0.85;

  const memo = (() => {
    if (!stats.hasData) return "이 날의 기록이 없어요. 기록이 쌓이면 패턴을 읽어 드릴게요.";
    const parts: string[] = [];
    if (stats.napCount) parts.push(`낮잠 ${stats.napCount}회, 총 ${fmtDuration(stats.napMin)}를 잤어요.`);
    if (stats.nightMin) parts.push(`지난밤에는 ${fmtDuration(stats.nightMin)} 잤고${stats.nightWakings ? ` 밤중에 ${stats.nightWakings}번 깼어요.` : " 밤중에 깨지 않았어요."}`);
    if (stats.lastNapEndMin != null && stats.lastNapEndMin > 17 * 60 + 30) parts.push("마지막 낮잠이 17:30 이후에 끝났어요. 이런 날은 밤잠이 조금 늦어질 수 있어요.");
    if (isToday && prediction?.next) parts.push(prediction.reason);
    return parts.join(" ");
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-full bg-card px-2 py-1.5 shadow-soft">
        <button aria-label="이전 날" onClick={() => setDay(addDays(day, -1))} className="press rounded-full p-2 text-ink-variant">
          <Icon name="chevron_left" />
        </button>
        <span className="flex items-center gap-2 text-[16px] font-bold text-ink">
          <Icon name="calendar_today" size={20} className="text-primary" />
          {fmtDateLabel(day, now)}
        </span>
        <button aria-label="다음 날" disabled={isToday} onClick={() => setDay(addDays(day, 1))} className="press rounded-full p-2 text-ink-variant disabled:opacity-30">
          <Icon name="chevron_right" />
        </button>
      </div>

      <section className="rounded-[2rem] bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-ink-variant">총 수면 시간</p>
            <p className="tabular text-[32px] font-bold text-ink">{fmtDuration(stats.totalMin)}</p>
          </div>
          {stats.nightMin > 0 && (
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${inRange ? "bg-sage-light text-sage-ink" : "bg-butter-light text-butter-ink"}`}>
              <Icon name={inRange ? "check_circle" : "info"} size={16} />
              {inRange ? "월령 범위 안" : "평소보다 적어요"}
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat bg="bg-butter-light" icon="😴" label="낮잠" value={fmtDuration(stats.napMin)} sub={`${stats.napCount}회`} />
          <Stat bg="bg-muted-purple" icon="🌙" label="지난밤" value={fmtDuration(stats.nightMin)} sub={stats.bedtimeMin != null ? `오늘 취침 ${minToHm(stats.bedtimeMin)}` : "취침 기록 전"} />
          <Stat bg="bg-surface-low" icon="🌃" label="밤중 각성" value={`${stats.nightWakings}회`} sub={stats.wakeMin != null ? `기상 ${minToHm(stats.wakeMin)}` : "기상 기록 없음"} />
        </div>
      </section>

      <section className="rounded-[2rem] bg-card p-5 shadow-soft">
        <h3 className="mb-3 flex items-center gap-2 text-[16px] font-bold text-ink">
          <Icon name="ssid_chart" className="text-primary" /> 24시간 수면 밴드
        </h3>
        <SleepBand day={day} sessions={sessions} events={events} predictions={prediction?.schedule ?? []} now={now} />
      </section>

      <section className="flex gap-3 rounded-[2rem] bg-gradient-to-br from-muted-purple to-butter-light p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
          <Icon name="auto_awesome" fill />
        </span>
        <div>
          <p className="text-[15px] font-bold text-ink">AI 수면 코치 메모</p>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-variant">{memo}</p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[20px] font-bold text-ink">상세 타임라인</h3>
          <span className="text-[12px] text-ink-variant">항목을 눌러 시간 수정</span>
        </div>
        <Timeline items={items} onEdit={(id) => openSheet({ eventId: id })} now={now} />
      </section>

      <button
        onClick={() => openSheet({ time: isToday ? new Date() : new Date(day.getTime() + 12 * 3600_000) })}
        className={`press fixed ${miniPlayer ? "bottom-[160px]" : "bottom-[100px]"} right-[max(1.25rem,calc(50vw-200px))] z-30 flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-[15px] font-semibold text-on-primary shadow-lift`}
      >
        <Icon name="add" /> 기록 추가
      </button>
    </div>
  );
}

function Stat({ bg, icon, label, value, sub }: { bg: string; icon: string; label: string; value: string; sub: string }) {
  return (
    <div className={`rounded-2xl p-3 ${bg}`}>
      <p className="text-[12px] font-semibold text-ink-variant">
        {icon} {label}
      </p>
      <p className="mt-1 tabular text-[16px] font-bold leading-tight text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-variant">{sub}</p>
    </div>
  );
}

function WeekView() {
  const { baby, events, now } = useStore();
  const navigate = useNavigate();
  const cur = useMemo(() => weekSummary(events, now, 0), [events, now]);
  const prev = useMemo(() => weekSummary(events, now, 1), [events, now]);
  const insights = weeklyInsights(cur, prev, baby!.nickname);
  const maxMin = Math.max(14 * 60, ...cur.days.map((d) => d.totalMin));

  const metric = (label: string, c: number | null, p: number | null, fmt: (n: number) => string) => {
    const d = diffLabel(c, p);
    return (
      <div className="rounded-2xl bg-surface-low p-3">
        <p className="text-[12px] text-ink-variant">{label}</p>
        <p className="tabular text-[17px] font-bold text-ink">{c == null ? "–" : fmt(c)}</p>
        {d && <p className={`text-[11px] font-semibold ${d.positive ? "text-sage-ink" : "text-error"}`}>지난주 대비 {d.text}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] bg-night-indigo p-5 text-white shadow-soft">
        <p className="text-[13px] text-white/70">
          최근 7일 ({fmtShortDate(cur.days[0].date)} ~ {fmtShortDate(cur.days[6].date)}) · 기록 {cur.daysWithData}일
        </p>
        <p className="mt-2 text-[14px] text-white/80">이번 주 평균 밤잠</p>
        <p className="tabular text-[34px] font-bold">{cur.avgNight == null ? "–" : fmtDuration(cur.avgNight)}</p>
        {cur.avgNight != null && prev.avgNight != null && (
          <p className="mt-1 inline-flex rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-butter">지난주 대비 {diffLabel(cur.avgNight, prev.avgNight)!.text}</p>
        )}
        {/* bars */}
        <div className="mt-5 flex justify-between gap-2" role="img" aria-label="최근 7일 일별 총 수면">
          {cur.days.map((d) => (
            <div key={d.date.toISOString()} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-[120px] w-full flex-col justify-end overflow-hidden rounded-xl bg-white/10" title={`총 ${fmtDuration(d.totalMin)}`}>
                <div className="w-full bg-butter" style={{ height: (d.napMin / maxMin) * 120 }} />
                <div className="w-full bg-prediction" style={{ height: (d.nightMin / maxMin) * 120 }} />
              </div>
              <span className="tabular text-[10px] text-white/80">{d.totalMin ? (d.totalMin / 60).toFixed(1) : "–"}</span>
              <span className="text-[10px] text-white/60">{fmtShortDate(d.date).split("(")[1]?.replace(")", "")}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-3 text-[11px] text-white/70">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-prediction" />밤잠
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-butter" />낮잠
          </span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 rounded-[2rem] bg-card p-4 shadow-soft">
        {metric("평균 총 수면", cur.avgTotal, prev.avgTotal, fmtDuration)}
        {metric("평균 낮잠", cur.avgNap, prev.avgNap, fmtDuration)}
        {metric("평균 취침", cur.avgBedtime, null, minToHm)}
        {metric("평균 기상", cur.avgWake, null, minToHm)}
        <div className="rounded-2xl bg-surface-low p-3">
          <p className="text-[12px] text-ink-variant">낮잠 횟수</p>
          <p className="tabular text-[17px] font-bold text-ink">{cur.avgNapCount == null ? "–" : `하루 ${cur.avgNapCount.toFixed(1)}회`}</p>
        </div>
        <div className="rounded-2xl bg-surface-low p-3">
          <p className="text-[12px] text-ink-variant">야간 각성</p>
          <p className="tabular text-[17px] font-bold text-ink">{cur.avgWakings == null ? "–" : `평균 ${cur.avgWakings.toFixed(1)}회`}</p>
          {prev.avgWakings != null && cur.avgWakings != null && <p className="text-[11px] text-ink-variant">지난주 {prev.avgWakings.toFixed(1)}회</p>}
        </div>
      </section>

      <section className="rounded-[2rem] bg-card p-5 shadow-soft">
        <h3 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-ink">
          <Icon name="auto_awesome" className="text-primary" fill /> AI Insight
        </h3>
        <ul className="space-y-3">
          {insights.map((ins) => (
            <li key={ins.title} className="flex gap-3 rounded-2xl bg-surface-low p-3">
              <Icon name={ins.icon} className="mt-0.5 text-primary" />
              <div>
                <p className="text-[14px] font-bold text-ink">{ins.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-variant">{ins.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <button
          onClick={() => navigate("/coach?q=" + encodeURIComponent("이번 주 수면 패턴을 요약해줘"))}
          className="press mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-muted-purple py-3 text-[14px] font-semibold text-primary"
        >
          <Icon name="forum" /> AI 코치에게 자세히 물어보기
        </button>
        <p className="mt-3 text-center text-[11px] text-ink-variant">함께 나타난 경향을 보여줄 뿐, 원인이나 진단을 뜻하지 않아요.</p>
      </section>
    </div>
  );
}
