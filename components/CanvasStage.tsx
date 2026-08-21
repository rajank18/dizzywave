import React, { RefObject } from "react";

interface CanvasStageProps {
  stageRef: RefObject<HTMLDivElement | null>;
  drawCanvasRef: RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  hasDrawn: boolean;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  stageRef,
  drawCanvasRef,
  overlayCanvasRef,
  hasDrawn,
}) => {
  return (
    <div
      ref={stageRef}
      style={{
        background: "var(--stage-bg)",
        borderColor: "var(--stage-border)",
        boxShadow: "var(--stage-shadow)",
      }}
      className="flex-1 min-h-0 max-h-[62dvh] md:max-h-[70dvh] relative mx-2 md:mx-4 rounded-xl overflow-hidden select-none touch-none border transition-all duration-300"
    >
      <canvas
        ref={drawCanvasRef}
        className="absolute inset-0 w-full h-full touch-none drop-shadow-[0_0_6px_rgba(242,184,128,0.55)]"
      />
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full touch-none pointer-events-none"
      />

      {!hasDrawn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 pointer-events-none">
          <svg
            width="140"
            height="50"
            viewBox="0 0 140 50"
            fill="none"
            className="opacity-70 dark:opacity-60"
          >
            <path
              d="M10 25 C30 5, 50 45, 70 25 C90 5, 110 45, 130 25"
              stroke="#f6ab3e"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <div className="text-[11px] tracking-[0.08em] uppercase text-[var(--subtext)] font-mono">
            Draw anywhere to create sound
          </div>
        </div>
      )}
    </div>
  );
};
