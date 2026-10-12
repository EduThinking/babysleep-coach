import { useEffect, useState } from "react";
import { useStore } from "../store";
import { useSound } from "../components/SoundProvider";
import { Header } from "../components/Layout";
import { Icon } from "../components/Icon";
import { SOUNDS, SOUND_CATEGORIES, soundById, type SoundCategory } from "../data/sounds";

const TIMERS: [number | null, string][] = [
  [30, "30분"],
  [60, "1시간"],
  [120, "2시간"],
  [null, "계속 재생"],
];

export default function Sounds() {
  const { settings, updateSettings } = useStore();
  const snd = useSound();
  const [cat, setCat] = useState<SoundCategory | "FAV">(() => (snd.current ? soundById(snd.current)?.category ?? "NOISE" : "NOISE"));
  const selected = soundById(snd.current ?? "pink")!;
  const list = cat === "FAV" ? SOUNDS.filter((s) => settings.favorites.includes(s.id)) : SOUNDS.filter((s) => s.category === cat);
  const fav = settings.favorites.includes(selected.id);
  const [, force] = useState(0);

  // tick the remaining timer label
  useEffect(() => {
    if (!snd.timerEndsAt) return;
    const t = setInterval(() => force((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, [snd.timerEndsAt]);

  const toggleFav = (id: string) =>
    updateSettings({ favorites: settings.favorites.includes(id) ? settings.favorites.filter((f) => f !== id) : [...settings.favorites, id] });

  const isPlaying = snd.playing && snd.current === selected.id;
  const remaining = snd.timerEndsAt ? Math.max(0, Math.round((snd.timerEndsAt - Date.now()) / 60_000)) : null;
  const idx = SOUNDS.findIndex((s) => s.id === selected.id);

  return (
    <>
      <Header subtitle="수면 환경 사운드 케어" right={isPlaying ? <span className="rounded-full bg-sage-light px-2.5 py-1 text-[11px] font-bold text-sage-ink">재생 중</span> : null} />
      <main className="space-y-5 px-5">
        <h2 className="text-[26px] font-bold leading-[34px] text-ink">편안한 잠을 위한 수면음</h2>

        <div className="scroll-x -mx-5 flex gap-2 overflow-x-auto px-5" role="tablist">
          {[...SOUND_CATEGORIES, { key: "FAV" as const, label: "즐겨찾기", icon: "favorite" }].map((c) => (
            <button
              key={c.key}
              role="tab"
              aria-selected={cat === c.key}
              onClick={() => setCat(c.key)}
              className={`press flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-semibold ${
                cat === c.key ? "bg-primary text-on-primary" : "bg-card text-ink-variant shadow-soft"
              }`}
            >
              <Icon name={c.icon} size={18} fill={cat === c.key} /> {c.label}
            </button>
          ))}
        </div>

        {/* Now playing */}
        <section className="rounded-[2rem] bg-night-indigo p-5 text-white shadow-lift">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <Icon name={selected.icon} size={30} className="text-prediction" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[18px] font-bold">{selected.title}</p>
              <p className="truncate text-[13px] text-white/70">{selected.subtitle}</p>
            </div>
            <div className="flex h-8 items-end gap-1" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full bg-white/80 ${isPlaying ? "eq-bar" : ""}`}
                  style={{ height: isPlaying ? 28 : 8 + (i % 3) * 6, animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1 text-white/80">
                <Icon name="volume_up" size={18} /> 볼륨 <span className="text-white/50">(아기 귀 기준 50dB 이하 권장)</span>
              </span>
              <span className="tabular font-bold">{Math.round(snd.volume * 100)}%</span>
            </div>
            <input
              aria-label="볼륨"
              type="range"
              min={0}
              max={100}
              value={Math.round(snd.volume * 100)}
              onChange={(e) => snd.setVolume(Number(e.target.value) / 100)}
              className="slider w-full"
              style={{ ["--val" as any]: `${Math.round(snd.volume * 100)}%` }}
            />
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button aria-label="이전 소리" onClick={() => snd.play(SOUNDS[(idx - 1 + SOUNDS.length) % SOUNDS.length].id)} className="press rounded-full p-2 text-white/80">
              <Icon name="skip_previous" size={28} fill />
            </button>
            <button
              aria-label={isPlaying ? "일시정지" : "재생"}
              onClick={() => snd.toggle(selected.id)}
              className="press flex h-16 w-16 items-center justify-center rounded-full bg-white text-night-indigo shadow-lift"
            >
              <Icon name={isPlaying ? "pause" : "play_arrow"} size={36} fill />
            </button>
            <button aria-label="다음 소리" onClick={() => snd.play(SOUNDS[(idx + 1) % SOUNDS.length].id)} className="press rounded-full p-2 text-white/80">
              <Icon name="skip_next" size={28} fill />
            </button>
            <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-2 text-[12px] font-semibold">
              <Icon name="repeat" size={16} /> 무한 반복
            </span>
            <button aria-label={fav ? "즐겨찾기 해제" : "즐겨찾기"} onClick={() => toggleFav(selected.id)} className="press rounded-full p-2">
              <Icon name="favorite" fill={fav} className={fav ? "text-alert" : "text-white/70"} />
            </button>
          </div>
        </section>

        {/* Timer */}
        <section className="rounded-[2rem] bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[16px] font-bold text-ink">
              <Icon name="timer" className="text-primary" /> 수면 타이머
            </h3>
            <span className="text-[12px] text-ink-variant">{remaining != null && isPlaying ? `약 ${remaining}분 후 서서히 꺼져요` : "끝날 때 30초간 페이드아웃"}</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {TIMERS.map(([m, l]) => (
              <button
                key={l}
                onClick={() => snd.setTimer(m)}
                className={`press rounded-full py-2.5 text-[13px] font-semibold ${snd.timerMinutes === m ? "bg-primary text-on-primary" : "bg-surface-low text-ink-variant"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </section>

        {/* List */}
        <section>
          <h3 className="mb-3 text-[18px] font-bold text-ink">{cat === "FAV" ? "즐겨찾는 소리" : "사운드 프리셋"}</h3>
          {list.length === 0 ? (
            <p className="rounded-3xl bg-surface-low p-6 text-center text-[14px] text-ink-variant">하트를 눌러 자주 쓰는 소리를 모아보세요.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {list.map((s) => {
                const active = snd.current === s.id && snd.playing;
                return (
                  <button
                    key={s.id}
                    onClick={() => snd.toggle(s.id)}
                    className={`press relative flex flex-col items-start gap-2 rounded-3xl p-4 text-left shadow-soft ${active ? "bg-muted-purple ring-2 ring-primary" : "bg-card"}`}
                  >
                    <span className={`flex h-11 w-11 items-center justify-center rounded-full ${active ? "bg-primary text-on-primary" : "bg-muted-purple text-primary"}`}>
                      <Icon name={active ? "pause" : s.icon} fill={active} />
                    </span>
                    <span>
                      <span className="block text-[15px] font-bold text-ink">{s.title}</span>
                      <span className="block text-[12px] text-ink-variant">{s.subtitle}</span>
                    </span>
                    {settings.favorites.includes(s.id) && <Icon name="favorite" size={16} fill className="absolute right-4 top-4 text-alert" />}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <p className="flex gap-2 rounded-3xl bg-sage-light p-4 text-[13px] leading-relaxed text-sage-ink">
          <Icon name="lightbulb" size={18} className="shrink-0" />
          소리 기기는 아기 침대에서 1m 이상 떨어뜨리고, 너무 크지 않게 틀어주세요. 기본 소리는 앱에서 직접 만들어져 오프라인에서도 재생돼요.
        </p>
      </main>
    </>
  );
}
