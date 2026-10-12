# 🌙 Baby Sleep Coach — 영유아 AI 수면 코치

<p align="center"><img src="docs/thumbnail.jpg" alt="Baby Sleep Coach — 다음 잠은 언제? AI 수면 코치가 알려줘요" width="100%"></p>

<p align="center"><a href="https://babysleep-coach.vercel.app"><b>👉 앱 열어보기: babysleep-coach.vercel.app</b></a></p>

> "기록하는 육아 앱이 아니라, 우리 아기가 언제 자야 하는지 함께 배우는 AI 수면 코치."

버튼 한 번 또는 말 한마디로 아기의 수면을 기록하면, 월령과 실제 수면 패턴을 분석해
**다음 낮잠·밤잠 시간**, 수면 루틴, 월령별 가이드와 수면음을 제공하는 모바일 우선 웹앱(PWA)입니다.
디자인은 Stitch "Serene Slumber & Nurture" 디자인 시스템(라벤더·버터·세이지, 둥근 카드, 하단 5탭)을 따릅니다.

## 화면

| 오늘 · 빠른 수면 기록 | 수면음 |
| :---: | :---: |
| <img src="docs/screenshots/app-today.png" alt="오늘 화면: 낮잠 진행 상태, 음성 기록, 빠른 수면 기록 버튼, AI 다음 수면 예측" width="300"> | <img src="docs/screenshots/app-sounds.png" alt="수면음 화면: 오르골 자장가 재생, 볼륨, 수면 타이머, 사운드 프리셋" width="300"> |
| 현재 수면 상태, 말 한마디 기록, 6개 빠른 버튼, AI 다음 수면 예측 | 자장가·노이즈·자연음 재생, 볼륨, 타이머(서서히 꺼짐), 즐겨찾기 |

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 예측 엔진·음성 파서 단위 테스트
npm run build && npm start   # 프로덕션
```

## AI 키 설정 (`GEMINI_API_KEY`, 선택)

| 실행 위치 | 키를 넣는 곳 |
| --- | --- |
| 내 컴퓨터 | 프로젝트 루트의 `.env` 파일 (`.env.example` 참고, Git에 올라가지 않음) |
| Vercel | Project → Settings → Environment Variables → `GEMINI_API_KEY` (Sensitive). `api/` 폴더의 Vercel Functions가 읽어요 |

키는 서버(Functions)에서만 읽고 브라우저로 보내지 않아요. 이름에 `VITE_`를 붙이면 브라우저 번들에 노출되니 붙이지 마세요.
키를 바꾼 뒤에는 Vercel에서 다시 배포해야 반영돼요.

`GEMINI_API_KEY`는 **선택**입니다. 키가 없어도 음성 기록 해석과 AI 코치가 내장 규칙 엔진으로 동작합니다.
키를 넣으면 자연어 의도 파악과 코치 답변에 Gemini를 사용합니다(안전 관련 질문은 항상 규칙 기반 답변).

처음 실행 시 **"샘플 데이터로 둘러보기"**를 누르면 생후 7개월 아기의 10일치 기록으로 모든 화면을 확인할 수 있어요.

## 화면 (하단 탭: 오늘 | 기록 | 소리 | 가이드 | AI)

| 화면 | 기능 |
| --- | --- |
| 온보딩 | 별명·생년월일(필수), 성별·평소 기상/취침·낮잠 횟수·어린이집(선택) |
| 오늘 | 깨어있는 시간 링, 음성 기록, 6개 빠른 버튼(상황별 추천), 기록 직후 [수정]/[취소] 토스트, AI 다음 수면 예측(범위·근거·개인화 수준), 오늘 타임라인(실제/예상 구분), 이번 주 추천 가이드 |
| 기록 | 날짜별 요약, 24시간 수면 밴드, AI 메모, 상세 타임라인 편집, 수동 기록 추가 / 주간 리포트(7일 막대, 지난주 대비, AI Insight) |
| 소리 | 노이즈(화이트·핑크·브라운·심장소리), 자연음(비·파도·숲·바람), 자장가(Cradle Beneath the Stars·오르골·브람스·허밍) — 기본 소리는 Web Audio로 직접 합성(오프라인 재생), 음원 파일은 `public/audio/`에서 스트리밍, 볼륨·타이머(페이드아웃)·즐겨찾기 |
| 가이드 | 월령별 로드맵·카테고리, Wake Window 조견표, 안전 수면 체크리스트, 상세 글 |
| AI 코치 | 추천 질문, 기록 요약 + 검증 가이드 검색(RAG) 기반 답변, "기록 사실 / 일반 정보" 구분, 건강 위험 신호 시 119·전문의 안내 |
| 수면 루틴 | 단계·시간·소리 편집, 예상 밤잠 기준 시작 시각 계산, 단계별 진행 화면(자동 수면음 재생) → "밤잠 들었어" 기록 |
| 설정 | 아기 정보, 알림(낮잠 15분 전·루틴 시작·밤잠 준비), 야간 모드, 기본 볼륨, 데이터 내보내기·전체 삭제 |

## 구조

```
server.ts                 로컬/Node 서버: Express + Vite dev 미들웨어
api/                      Vercel Functions: /api/health, /api/voice/parse, /api/coach/chat
src/server/ai.ts          위 두 곳이 함께 쓰는 AI 처리 로직(Gemini 호출 + 규칙 엔진 폴백)
src/lib/predict.ts        월령 Wake Window 규칙 + 오늘 기록 + 최근 7일 개인 평균 → 다음 수면 범위·하루 일정
src/lib/events.ts         이벤트 → 낮잠/밤잠 세션, 현재 상태, 상황별 의도 보정("낮잠 중 '일어났어'" → 낮잠 기상)
src/lib/voiceParser.ts    한국어 의도·시간 파서("10분 전", "2시 반", "아까"는 추측하지 않고 확인 요청)
src/lib/stats.ts          일/주간 통계, 상관관계를 인과로 표현하지 않는 Insight
src/lib/coach.ts          코치 컨텍스트(최소 데이터) + 규칙 기반 코치
src/lib/audio.ts          수면음 엔진(합성 + 음원 파일 스트리밍)
src/data/guides.ts        큐레이션된 월령별 가이드(코치가 검색하는 지식 베이스)
db/schema.sql             Neon PostgreSQL 스키마(계정·동기화 단계용)
```

API 응답은 명세서 17장 형식(`intent`, `event_time`, `confidence`, `requires_confirmation`)을 따릅니다.
수면 시간 예측은 LLM에 맡기지 않고 규칙 엔진이 계산하며, LLM은 해당 값을 그대로 인용하도록 지시됩니다.

## 개인정보·안전
- 기록은 기기(localStorage)에만 저장, 음성 원본 미저장, AI에는 별명·월령·오늘 요약만 전달(생년월일 제외)
- 진단 표현 금지, 건강 위험 키워드는 LLM을 거치지 않고 응급/전문의 안내
- 월령 가이드·Wake Window 수치는 일반 참고 범위이며 **출시 전 소아청소년과 전문의 검토 필요**

## 다음 단계 (명세서 P1/P2 중 미구현)
- 회원가입/로그인 + Neon 동기화(`db/schema.sql`), 가족 공동관리
- 어린이집 모드, 서버 푸시 알림(현재는 앱이 열려 있을 때 화면 알림 + 브라우저 Notification)
