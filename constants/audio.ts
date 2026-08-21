import { ScaleOption, WaveOption, Waveform } from "@/types/audio";

export const MIN_F = 110; // A2
export const MAX_F = 1174.7; // D6
export const MAX_VOICES = 16;
export const RELEASE_MISS_FRAMES = 9; // ~150ms @60fps before a note is released
export const MATCH_TOLERANCE = Math.pow(2, 3 / 12); // ~3 semitones counts as "the same" voice for glide

export const TONE_COLORS: Record<
  Waveform,
  { hex: string; name: string; glow: string; darkHex: string }
> = {
  sine: {
    hex: "#ffd166",
    darkHex: "#ffd166",
    name: "bell",
    glow: "rgba(255, 209, 102, 0.85)",
  },
  triangle: {
    hex: "#34d399",
    darkHex: "#34d399",
    name: "flute",
    glow: "rgba(52, 211, 153, 0.85)",
  },
  sawtooth: {
    hex: "#c084fc",
    darkHex: "#c084fc",
    name: "synth",
    glow: "rgba(192, 132, 252, 0.85)",
  },
  square: {
    hex: "#f87171",
    darkHex: "#f87171",
    name: "chirp",
    glow: "rgba(248, 113, 113, 0.85)",
  },
  arcade: {
    hex: "#f472b6",
    darkHex: "#f472b6",
    name: "arcade",
    glow: "rgba(244, 114, 182, 0.85)",
  },
  organ: {
    hex: "#38bdf8",
    darkHex: "#38bdf8",
    name: "organ",
    glow: "rgba(56, 189, 248, 0.85)",
  },
  crystal: {
    hex: "#3b82f6",
    darkHex: "#3b82f6",
    name: "crystal",
    glow: "rgba(59, 130, 246, 0.85)",
  },
};

export const WAVES: WaveOption[] = [
  { id: "sine", label: "bell", color: TONE_COLORS.sine.hex },
  { id: "triangle", label: "flute", color: TONE_COLORS.triangle.hex },
  { id: "sawtooth", label: "synth", color: TONE_COLORS.sawtooth.hex },
  { id: "square", label: "chirp", color: TONE_COLORS.square.hex },
  { id: "arcade", label: "arcade", color: TONE_COLORS.arcade.hex },
  { id: "organ", label: "organ", color: TONE_COLORS.organ.hex },
  { id: "crystal", label: "crystal", color: TONE_COLORS.crystal.hex },
];

export const SCALES: ScaleOption[] = [
  { id: "pentatonic", label: "pentatonic" },
  { id: "major", label: "major" },
  { id: "free", label: "free" },
];
