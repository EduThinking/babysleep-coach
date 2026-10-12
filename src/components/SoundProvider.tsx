import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { soundEngine } from "../lib/audio";

interface SoundState {
  current: string | null;
  playing: boolean;
  volume: number;
  timerEndsAt: number | null;
  timerMinutes: number | null;
  play: (id: string) => void;
  toggle: (id?: string) => void;
  stop: () => void;
  setVolume: (v: number) => void;
  setTimer: (minutes: number | null) => void;
}

const Ctx = createContext<SoundState | null>(null);

function initialVolume() {
  try {
    const raw = localStorage.getItem("baby-sleep-coach:v1");
    const v = raw ? JSON.parse(raw)?.settings?.defaultVolume : undefined;
    return typeof v === "number" ? v : 0.45;
  } catch {
    return 0.45;
  }
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVol] = useState(initialVolume);
  const [timerMinutes, setTimerMinutes] = useState<number | null>(60);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => soundEngine.setVolume(volume), [volume]);

  const armTimer = useCallback((minutes: number | null) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (!minutes) {
      setTimerEndsAt(null);
      return;
    }
    const ends = Date.now() + minutes * 60_000;
    setTimerEndsAt(ends);
    // start fading 30s before the end
    timerRef.current = window.setTimeout(() => {
      soundEngine.stop(30);
      setPlaying(false);
      setTimerEndsAt(null);
    }, Math.max(0, minutes * 60_000 - 30_000));
  }, []);

  const play = useCallback(
    (id: string) => {
      soundEngine.play(id);
      setCurrent(id);
      setPlaying(true);
      armTimer(timerMinutes);
    },
    [armTimer, timerMinutes],
  );

  const stop = useCallback(() => {
    soundEngine.stop();
    setPlaying(false);
    armTimer(null);
  }, [armTimer]);

  const value = useMemo<SoundState>(
    () => ({
      current,
      playing,
      volume,
      timerEndsAt,
      timerMinutes,
      play,
      stop,
      toggle: (id) => {
        const target = id ?? current;
        if (!target) return;
        if (playing && target === current) stop();
        else play(target);
      },
      setVolume: setVol,
      setTimer: (m) => {
        setTimerMinutes(m);
        if (playing) armTimer(m);
      },
    }),
    [current, playing, volume, timerEndsAt, timerMinutes, play, stop, armTimer],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSound() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSound must be used inside SoundProvider");
  return s;
}

/**
 * True while the floating mini player is on screen (a sound is playing and we are not on the
 * sounds page). Bottom-anchored UI uses this to sit above the player instead of under it.
 */
export function useMiniPlayerShown() {
  const { current, playing } = useSound();
  const { pathname } = useLocation();
  return !!current && playing && pathname.replace(/\/$/, "") !== "/sounds";
}
