import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../store";
import { Header } from "../components/Layout";
import { Icon } from "../components/Icon";
import { aiStatus, askCoach } from "../lib/api";
import { COACH_SCOPE, SAFETY_NOTE, SUGGESTED_QUESTIONS, buildCoachContext } from "../lib/coach";
import { fmtTime } from "../lib/time";

/** tiny formatter: **bold**, _italic line_, line breaks */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const italic = /^_.*_$/.test(line.trim());
        const body = italic ? line.trim().slice(1, -1) : line;
        const parts: ReactNode[] = body.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <b key={j} className="font-bold text-primary">
              {p.slice(2, -2)}
            </b>
          ) : (
            <Fragment key={j}>{p}</Fragment>
          ),
        );
        return (
          <span key={i} className={`block ${italic ? "mt-1 text-[12px] italic text-ink-variant" : ""} ${line.trim() === "" ? "h-2" : ""}`}>
            {parts}
          </span>
        );
      })}
    </>
  );
}

const SR: any = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

export default function Coach() {
  const { baby, events, chats, addChat, clearChats, now } = useStore();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [ai, setAi] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const sentQ = useRef<string | null>(null);
  const ctx = useMemo(() => buildCoachContext(baby!, events, now), [baby, events, now]);

  useEffect(() => {
    aiStatus().then((s) => setAi(s.ai));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chats.length, busy]);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    const history = chats.slice(-6).map((c) => ({ role: c.role, text: c.text }));
    addChat({ role: "user", text: question });
    setBusy(true);
    const res = await askCoach(question, buildCoachContext(baby!, events, new Date()), history);
    addChat({ role: "assistant", text: res.answer, source: res.source, sources: res.sources });
    setBusy(false);
  };

  // deep link: /coach?q=...
  useEffect(() => {
    const q = params.get("q");
    if (q && sentQ.current !== q) {
      sentQ.current = q;
      setParams({}, { replace: true });
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const dictate = () => {
    if (!SR) return;
    const rec = new SR();
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.onresult = (e: any) => setInput(Array.from(e.results as ArrayLike<any>).map((r: any) => r[0].transcript).join(""));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <>
      <Header
        subtitle={ai ? "실시간 수면 리듬 분석 중" : "기록 기반 수면 코치"}
        right={
          chats.length > 0 ? (
            <button aria-label="대화 지우기" onClick={clearChats} className="press rounded-full p-2 text-ink-variant hover:bg-surface-container">
              <Icon name="delete_sweep" />
            </button>
          ) : null
        }
      />
      <main className="flex min-h-[calc(100dvh-180px)] flex-col px-5">
        <section className="rounded-[2rem] bg-card p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-prediction text-white">
              <Icon name="auto_awesome" fill />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[16px] font-bold text-ink">
                AI 수면 코칭 브리핑
                <span className="rounded-full bg-muted-purple px-2 py-0.5 text-[10px] font-bold text-primary">{ai ? "AI 연결됨" : "기본 코치"}</span>
              </p>
              <p className="text-[13px] text-ink-variant">{baby!.nickname}의 기록과 검증된 수면 지식을 함께 봐요.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
            <span className="flex items-center gap-1 rounded-full bg-sage-light px-2.5 py-1 font-semibold text-sage-ink">
              <Icon name="check_circle" size={14} fill /> 오늘 {ctx.today.events.length}건 기록 반영
            </span>
            <span className="rounded-full bg-surface-low px-2.5 py-1 font-semibold text-ink-variant">{ctx.baby.ageGroup} 패턴</span>
            {ctx.prediction.next && <span className="rounded-full bg-muted-purple px-2.5 py-1 font-semibold text-primary">다음: {ctx.prediction.next}</span>}
          </div>
          <div className="mt-4 rounded-2xl bg-surface-low p-3">
            <p className="flex items-center gap-1 text-[13px] font-bold text-ink">
              <Icon name="bedtime" size={16} className="text-primary" /> 이런 내용을 코칭해 드려요
            </p>
            <ul className="mt-1.5 space-y-0.5 text-[13px] leading-relaxed text-ink-variant">
              {COACH_SCOPE.map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-[12px] text-ink-variant">수면 밖의 질문은 질병관리청·대한소아청소년과학회 등 공신력 있는 기관 자료에서 찾은 내용만 출처와 함께 알려드려요.</p>
          </div>
        </section>

        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1 text-[13px] font-semibold text-ink-variant">
            <Icon name="chat_bubble" size={16} /> 자주 묻는 질문
          </p>
          <div className="scroll-x -mx-5 flex gap-2 overflow-x-auto px-5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button key={q} onClick={() => void send(q)} className="press shrink-0 rounded-full bg-card px-3.5 py-2 text-[13px] font-medium text-ink shadow-soft">
                "{q}"
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex-1 space-y-4" aria-live="polite">
          {chats.length === 0 && !busy && (
            <div className="rounded-3xl bg-surface-low p-6 text-center text-[14px] leading-relaxed text-ink-variant">
              <Icon name="forum" size={32} className="mb-2 text-primary" />
              <p>
                "오늘 왜 낮잠을 짧게 잤을까?"처럼
                <br />
                편하게 물어보세요.
              </p>
            </div>
          )}
          {chats.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex flex-col items-end">
                <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-[15px] font-medium leading-relaxed text-on-primary">{m.text}</p>
                <span className="mt-1 text-[11px] text-ink-variant">{fmtTime(m.createdAt)}</span>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted-purple text-primary">
                  <Icon name="auto_awesome" size={18} fill />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="rounded-3xl rounded-tl-lg bg-card px-4 py-3 text-[14px] leading-relaxed text-ink shadow-soft">
                    <Rich text={m.text} />
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-3 border-t border-surface-container pt-2">
                        <p className="text-[12px] font-bold text-ink-variant">📎 출처</p>
                        <ul className="mt-1 space-y-1">
                          {m.sources
                            .filter((src) => /^https?:\/\//.test(src.url))
                            .map((src) => (
                              <li key={src.url}>
                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary underline-offset-2 hover:underline"
                                >
                                  {src.name}
                                  {src.title !== src.name && <span className="font-normal text-ink-variant">· {src.title}</span>}
                                  <Icon name="open_in_new" size={14} />
                                </a>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.source !== "web" && /(낮잠|밤잠|예상)/.test(m.text) && (
                      <button onClick={() => navigate("/routine")} className="press flex items-center gap-1 rounded-full bg-muted-purple px-3 py-1.5 text-[12px] font-semibold text-primary">
                        <Icon name="bedtime" size={16} /> 수면 루틴 확인
                      </button>
                    )}
                    {/가이드/.test(m.text) && (
                      <Link to="/guide" className="press flex items-center gap-1 rounded-full bg-surface-low px-3 py-1.5 text-[12px] font-semibold text-ink-variant">
                        <Icon name="menu_book" size={16} /> 가이드 보기
                      </Link>
                    )}
                    <span className="self-center text-[11px] text-ink-variant">
                      {fmtTime(m.createdAt)} · {m.source === "web" ? "기관 자료 요약" : m.source === "llm" ? "AI 답변" : "기록 기반 답변"}
                    </span>
                  </div>
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted-purple text-primary">
                <Icon name="auto_awesome" size={18} fill />
              </span>
              <div className="flex items-center gap-1 rounded-3xl bg-card px-4 py-3 shadow-soft">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <p className="mt-4 flex gap-2 rounded-2xl bg-surface-low p-3 text-[11px] leading-relaxed text-ink-variant">
          <Icon name="info" size={16} className="shrink-0" /> {SAFETY_NOTE}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="sticky bottom-[88px] mt-3 flex items-center gap-2 rounded-full bg-card p-1.5 pl-4 shadow-lift"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`${baby!.nickname}의 수면에 대해 물어보세요`}
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-outline"
            maxLength={500}
          />
          {SR && (
            <button type="button" aria-label="음성으로 질문" onClick={dictate} className={`press rounded-full p-2.5 ${listening ? "animate-listen bg-muted-purple text-primary" : "text-ink-variant"}`}>
              <Icon name="mic" />
            </button>
          )}
          <button aria-label="보내기" disabled={!input.trim() || busy} className="press flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-40">
            <Icon name="send" fill />
          </button>
        </form>
      </main>
    </>
  );
}
