export type SleepEventType =
  | "WAKE_UP"
  | "NAP_START"
  | "NAP_END"
  | "NIGHT_SLEEP_START"
  | "NIGHT_WAKE"
  | "BACK_TO_SLEEP";

export type InputMethod = "BUTTON" | "VOICE" | "MANUAL" | "SYSTEM";

export interface SleepEvent {
  id: string;
  type: SleepEventType;
  /** ISO 8601 timestamp */
  time: string;
  inputMethod: InputMethod;
  confidence?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Baby {
  nickname: string;
  /** YYYY-MM-DD */
  birthDate: string;
  gender?: "F" | "M" | "";
  /** HH:MM */
  usualWakeTime: string;
  /** HH:MM */
  usualBedtime: string;
  napCount?: number;
  daycare: boolean;
}

export type SleepType = "NAP" | "NIGHT";

export interface SleepSession {
  id: string;
  type: SleepType;
  start: Date;
  end: Date | null;
  /** asleep minutes (night wakings subtracted) */
  durationMin: number;
  nightWakings: number;
  awakeMin: number;
  startEventId: string;
  endEventId?: string;
}

export type BabyState = "AWAKE" | "NAPPING" | "NIGHT_SLEEPING" | "NIGHT_AWAKE" | "UNKNOWN";

export interface PredictionWindow {
  type: "NAP" | "NIGHT" | "WAKE";
  start: Date;
  end: Date;
  /** index of the nap within the day (1-based), for naps */
  napIndex?: number;
}

export interface Prediction {
  next: PredictionWindow | null;
  schedule: PredictionWindow[];
  reason: string;
  /** 0~1, how much of the prediction is personalized */
  confidence: number;
  personalization: "GUIDE" | "MIXED" | "PERSONAL";
  wakeWindowMin: number;
  modelVersion: string;
}

export interface RoutineStep {
  id: string;
  emoji: string;
  title: string;
  minutes: number;
  soundId?: string;
}

export interface Settings {
  notifyNap: boolean;
  notifyRoutine: boolean;
  notifyBedtime: boolean;
  defaultVolume: number;
  nightMode: boolean;
  favorites: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  source?: "llm" | "rules" | "web";
  /** trusted organization pages the answer was built from (web answers only) */
  sources?: { name: string; title: string; url: string }[];
}

export interface VoiceParseResult {
  intent: SleepEventType | null;
  event_time: string | null;
  confidence: number;
  requires_confirmation: boolean;
  transcript: string;
  source?: "llm" | "rules";
}
