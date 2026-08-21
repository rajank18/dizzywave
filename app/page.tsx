"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Waveform, ScaleMode, Intersection } from "@/types/audio";
import { MIN_F, MAX_F } from "@/constants/audio";
import { PENTATONIC, MAJOR, snapToScale } from "@/utils/audio";
import { AudioEngine } from "@/utils/audioEngine";
import { Header } from "@/components/Header";
import { CanvasStage } from "@/components/CanvasStage";
import { ControlBar } from "@/components/ControlBar";

/* ------------------------------------------------------------------ */
/*  Draw the Sound — a freehand canvas where geometry becomes music.   */
/*  X-axis = time, Y-axis = pitch, every intersection = a voice.       */
/* ------------------------------------------------------------------ */

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const dctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const octxRef = useRef<CanvasRenderingContext2D | null>(null);

  const dprRef = useRef(1);
  const sizeRef = useRef({ w: 0, h: 0 });

  const [waveform, setWaveform] = useState<Waveform>("sine");
  const [scaleMode, setScaleMode] = useState<ScaleMode>("pentatonic");
  const [speed, setSpeed] = useState(8); // loop duration, seconds
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [voiceCount, setVoiceCount] = useState(0);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  if (audioEngineRef.current == null) {
    audioEngineRef.current = new AudioEngine();
  }

  // mirror state into refs so the rAF loop always reads fresh values
  // without needing to be re-created on every render
  const waveformRef = useRef(waveform);
  const scaleModeRef = useRef(scaleMode);
  const speedRef = useRef(speed);
  const isPlayingRef = useRef(isPlaying);
  const hasDrawnRef = useRef(hasDrawn);

  useEffect(() => {
    waveformRef.current = waveform;
    audioEngineRef.current?.updateWaveform(waveform);
  }, [waveform]);

  useEffect(() => {
    scaleModeRef.current = scaleMode;
  }, [scaleMode]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    hasDrawnRef.current = hasDrawn;
  }, [hasDrawn]);

  // ---- drawing state ----
  const drawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // ---- animation state ----
  const startTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number>(0);
  const currentScannerXRef = useRef(0);

  /* ---------------- canvas sizing ---------------- */
  useEffect(() => {
    function resize() {
      const stage = stageRef.current;
      const drawCanvas = drawCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!stage || !drawCanvas || !overlayCanvas) return;

      const rect = stage.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5));
      dprRef.current = dpr;

      const oldW = drawCanvas.width;
      const oldH = drawCanvas.height;
      const newW = Math.round(rect.width * dpr);
      const newH = Math.round(rect.height * dpr);

      if (oldW === newW && oldH === newH) return;

      // Preserve existing drawing buffer on viewport resize (e.g. mobile address bar toggling)
      let tempCanvas: HTMLCanvasElement | null = null;
      if (oldW > 0 && oldH > 0 && dctxRef.current) {
        tempCanvas = document.createElement("canvas");
        tempCanvas.width = oldW;
        tempCanvas.height = oldH;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) tempCtx.drawImage(drawCanvas, 0, 0);
      }

      sizeRef.current = { w: rect.width, h: rect.height };

      [drawCanvas, overlayCanvas].forEach((c) => {
        c.width = newW;
        c.height = newH;
      });

      const dctx = drawCanvas.getContext("2d", { willReadFrequently: true });
      const octx = overlayCanvas.getContext("2d");
      if (dctx) {
        dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dctx.lineCap = "round";
        dctx.lineJoin = "round";
        dctx.strokeStyle = "#f2b880";
        dctx.lineWidth = 4.5;

        if (tempCanvas) {
          dctx.save();
          dctx.setTransform(1, 0, 0, 1, 0, 0);
          dctx.drawImage(tempCanvas, 0, 0);
          dctx.restore();
        }
      }
      if (octx) octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dctxRef.current = dctx;
      octxRef.current = octx;
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* ---------------- audio engine & iOS Web Audio unlock ---------------- */
  useEffect(() => {
    function warmAudio() {
      audioEngineRef.current?.unlockAudio();
      window.removeEventListener("touchstart", warmAudio);
      window.removeEventListener("pointerdown", warmAudio);
    }
    window.addEventListener("touchstart", warmAudio, { passive: true });
    window.addEventListener("pointerdown", warmAudio, { passive: true });
    return () => {
      window.removeEventListener("touchstart", warmAudio);
      window.removeEventListener("pointerdown", warmAudio);
    };
  }, []);

  /* ---------------- pointer & touch drawing input ---------------- */
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    function posFromCoords(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function startDraw(x: number, y: number) {
      audioEngineRef.current?.unlockAudio();
      const dctx = dctxRef.current;
      if (!dctx) return;
      drawingRef.current = true;
      setHasDrawn(true);
      const p = { x, y };
      lastPosRef.current = p;
      dctx.beginPath();
      dctx.arc(p.x, p.y, dctx.lineWidth / 2, 0, Math.PI * 2);
      dctx.fillStyle = "#f2b880";
      dctx.fill();
    }

    function moveDraw(x: number, y: number) {
      if (!drawingRef.current) return;
      const dctx = dctxRef.current;
      if (!dctx) return;
      const p = { x, y };
      dctx.beginPath();
      dctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      dctx.lineTo(p.x, p.y);
      dctx.stroke();
      lastPosRef.current = p;
    }

    function stopDraw() {
      drawingRef.current = false;
    }

    let isTouching = false;

    // Explicit touch event handlers for Mobile Devices (iOS Safari & Android Chrome)
    function onTouchStart(e: TouchEvent) {
      if (e.cancelable) e.preventDefault();
      isTouching = true;
      if (e.touches.length > 0) {
        const t = e.touches[0];
        const p = posFromCoords(t.clientX, t.clientY);
        startDraw(p.x, p.y);
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.cancelable) e.preventDefault();
      if (e.touches.length > 0) {
        const t = e.touches[0];
        const p = posFromCoords(t.clientX, t.clientY);
        moveDraw(p.x, p.y);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.cancelable) e.preventDefault();
      isTouching = false;
      stopDraw();
    }

    // Pointer event handlers for Desktop Mouse & Stylus Pen
    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "touch" || isTouching) return;
      const p = posFromCoords(e.clientX, e.clientY);
      startDraw(p.x, p.y);
      try {
        canvas!.setPointerCapture(e.pointerId);
      } catch {
        /* fallback */
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerType === "touch" || isTouching) return;
      const p = posFromCoords(e.clientX, e.clientY);
      moveDraw(p.x, p.y);
    }

    function onPointerUp(e: PointerEvent) {
      if (e.pointerType === "touch" || isTouching) return;
      stopDraw();
    }

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);

      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  /* ---------------- pitch mapping ---------------- */
  const yToFreq = useCallback((yCss: number): number => {
    const h = sizeRef.current.h || 1;
    const t = 1 - Math.max(0, Math.min(1, yCss / h));
    let freq = MIN_F * Math.pow(MAX_F / MIN_F, t);
    if (scaleModeRef.current === "pentatonic") freq = snapToScale(freq, PENTATONIC);
    else if (scaleModeRef.current === "major") freq = snapToScale(freq, MAJOR);
    return freq;
  }, []);

  /* ---------------- column scanning ---------------- */
  const getIntersections = useCallback(
    (xCss: number): Intersection[] => {
      const dctx = dctxRef.current;
      const drawCanvas = drawCanvasRef.current;
      if (!dctx || !drawCanvas) return [];
      const dpr = dprRef.current;
      const px = Math.max(
        0,
        Math.min(drawCanvas.width - 1, Math.round(xCss * dpr))
      );

      let imgData: ImageData;
      try {
        imgData = dctx.getImageData(px, 0, 1, drawCanvas.height);
      } catch {
        return [];
      }
      const data = imgData.data;
      const h = drawCanvas.height;
      const THRESH = 60;
      const runs: [number, number][] = [];
      let inRun = false;
      let runStart = 0;
      for (let py = 0; py < h; py++) {
        const alpha = data[py * 4 + 3];
        if (alpha > THRESH) {
          if (!inRun) {
            inRun = true;
            runStart = py;
          }
        } else if (inRun) {
          runs.push([runStart, py - 1]);
          inRun = false;
        }
      }
      if (inRun) runs.push([runStart, h - 1]);

      const merged: [number, number][] = [];
      for (const r of runs) {
        if (merged.length && r[0] - merged[merged.length - 1][1] < dpr * 3) {
          merged[merged.length - 1][1] = r[1];
        } else {
          merged.push([r[0], r[1]]);
        }
      }

      return merged.map((r) => {
        const midPx = (r[0] + r[1]) / 2;
        const yCss = midPx / dpr;
        return { yCss, freq: yToFreq(yCss) };
      });
    },
    [yToFreq]
  );

  /* ---------------- overlay rendering ---------------- */
  const drawOverlay = useCallback((intersections: Intersection[]) => {
    const octx = octxRef.current;
    const { w, h } = sizeRef.current;
    if (!octx) return;
    octx.clearRect(0, 0, w, h);
    if (!isPlayingRef.current) return;

    const x = currentScannerXRef.current;
    const grad = octx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(125,211,192,0.05)");
    grad.addColorStop(0.5, "rgba(125,211,192,0.9)");
    grad.addColorStop(1, "rgba(125,211,192,0.05)");
    octx.save();
    octx.shadowColor = "rgba(125,211,192,0.8)";
    octx.shadowBlur = 12;
    octx.strokeStyle = grad;
    octx.lineWidth = 1.6;
    octx.beginPath();
    octx.moveTo(x, 0);
    octx.lineTo(x, h);
    octx.stroke();
    octx.restore();

    for (const it of intersections) {
      octx.save();
      octx.shadowColor = "rgba(255,220,160,0.95)";
      octx.shadowBlur = 18;
      octx.fillStyle = "#ffe6bd";
      octx.beginPath();
      octx.arc(x, it.yCss, 5, 0, Math.PI * 2);
      octx.fill();
      octx.restore();
    }
  }, []);

  /* ---------------- main animation loop (mounted once) ---------------- */
  useEffect(() => {
    function frame(ts: number) {
      rafIdRef.current = requestAnimationFrame(frame);
      if (!isPlayingRef.current) return;
      if (startTimeRef.current === null) startTimeRef.current = ts;
      const elapsed = (ts - startTimeRef.current) / 1000;
      const loopDuration = speedRef.current;
      const progress = (elapsed % loopDuration) / loopDuration;
      currentScannerXRef.current = progress * sizeRef.current.w;

      const intersections = hasDrawnRef.current
        ? getIntersections(currentScannerXRef.current)
        : [];
      audioEngineRef.current?.updateVoices(intersections, waveformRef.current);
      drawOverlay(intersections);
      setVoiceCount(audioEngineRef.current?.getActiveVoiceCount() || 0);
    }
    rafIdRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [getIntersections, drawOverlay]);

  /* ---------------- UI handlers ---------------- */
  function handlePlayClick() {
    audioEngineRef.current?.unlockAudio();
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        startTimeRef.current = null;
      } else {
        octxRef.current?.clearRect(0, 0, sizeRef.current.w, sizeRef.current.h);
        audioEngineRef.current?.stopAllVoices(true);
      }
      return next;
    });
  }

  function handleClear() {
    const dctx = dctxRef.current;
    const { w, h } = sizeRef.current;
    dctx?.clearRect(0, 0, w, h);
    setHasDrawn(false);
    audioEngineRef.current?.stopAllVoices(true);
  }

  return (
    <div style={styles.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * {
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }
        input[type=range] {
          -webkit-appearance: none;
          appearance: none;
          width: 96px;
          height: 2px;
          background: rgba(255,255,255,0.15);
          border-radius: 2px;
          outline: none;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: #7dd3c0;
          box-shadow: 0 0 8px rgba(125,211,192,0.65);
          cursor: pointer;
          margin-top: -5px;
        }
        input[type=range]::-moz-range-thumb {
          width: 12px; height: 12px; border: none; border-radius: 50%;
          background: #7dd3c0; box-shadow: 0 0 8px rgba(125,211,192,0.65); cursor: pointer;
        }
        .dts-seg-btn:hover { color: #f5f1e8; }
      `}</style>

      <Header styles={styles} />

      <CanvasStage
        stageRef={stageRef}
        drawCanvasRef={drawCanvasRef}
        overlayCanvasRef={overlayCanvasRef}
        hasDrawn={hasDrawn}
        styles={styles}
      />

      <ControlBar
        isPlaying={isPlaying}
        onPlayClick={handlePlayClick}
        onClear={handleClear}
        waveform={waveform}
        setWaveform={setWaveform}
        scaleMode={scaleMode}
        setScaleMode={setScaleMode}
        speed={speed}
        setSpeed={setSpeed}
        voiceCount={voiceCount}
        styles={styles}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */
const styles: Record<string, React.CSSProperties> = {
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    width: "100%",
    margin: 0,
    fontFamily: "'JetBrains Mono', monospace",
    color: "#f5f1e8",
    background:
      "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(242,184,128,0.06), transparent 60%)," +
      "radial-gradient(ellipse 700px 400px at 100% 110%, rgba(125,211,192,0.05), transparent 60%)," +
      "#0a0b12",
    overflow: "hidden",
    WebkitUserSelect: "none",
    userSelect: "none",
  },
  header: {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    padding: "18px 24px 10px",
    gap: 16,
  },
  title: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 28,
    fontStyle: "italic",
    letterSpacing: 0.3,
    color: "#f5f1e8",
    lineHeight: 1,
  },
  titleAccent: { fontStyle: "normal", color: "#f2b880", fontWeight: 400 },
  tagline: {
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#565a72",
    whiteSpace: "nowrap",
  },
  stage: {
    flex: "1 1 auto",
    position: "relative",
    margin: "0 16px",
    borderRadius: 14,
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.015), transparent 40%), #111320",
    border: "1px solid rgba(242,184,128,0.12)",
    boxShadow:
      "0 40px 80px -40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
    touchAction: "none",
    WebkitUserSelect: "none",
    userSelect: "none",
  },
  canvasBase: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    touchAction: "none",
  },
  hint: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    pointerEvents: "none",
  },
  hintText: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#565a72",
  },
  footer: {
    flex: "0 0 auto",
    padding: "14px 20px 20px",
    display: "flex",
    alignItems: "center",
    gap: 22,
    flexWrap: "wrap",
  },
  playBtn: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(180deg, rgba(242,184,128,0.16), rgba(242,184,128,0.05))",
    border: "1px solid rgba(242,184,128,0.35)",
    color: "#f2b880",
    flex: "0 0 auto",
    cursor: "pointer",
  },
  clearBtn: {
    padding: "10px 14px",
    fontSize: 11,
    letterSpacing: "0.05em",
    fontFamily: "'JetBrains Mono', monospace",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#8b8ea3",
    borderRadius: 8,
    cursor: "pointer",
  },
  group: { display: "flex", alignItems: "center", gap: 8 },
  groupLabel: {
    fontSize: 10,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    color: "#565a72",
    marginRight: 2,
  },
  seg: {
    display: "flex",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    overflow: "hidden",
  },
  segBtn: {
    border: "none",
    borderRadius: 0,
    padding: "9px 12px",
    fontSize: 11,
    letterSpacing: "0.03em",
    color: "#565a72",
    background: "transparent",
    fontFamily: "'JetBrains Mono', monospace",
    cursor: "pointer",
  },
  segBtnBorder: { borderRight: "1px solid rgba(255,255,255,0.08)" },
  segBtnActiveTeal: { background: "rgba(125,211,192,0.14)", color: "#7dd3c0" },
  voiceCount: {
    fontSize: 10,
    color: "#565a72",
    letterSpacing: "0.05em",
    minWidth: 64,
    textAlign: "right",
  },
};