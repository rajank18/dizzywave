import React from "react";
import { Waveform, ScaleMode } from "@/types/audio";
import { WAVES, SCALES } from "@/constants/audio";
import { SegmentedControl } from "./SegmentedControl";

interface ControlBarProps {
  isPlaying: boolean;
  onPlayClick: () => void;
  onUndo: () => void;
  onClear: () => void;
  waveform: Waveform;
  setWaveform: (w: Waveform) => void;
  disabledWaveforms?: Set<Waveform>;
  onToggleWaveformDisable?: (w: Waveform) => void;
  scaleMode: ScaleMode;
  setScaleMode: (s: ScaleMode) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  voiceCount: number;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isPlaying,
  onPlayClick,
  onUndo,
  onClear,
  waveform,
  setWaveform,
  disabledWaveforms,
  onToggleWaveformDisable,
  scaleMode,
  setScaleMode,
  speed,
  setSpeed,
}) => {
  return (
    <footer className="flex-none px-3 py-2.5 md:px-6 md:py-4 flex items-center justify-between gap-3 md:gap-5 flex-wrap max-w-full overflow-hidden">
      {/* Row 1 on Mobile: Action Buttons (Play, Undo, Clear) + Speed Slider on same line! */}
      <div className="flex items-center justify-between gap-2.5 md:gap-4 flex-none w-full md:w-auto">
        <div className="flex items-center gap-1.5 md:gap-3 flex-none">
          <button
            onClick={onPlayClick}
            style={{
              background: "#f6ab3e",
              borderColor: "#f6ab3e",
              color: "#fff",
            }}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border cursor-pointer flex-none hover:scale-105 transition-transform"
            aria-label="Play or pause"
            title="Play / Pause"
          >
            {isPlaying ? (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="2" width="3.5" height="12" rx="1" />
                <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 1.5v13l11-6.5-11-6.5z" />
              </svg>
            )}
          </button>

          <button
            onClick={onUndo}
            className="px-2.5 py-1.5 md:px-3.5 md:py-2.5 text-[10px] md:text-[12px] tracking-[0.04em] font-mono bg-white/90 text-black border border-[var(--btn-border)] rounded-lg cursor-pointer hover:bg-black/90 hover:text-white transition-colors flex items-center gap-1"
            title="Undo last stroke"
          >
            <svg
              className="w-3.5 h-3.5 md:w-4 md:h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
            undo
          </button>

          <button
            onClick={onClear}
            className="px-2.5 py-1.5 md:px-4 md:py-2.5 text-[10px] md:text-[12px] tracking-[0.04em] font-mono bg-white/90 text-black border border-[var(--btn-border)] rounded-lg cursor-pointer hover:bg-black/90 hover:text-white transition-colors"
          >
            clear
          </button>
        </div>

        {/* Speed Slider on same row */}
        <div className="flex items-center gap-1.5 flex-none">
          <span className="text-[10px] md:text-[11px] tracking-[0.09em] uppercase text-[var(--subtext)]">
            speed
          </span>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-16 sm:w-20 md:w-28 accent-[var(--teal-active-color)]"
          />
          <span className="text-[11px] md:text-[12px] text-[var(--teal-active-color)] tracking-[0.03em] min-w-[18px]">
            {speed}
          </span>
        </div>
      </div>

      {/* Tone Segmented Control (Strict 4 pills per row, TONE label aligned top at start of first pill) */}
      <div className="flex items-start gap-2 flex-none">
        <span className="text-[10px] md:text-[11px] tracking-[0.09em] uppercase text-[var(--subtext)] mr-1 flex-none pt-1.5 md:pt-2">
          tones
        </span>
        <div className="flex flex-col gap-1.5 flex-none">
          <SegmentedControl<Waveform>
            hideLabel
            options={WAVES.slice(0, 4)}
            value={waveform}
            onChange={setWaveform}
            disabledIds={disabledWaveforms}
            onToggleDisable={onToggleWaveformDisable}
          />
          <SegmentedControl<Waveform>
            hideLabel
            options={WAVES.slice(4, 7)}
            value={waveform}
            onChange={setWaveform}
            disabledIds={disabledWaveforms}
            onToggleDisable={onToggleWaveformDisable}
          />
        </div>
      </div>

      {/* Scale Segmented Control */}
      <div className="flex-none">
        <SegmentedControl<ScaleMode>
          label="scale"
          options={SCALES}
          value={scaleMode}
          onChange={setScaleMode}
        />
      </div>

      {/* Credit */}
      <div className="text-[11px] md:text-[12px] text-[var(--subtext)] tracking-[0.05em] flex-none ml-auto">
        Built by{" "}
        <a
          href="https://github.com/rajank18"
          target="_blank"
          rel="noreferrer"
          className="text-[#f6ab3e] font-bold underline"
        >
          RAJAN
        </a><span className="text-[11px] text-[#f6ab3e]">♡</span>
      </div>
    </footer>
  );
};
