export type SoundCategory = "LULLABY" | "NOISE" | "NATURE";

export interface SoundDef {
  id: string;
  title: string;
  subtitle: string;
  category: SoundCategory;
  icon: string;
  /** SELF_GENERATED: synthesized in-browser. PROVIDED: an audio file supplied by the app owner. */
  license: "SELF_GENERATED" | "PROVIDED";
  /** audio file to stream (under /public); omitted for synthesized sounds */
  src?: string;
}

export const SOUND_CATEGORIES: { key: SoundCategory; label: string; icon: string }[] = [
  { key: "NOISE", label: "노이즈", icon: "graphic_eq" },
  { key: "NATURE", label: "자연음", icon: "forest" },
  { key: "LULLABY", label: "자장가", icon: "music_note" },
];

export const SOUNDS: SoundDef[] = [
  { id: "white", title: "화이트 노이즈", subtitle: "모든 주파수가 고른 소리", category: "NOISE", icon: "blur_on", license: "SELF_GENERATED" },
  { id: "pink", title: "핑크 노이즈", subtitle: "부드러운 저주파 · 무한 루프", category: "NOISE", icon: "waves", license: "SELF_GENERATED" },
  { id: "brown", title: "브라운 노이즈", subtitle: "깊고 낮은 웅웅거림", category: "NOISE", icon: "graphic_eq", license: "SELF_GENERATED" },
  { id: "heartbeat", title: "엄마 심장 소리", subtitle: "느린 두근두근 리듬", category: "NOISE", icon: "favorite", license: "SELF_GENERATED" },
  { id: "rain", title: "잔잔한 빗소리", subtitle: "창밖에 내리는 비", category: "NATURE", icon: "rainy", license: "SELF_GENERATED" },
  { id: "waves", title: "파도 소리", subtitle: "천천히 밀려오는 바다", category: "NATURE", icon: "water", license: "SELF_GENERATED" },
  { id: "forest", title: "고요한 숲", subtitle: "바람과 작은 새소리", category: "NATURE", icon: "forest", license: "SELF_GENERATED" },
  { id: "wind", title: "잔잔한 바람", subtitle: "부드럽게 스치는 바람", category: "NATURE", icon: "air", license: "SELF_GENERATED" },
  { id: "cradle", title: "Cradle Beneath the Stars", subtitle: "별빛 아래 요람 · 잔잔한 자장가", category: "LULLABY", icon: "star", license: "PROVIDED", src: "/audio/cradle-beneath-the-stars.mp3" },
  { id: "musicbox", title: "오르골 반짝반짝", subtitle: "작은 별 · 오르골", category: "LULLABY", icon: "toys", license: "SELF_GENERATED" },
  { id: "brahms", title: "브람스 자장가", subtitle: "피아노 · 느린 템포", category: "LULLABY", icon: "piano", license: "SELF_GENERATED" },
  { id: "soft", title: "잔잔한 자장가", subtitle: "포근한 허밍 패드", category: "LULLABY", icon: "nightlight", license: "SELF_GENERATED" },
];

export function soundById(id?: string) {
  return SOUNDS.find((s) => s.id === id);
}
