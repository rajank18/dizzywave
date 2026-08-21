export type Waveform =
  | "sine"
  | "triangle"
  | "sawtooth"
  | "square"
  | "arcade"
  | "organ"
  | "crystal";

export type ScaleMode = "pentatonic" | "major" | "free";

export interface Voice {
  id: number;
  freq: number;
  waveform: Waveform;
  osc: OscillatorNode;
  osc2?: OscillatorNode;
  gain: GainNode;
  missed: number;
  releasing: boolean;
}

export interface Intersection {
  yCss: number;
  freq: number;
  waveform: Waveform;
  color: string;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  waveform: Waveform;
  points: StrokePoint[];
}

export interface WaveOption {
  id: Waveform;
  label: string;
  color: string;
}

export interface ScaleOption {
  id: ScaleMode;
  label: string;
}
