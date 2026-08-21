import { ScaleOption, WaveOption } from "@/types/audio";

export const MIN_F = 110; // A2
export const MAX_F = 1174.7; // D6
export const MAX_VOICES = 12;
export const RELEASE_MISS_FRAMES = 9; // ~150ms @60fps before a note is released
export const MATCH_TOLERANCE = Math.pow(2, 3 / 12); // ~3 semitones counts as "the same" voice for glide

export const WAVES: WaveOption[] = [
  { id: "sine", label: "bell" },
  { id: "triangle", label: "flute" },
  { id: "sawtooth", label: "synth" },
  { id: "square", label: "chip" },
];

export const SCALES: ScaleOption[] = [
  { id: "pentatonic", label: "pentatonic" },
  { id: "major", label: "major" },
  { id: "free", label: "free" },
];
