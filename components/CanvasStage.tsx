import React, { RefObject } from "react";

interface CanvasStageProps {
  stageRef: RefObject<HTMLDivElement | null>;
  drawCanvasRef: RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  hasDrawn: boolean;
  styles: Record<string, React.CSSProperties>;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  stageRef,
  drawCanvasRef,
  overlayCanvasRef,
  hasDrawn,
  styles,
}) => {
  return (
    <div ref={stageRef} style={styles.stage}>
      <canvas
        ref={drawCanvasRef}
        style={{
          ...styles.canvasBase,
          filter: "drop-shadow(0 0 6px rgba(242,184,128,0.55))",
        }}
      />
      <canvas
        ref={overlayCanvasRef}
        style={{ ...styles.canvasBase, pointerEvents: "none" }}
      />

      {!hasDrawn && (
        <div style={styles.hint}>
          <svg
            width="140"
            height="50"
            viewBox="0 0 140 50"
            fill="none"
            style={{ opacity: 0.35 }}
          >
            <path
              d="M4 40 C 30 40, 30 10, 50 10 S 75 40, 95 40 S 115 15, 136 15"
              stroke="#f2b880"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray="3 5"
            />
          </svg>
          <p style={styles.hintText}>draw anything, then press play</p>
        </div>
      )}
    </div>
  );
};
