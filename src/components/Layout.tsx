import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { useStore } from "../store";
import { useSound } from "./SoundProvider";
import { soundById } from "../data/sounds";
import { ageLabel } from "../lib/time";
import { Icon } from "./Icon";
import { NotificationWatcher } from "./NotificationWatcher";

const TABS = [
  { to: "/", label: "오늘", icon: "home" },
  { to: "/sleep", label: "기록", icon: "calendar_month" },
  { to: "/sounds", label: "소리", icon: "dark_mode" },
  { to: "/guide", label: "가이드", icon: "menu_book" },
  { to: "/coach", label: "AI 코치", icon: "auto_awesome" },
];

export function Layout() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[440px] bg-surface pb-28">
      <Outlet />
      <MiniPlayer />
      <BottomNav />
      <NotificationWatcher />
    </div>
  );
}

export function Header({ subtitle, right }: { subtitle?: string; right?: React.ReactNode }) {
  const { baby, settings, updateSettings } = useStore();
  if (!baby) return null;
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 bg-surface/90 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
      <Link to="/profile" aria-label="아기 정보와 설정" className="press relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-butter-light text-2xl ring-2 ring-butter">
        {baby.gender === "M" ? "👦" : baby.gender === "F" ? "👧" : "👶"}
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-sage" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[20px] font-bold text-ink">{baby.nickname}</h1>
          <span className="shrink-0 rounded-full bg-muted-purple px-2 py-0.5 text-[11px] font-semibold text-primary">{ageLabel(baby.birthDate)}</span>
        </div>
        {subtitle && <p className="truncate text-[13px] text-ink-variant">{subtitle}</p>}
      </div>
      {right}
      <button
        aria-label={settings.nightMode ? "주간 모드로 전환" : "야간 모드로 전환"}
        onClick={() => updateSettings({ nightMode: !settings.nightMode })}
        className="press rounded-full p-2 text-ink-variant hover:bg-surface-container"
      >
        <Icon name={settings.nightMode ? "light_mode" : "bedtime"} />
      </button>
      <Link to="/profile" aria-label="알림 및 설정" className="press rounded-full p-2 text-ink-variant hover:bg-surface-container">
        <Icon name="settings" />
      </Link>
    </header>
  );
}

function BottomNav() {
  return (
    <nav aria-label="주요 메뉴" className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[440px] rounded-t-[2rem] bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_24px_-10px_rgb(30_27_75/0.15)] backdrop-blur-md">
      <ul className="grid grid-cols-5">
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink to={t.to} end={t.to === "/"} className="press flex flex-col items-center gap-0.5 py-1">
              {({ isActive }) => (
                <>
                  <span className={`flex h-9 w-14 items-center justify-center rounded-full ${isActive ? "bg-muted-purple text-primary" : "text-ink-variant"}`}>
                    <Icon name={t.icon} fill={isActive} />
                  </span>
                  <span className={`text-[12px] ${isActive ? "font-bold text-primary" : "font-medium text-ink-variant"}`}>{t.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MiniPlayer() {
  const { current, playing, toggle, stop } = useSound();
  const loc = useLocation();
  if (!current || !playing || loc.pathname.replace(/\/$/, "") === "/sounds") return null;
  const s = soundById(current);
  return (
    <div className="fixed inset-x-0 bottom-[84px] z-30 mx-auto w-full max-w-[440px] px-4">
      <div className="flex items-center gap-3 rounded-full bg-night-indigo py-2 pl-4 pr-2 text-white shadow-lift">
        <div className="flex h-5 items-end gap-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="eq-bar w-1 rounded-full bg-prediction" style={{ height: 18, animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <Link to="/sounds" className="min-w-0 flex-1 truncate text-[14px] font-semibold">
          {s?.title} 재생 중
        </Link>
        <button aria-label="일시정지" onClick={() => toggle()} className="press rounded-full bg-white/15 p-2">
          <Icon name="pause" fill />
        </button>
        <button aria-label="정지" onClick={stop} className="press rounded-full p-2 text-white/70">
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}
