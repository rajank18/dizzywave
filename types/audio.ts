export type Waveform = "sine" | "triangle" | "sawtooth" | "square";
export type ScaleMode = "pentatonic" | "major" | "free";

export interface Voice {
  id: number;
  freq: number;
  osc: OscillatorNode;
  gain: GainNode;
  missed: number;
  releasing: boolean;
}

export interface Intersection {
  yCss: number;
  freq: number;
}

export interface WaveOption {
  id: Waveform;
  label: string;
}

export interface ScaleOption {
  id: ScaleMode;
  label: string;
}
