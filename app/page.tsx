"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Waveform, ScaleMode, Intersection, Stroke } from "@/types/audio";
import { MIN_F, MAX_F, TONE_COLORS } from "@/constants/audio";
import { PENTATONIC, MAJOR, snapToScale } from "@/utils/audio";
import { AudioEngine } from "@/utils/audioEngine";
import { Header } from "@/components/Header";
import { CanvasStage } from "@/components/CanvasStage";
import { ControlBar } from "@/components/ControlBar";

/* ------------------------------------------------------------------ */
/*  dizzywave — freehand polyphonic multi-timbral canvas synthesis.   */
/* ------------------------------------------------------------------ */

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const dctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const octxRef = useRef<CanvasRenderingContext2D | null>(null);

  const dprRef = useRef(1);
  const sizeRef = useRef({ w: 0, h: 0 });

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [waveform, setWaveform] = useState<Waveform>("sine"); // active drawing brush tone
  const [disabledWaveforms, setDisabledWaveforms] = useState<Set<Waveform>>(
    new Set()
  );
  const [scaleMode, setScaleMode] = useState<ScaleMode>("pentatonic");
  const [speed, setSpeed] = useState(8);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [voiceCount, setVoiceCount] = useState(0);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  if (audioEngineRef.current == null) {
    audioEngineRef.current = new AudioEngine();
  }

  // Vector strokes database
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Sync state to refs for high-performance rAF loop
  const waveformRef = useRef(waveform);
  const disabledWaveformsRef = useRef(disabledWaveforms);
  const scaleModeRef = useRef(scaleMode);
  const speedRef = useRef(speed);
  const isPlayingRef = useRef(isPlaying);
  const hasDrawnRef = useRef(hasDrawn);

  /* ---------------- stroke redrawing ---------------- */
  const redrawAllStrokes = useCallback(() => {
    const dctx = dctxRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!dctx || !drawCanvas) return;

    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;

    const dpr = dprRef.current;
    dctx.save();
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    dctx.restore();

    dctx.save();
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.lineCap = "round";
    dctx.lineJoin = "round";
    dctx.lineWidth = 4.5;

    const isDark = theme === "dark";

    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue;
      const colorObj = TONE_COLORS[stroke.waveform] || TONE_COLORS.sine;
      const color = isDark ? colorObj.darkHex : colorObj.hex;
      dctx.strokeStyle = color;
      dctx.fillStyle = color;

      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        dctx.beginPath();
        dctx.arc(p.x, p.y, dctx.lineWidth / 2, 0, Math.PI * 2);
        dctx.fill();
      } else {
        dctx.beginPath();
        dctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          dctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        dctx.stroke();
      }
    }
    dctx.restore();
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
    redrawAllStrokes();
  }, [theme, redrawAllStrokes]);

  useEffect(() => {
    waveformRef.current = waveform;
  }, [waveform]);

  useEffect(() => {
    disabledWaveformsRef.current = disabledWaveforms;
  }, [disabledWaveforms]);

  useEffect(() => {
    scaleModeRef.current = scaleMode;
  }, [scaleMode]);

  useEffect(() => {
    const calcDuration = (val: number) => {
      const t = Math.max(0, Math.min(30, val)) / 30;
      return 20 * Math.pow(0.15 / 20, t);
    };
    const oldSpeedVal = speedRef.current;
    if (
      oldSpeedVal !== speed &&
      startTimeRef.current !== null &&
      isPlayingRef.current
    ) {
      const oldDuration = calcDuration(oldSpeedVal);
      const newDuration = calcDuration(speed);
      const now = performance.now();
      const elapsed = (now - startTimeRef.current) / 1000;
      const progress =
        (((elapsed % oldDuration) + oldDuration) % oldDuration) / oldDuration;
      startTimeRef.current = now - progress * newDuration * 1000;
    }
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
  const pausedProgressRef = useRef<number>(0);
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

      sizeRef.current = { w: rect.width, h: rect.height };

      [drawCanvas, overlayCanvas].forEach((c) => {
        c.width = newW;
        c.height = newH;
      });

      const dctx = drawCanvas.getContext("2d");
      const octx = overlayCanvas.getContext("2d");
      if (dctx) {
        dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dctx.lineCap = "round";
        dctx.lineJoin = "round";
        dctx.lineWidth = 4.5;
      }
      if (octx) octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dctxRef.current = dctx;
      octxRef.current = octx;

      redrawAllStrokes();
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [theme, redrawAllStrokes]);

  /* ---------------- iOS Web Audio unlock ---------------- */
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
    const stage = stageRef.current;
    if (!stage) return;

    function posFromCoords(clientX: number, clientY: number) {
      const rect = stage!.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(rect.width, clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, clientY - rect.top)),
      };
    }

    function startDraw(x: number, y: number) {
      audioEngineRef.current?.unlockAudio();
      drawingRef.current = true;
      lastPosRef.current = { x, y };

      const activeTone = waveformRef.current;
      const stroke: Stroke = {
        id: Math.random().toString(36).slice(2),
        waveform: activeTone,
        points: [{ x, y }],
      };
      currentStrokeRef.current = stroke;
      strokesRef.current.push(stroke);
      setHasDrawn(true);

      const dctx = dctxRef.current;
      if (!dctx) return;
      const colorObj = TONE_COLORS[activeTone] || TONE_COLORS.sine;
      const color = theme === "dark" ? colorObj.darkHex : colorObj.hex;

      dctx.beginPath();
      dctx.arc(x, y, dctx.lineWidth / 2, 0, Math.PI * 2);
      dctx.fillStyle = color;
      dctx.fill();
    }

    function moveDraw(x: number, y: number) {
      if (!drawingRef.current || !currentStrokeRef.current) return;
      const dctx = dctxRef.current;
      if (!dctx) return;
      const p = { x, y };
      currentStrokeRef.current.points.push(p);

      const activeTone = currentStrokeRef.current.waveform;
      const colorObj = TONE_COLORS[activeTone] || TONE_COLORS.sine;
      const color = theme === "dark" ? colorObj.darkHex : colorObj.hex;

      dctx.beginPath();
      dctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      dctx.lineTo(p.x, p.y);
      dctx.strokeStyle = color;
      dctx.stroke();
      lastPosRef.current = p;
    }

    function stopDraw() {
      drawingRef.current = false;
      currentStrokeRef.current = null;
    }

    let isTouching = false;

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
      if (!drawingRef.current || e.touches.length === 0) return;
      const t = e.touches[0];
      const p = posFromCoords(t.clientX, t.clientY);
      moveDraw(p.x, p.y);
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.cancelable) e.preventDefault();
      stopDraw();
      setTimeout(() => {
        isTouching = false;
      }, 50);
    }

    function onPointerDown(e: PointerEvent) {
      if (isTouching) return;
      if (e.pointerType === "touch") return;
      startDraw(
        e.clientX - stage!.getBoundingClientRect().left,
        e.clientY - stage!.getBoundingClientRect().top
      );
      stage!.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (isTouching) return;
      if (!drawingRef.current) return;
      const rect = stage!.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      moveDraw(x, y);
    }

    function onPointerUp(e: PointerEvent) {
      if (isTouching) return;
      stopDraw();
      try {
        stage!.releasePointerCapture(e.pointerId);
      } catch {
        /* no-op */
      }
    }

    stage.addEventListener("touchstart", onTouchStart, { passive: false });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd, { passive: false });
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);

    return () => {
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerUp);
    };
  }, [theme]);

  /* ---------------- pitch mapping math ---------------- */
  const yToFreq = useCallback((yCss: number) => {
    const { h } = sizeRef.current;
    if (h === 0) return 440;
    const clampedY = Math.max(0, Math.min(h, yCss));
    const ratio = 1 - clampedY / h; // bottom = low, top = high
    const rawFreq = MIN_F * Math.pow(MAX_F / MIN_F, ratio);

    const mode = scaleModeRef.current;
    if (mode === "pentatonic") return snapToScale(rawFreq, PENTATONIC);
    if (mode === "major") return snapToScale(rawFreq, MAJOR);
    return rawFreq; // free scale
  }, []);

  /* ---------------- intersection detection ---------------- */
  const getIntersections = useCallback(
    (xCss: number): Intersection[] => {
      const { h } = sizeRef.current;
      if (!h || strokesRef.current.length === 0) return [];

      const rawIntersections: { yCss: number; strokeWave: Waveform }[] = [];
      const disabledSet = disabledWaveformsRef.current;

      for (const stroke of strokesRef.current) {
        const points = stroke.points;
        if (points.length === 0) continue;

        if (points.length === 1) {
          const p = points[0];
          if (Math.abs(p.x - xCss) <= 2.5) {
            rawIntersections.push({ yCss: p.y, strokeWave: stroke.waveform });
          }
          continue;
        }

        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const minX = Math.min(p1.x, p2.x);
          const maxX = Math.max(p1.x, p2.x);

          if (xCss >= minX - 0.5 && xCss <= maxX + 0.5) {
            const dx = p2.x - p1.x;
            if (Math.abs(dx) > 0.001) {
              const t = (xCss - p1.x) / dx;
              if (t >= 0 && t <= 1) {
                const yCss = p1.y + t * (p2.y - p1.y);
                rawIntersections.push({
                  yCss,
                  strokeWave: stroke.waveform,
                });
              }
            } else {
              const midY = (p1.y + p2.y) / 2;
              rawIntersections.push({
                yCss: midY,
                strokeWave: stroke.waveform,
              });
            }
          }
        }
      }

      if (rawIntersections.length === 0) return [];

      rawIntersections.sort((a, b) => a.yCss - b.yCss);

      const merged: Intersection[] = [];
      const currentActiveWave = waveformRef.current;

      for (const item of rawIntersections) {
        if (
          merged.length > 0 &&
          Math.abs(item.yCss - merged[merged.length - 1].yCss) < 4.5
        ) {
          // skip duplicate overlap
        } else {
          const isWaveDisabled = disabledSet.has(item.strokeWave);
          const effectiveWave = isWaveDisabled
            ? currentActiveWave
            : item.strokeWave;
          const colorObj =
            TONE_COLORS[effectiveWave] || TONE_COLORS[item.strokeWave] || TONE_COLORS.sine;
          const color = theme === "dark" ? colorObj.darkHex : colorObj.hex;

          merged.push({
            yCss: item.yCss,
            freq: yToFreq(item.yCss),
            waveform: effectiveWave,
            color,
          });
        }
      }

      return merged;
    },
    [yToFreq, theme]
  );

  /* ---------------- overlay rendering ---------------- */
  const drawOverlay = useCallback(
    (intersections: Intersection[]) => {
      const octx = octxRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const { w, h } = sizeRef.current;
      if (!octx) return;

      octx.save();
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.clearRect(
        0,
        0,
        overlayCanvas?.width || w * 2,
        overlayCanvas?.height || h * 2
      );
      octx.restore();

      const isDark = theme === "dark";
      const x = currentScannerXRef.current;
      const grad = octx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(
        0,
        isDark ? "rgba(125,211,192,0.05)" : "rgba(13,148,136,0.05)"
      );
      grad.addColorStop(
        0.5,
        isDark ? "rgba(125,211,192,0.9)" : "rgba(13,148,136,0.9)"
      );
      grad.addColorStop(
        1,
        isDark ? "rgba(125,211,192,0.05)" : "rgba(13,148,136,0.05)"
      );
      octx.save();
      octx.shadowColor = isDark
        ? "rgba(125,211,192,0.8)"
        : "rgba(13,148,136,0.6)";
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
        octx.shadowColor = it.color;
        octx.shadowBlur = 18;
        octx.fillStyle = it.color;
        octx.beginPath();
        octx.arc(x, it.yCss, 5.5, 0, Math.PI * 2);
        octx.fill();
        octx.restore();
      }
    },
    [theme]
  );

  /* ---------------- main animation loop (mounted once) ---------------- */
  useEffect(() => {
    function frame(ts: number) {
      rafIdRef.current = requestAnimationFrame(frame);

      if (!isPlayingRef.current) {
        const intersections = hasDrawnRef.current
          ? getIntersections(currentScannerXRef.current)
          : [];
        drawOverlay(intersections);
        return;
      }

      const t = Math.max(0, Math.min(30, speedRef.current)) / 30;
      const loopDuration = 20 * Math.pow(0.15 / 20, t);

      if (startTimeRef.current === null) {
        const initialProgress = pausedProgressRef.current || 0;
        startTimeRef.current = ts - initialProgress * loopDuration * 1000;
      }

      const elapsed = (ts - startTimeRef.current) / 1000;
      const progress =
        (((elapsed % loopDuration) + loopDuration) % loopDuration) / loopDuration;
      pausedProgressRef.current = progress;
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
        audioEngineRef.current?.stopAllVoices(true);
      }
      return next;
    });
  }

  function handleUndo() {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    if (strokesRef.current.length === 0) {
      setHasDrawn(false);
    }
    redrawAllStrokes();
    audioEngineRef.current?.stopAllVoices(false);
  }

  function handleClear() {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    pausedProgressRef.current = 0;
    currentScannerXRef.current = 0;

    const drawCanvas = drawCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const dctx = dctxRef.current;
    const octx = octxRef.current;

    if (drawCanvas && dctx) {
      dctx.save();
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      dctx.restore();
      dctx.beginPath();
    }

    if (overlayCanvas && octx) {
      octx.save();
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      octx.restore();
    }

    setHasDrawn(false);
    audioEngineRef.current?.stopAllVoices(true);
  }

  function handleToggleWaveformDisable(w: Waveform) {
    setDisabledWaveforms((prev) => {
      const next = new Set(prev);
      if (next.has(w)) {
        next.delete(w);
      } else {
        next.add(w);
      }
      return next;
    });
  }

  return (
    <div
      data-theme={theme}
      style={{
        background: "var(--bg-app)",
        color: "var(--text-app)",
      }}
      className="flex flex-col h-dvh w-full m-0 font-mono overflow-hidden select-none transition-colors duration-300"
    >
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      <CanvasStage
        stageRef={stageRef}
        drawCanvasRef={drawCanvasRef}
        overlayCanvasRef={overlayCanvasRef}
        hasDrawn={hasDrawn}
      />

      <ControlBar
        isPlaying={isPlaying}
        onPlayClick={handlePlayClick}
        onUndo={handleUndo}
        onClear={handleClear}
        waveform={waveform}
        setWaveform={setWaveform}
        disabledWaveforms={disabledWaveforms}
        onToggleWaveformDisable={handleToggleWaveformDisable}
        scaleMode={scaleMode}
        setScaleMode={setScaleMode}
        speed={speed}
        setSpeed={setSpeed}
        voiceCount={voiceCount}
      />
    </div>
  );
}
