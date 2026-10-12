import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { useMiniPlayerShown } from "./SoundProvider";

export interface ToastAction {
  label: string;
  onClick: () => void;
}
export interface ToastInput {
  message: string;
  detail?: string;
  icon?: string;
  actions?: ToastAction[];
  durationMs?: number;
}

const Ctx = createContext<(t: ToastInput) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastInput & { key: number }) | null>(null);
  const timer = useRef<number | null>(null);
  const miniPlayer = useMiniPlayerShown();

  const show = useCallback((t: ToastInput) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...t, key: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), t.durationMs ?? 6000);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div className={`pointer-events-none fixed inset-x-0 ${miniPlayer ? "bottom-[156px]" : "bottom-[92px]"} z-50 flex justify-center px-4`} aria-live="polite">
        {toast && (
          <div key={toast.key} className="animate-rise pointer-events-auto w-full max-w-[408px] rounded-3xl bg-night-indigo px-4 py-3 text-white shadow-lift">
            <div className="flex items-start gap-3">
              <Icon name={toast.icon ?? "check_circle"} className="mt-0.5 text-butter" fill />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug">{toast.message}</p>
                {toast.detail && <p className="mt-0.5 text-[13px] leading-snug text-white/75 whitespace-pre-line">{toast.detail}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {toast.actions?.map((a) => (
                  <button
                    key={a.label}
                    className="press rounded-full px-3 py-1.5 text-[13px] font-semibold text-prediction hover:bg-white/10"
                    onClick={() => {
                      a.onClick();
                      setToast(null);
                    }}
                  >
                    {a.label}
                  </button>
                ))}
                <button aria-label="닫기" className="press rounded-full p-1 text-white/60" onClick={() => setToast(null)}>
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
