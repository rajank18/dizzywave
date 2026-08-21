import React from "react";
import { Waveform, ScaleMode } from "@/types/audio";
import { WAVES, SCALES } from "@/constants/audio";
import { SegmentedControl } from "./SegmentedControl";

interface ControlBarProps {
  isPlaying: boolean;
  onPlayClick: () => void;
  onClear: () => void;
  waveform: Waveform;
  setWaveform: (w: Waveform) => void;
  scaleMode: ScaleMode;
  setScaleMode: (s: ScaleMode) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  voiceCount: number;
  styles: Record<string, React.CSSProperties>;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isPlaying,
  onPlayClick,
  onClear,
  waveform,
  setWaveform,
  scaleMode,
  setScaleMode,
  speed,
  setSpeed,
  voiceCount,
  styles,
}) => {
  return (
    <footer style={styles.footer}>
      <button
        onClick={onPlayClick}
        style={styles.playBtn}
        aria-label="Play or pause"
        title="Play / Pause"
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="3.5" height="12" rx="1" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 1.5v13l11-6.5-11-6.5z" />
          </svg>
        )}
      </button>

      <button onClick={onClear} style={styles.clearBtn}>
        clear
      </button>

      <SegmentedControl<Waveform>
        label="tone"
        options={WAVES}
        value={waveform}
        onChange={setWaveform}
        styles={styles}
      />

      <SegmentedControl<ScaleMode>
        label="scale"
        options={SCALES}
        value={scaleMode}
        onChange={setScaleMode}
        styles={styles}
      />

      <div style={styles.group}>
        <span style={styles.groupLabel}>speed</span>
        <input
          type="range"
          min={3}
          max={20}
          step={0.5}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
        />
      </div>

      <div style={{ flex: "1 1 auto" }} />
      <div style={styles.voiceCount}>
        {voiceCount}{" "}
        <b style={{ color: "#7dd3c0", fontWeight: 600 }}>
          {voiceCount === 1 ? "voice" : "voices"}
        </b>
      </div>
    </footer>
  );
};
