import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Draw the Sound — a freehand canvas where geometry becomes music.   */
/*  X-axis = time, Y-axis = pitch, every intersection = a voice.       */
/* ------------------------------------------------------------------ */

type Waveform = "sine" | "triangle" | "sawtooth" | "square";
type ScaleMode = "pentatonic" | "major" | "free";

interface Voice {
  id: number;
  freq: number;
  osc: OscillatorNode;
  gain: GainNode;
  missed: number;
  releasing: boolean;
}

interface Intersection {
  yCss: number;
  freq: number;
}

const MIN_F = 110; // A2
const MAX_F = 1174.7; // D6
const MAX_VOICES = 12;
const RELEASE_MISS_FRAMES = 9; // ~150ms @60fps before a note is released
const MATCH_TOLERANCE = Math.pow(2, 3 / 12); // ~3 semitones counts as "the same" voice for glide

function buildScaleFreqs(intervals: number[], baseMidi: number, count: number): number[] {
  const freqs: number[] = [];
  let octave = 0;
  let i = 0;
  while (freqs.length < count) {
    const semitone = baseMidi + intervals[i % intervals.length] + 12 * octave;
    freqs.push(440 * Math.pow(2, (semitone - 69) / 12));
    i++;
    if (i % intervals.length === 0) octave++;
  }
  return freqs;
}

const PENTATONIC = buildScaleFreqs([0, 2, 4, 7, 9], 45, 40);
const MAJOR = buildScaleFreqs([0, 2, 4, 5, 7, 9, 11], 45, 40);

function snapToScale(freq: number, table: number[]): number {
  let best = table[0];
  let bestDist = Infinity;
  for (const f of table) {
    const d = Math.abs(Math.log2(f / freq));
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}

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

  // mirror state into refs so the rAF loop always reads fresh values
  // without needing to be re-created on every render
  const waveformRef = useRef(waveform);
  const scaleModeRef = useRef(scaleMode);
  const speedRef = useRef(speed);
  const isPlayingRef = useRef(isPlaying);
  const hasDrawnRef = useRef(hasDrawn);

  useEffect(() => {
    waveformRef.current = waveform;
    voicesRef.current.forEach((v) => {
      try {
        v.osc.type = waveform;
      } catch {
        /* voice already stopped */
      }
    });
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

  // ---- audio engine state (imperative, lives in refs) ----
  const actxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const voicesRef = useRef<Voice[]>([]);
  const voiceIdRef = useRef(0);

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

      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5));
      dprRef.current = dpr;
      const rect = stage.getBoundingClientRect();
      sizeRef.current = { w: rect.width, h: rect.height };

      [drawCanvas, overlayCanvas].forEach((c) => {
        c.width = Math.round(rect.width * dpr);
        c.height = Math.round(rect.height * dpr);
      });

      const dctx = drawCanvas.getContext("2d", { willReadFrequently: true });
      const octx = overlayCanvas.getContext("2d");
      if (dctx) {
        dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dctx.lineCap = "round";
        dctx.lineJoin = "round";
        dctx.strokeStyle = "#f2b880";
        dctx.lineWidth = 4.5;
      }
      if (octx) octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dctxRef.current = dctx;
      octxRef.current = octx;
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* ---------------- pointer / drawing input ---------------- */
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    function pos(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onDown(e: PointerEvent) {
      const dctx = dctxRef.current;
      if (!dctx) return;
      drawingRef.current = true;
      setHasDrawn(true);
      const p = pos(e);
      lastPosRef.current = p;
      dctx.beginPath();
      dctx.arc(p.x, p.y, dctx.lineWidth / 2, 0, Math.PI * 2);
      dctx.fillStyle = "#f2b880";
      dctx.fill();
      canvas!.setPointerCapture(e.pointerId);
    }

    function onMove(e: PointerEvent) {
      if (!drawingRef.current) return;
      const dctx = dctxRef.current;
      if (!dctx) return;
      const p = pos(e);
      dctx.beginPath();
      dctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      dctx.lineTo(p.x, p.y);
      dctx.stroke();
      lastPosRef.current = p;
    }

    function onUp() {
      drawingRef.current = false;
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  /* ---------------- audio engine ---------------- */
  function ensureAudio() {
    if (actxRef.current) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const actx: AudioContext = new AC();
    const compressor = actx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    const master = actx.createGain();
    master.gain.value = 0.9;
    master.connect(compressor);
    compressor.connect(actx.destination);
    actxRef.current = actx;
    compressorRef.current = compressor;
    masterRef.current = master;
  }

  function spawnVoice(freq: number): Voice {
    const actx = actxRef.current!;
    const master = masterRef.current!;
    const osc = actx.createOscillator();
    osc.type = waveformRef.current;
    osc.frequency.value = freq;
    const gain = actx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    const now = actx.currentTime;
    gain.gain.setTargetAtTime(0.22, now, 0.02);
    const v: Voice = { id: voiceIdRef.current++, freq, osc, gain, missed: 0, releasing: false };
    voicesRef.current.push(v);
    return v;
  }

  function releaseVoice(v: Voice) {
    if (v.releasing) return;
    v.releasing = true;
    const actx = actxRef.current;
    if (actx) {
      const now = actx.currentTime;
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setTargetAtTime(0.0001, now, 0.08);
    }
    setTimeout(() => {
      try {
        v.osc.stop();
        v.osc.disconnect();
        v.gain.disconnect();
      } catch {
        /* already stopped */
      }
      voicesRef.current = voicesRef.current.filter((x) => x.id !== v.id);
    }, 400);
  }

  function stopAllVoices(instant: boolean) {
    voicesRef.current.slice().forEach((v) => {
      const actx = actxRef.current;
      if (instant && actx) {
        try {
          v.gain.gain.cancelScheduledValues(actx.currentTime);
          v.gain.gain.setTargetAtTime(0.0001, actx.currentTime, 0.03);
        } catch {
          /* no-op */
        }
      }
      releaseVoice(v);
    });
  }

  /* ---------------- pitch mapping ---------------- */
  function yToFreq(yCss: number): number {
    const h = sizeRef.current.h || 1;
    const t = 1 - Math.max(0, Math.min(1, yCss / h));
    let freq = MIN_F * Math.pow(MAX_F / MIN_F, t);
    if (scaleModeRef.current === "pentatonic") freq = snapToScale(freq, PENTATONIC);
    else if (scaleModeRef.current === "major") freq = snapToScale(freq, MAJOR);
    return freq;
  }

  /* ---------------- column scanning ---------------- */
  function getIntersections(xCss: number): Intersection[] {
    const dctx = dctxRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!dctx || !drawCanvas) return [];
    const dpr = dprRef.current;
    const px = Math.max(0, Math.min(drawCanvas.width - 1, Math.round(xCss * dpr)));

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
  }

  /* ---------------- voice matching per frame ---------------- */
  function updateVoices(intersections: Intersection[]) {
    if (!actxRef.current) return;
    const actx = actxRef.current;
    const claimed = new Set<number>();
    const tolLog = Math.log2(MATCH_TOLERANCE);

    for (const it of intersections) {
      let best: Voice | null = null;
      let bestDist = Infinity;
      for (const v of voicesRef.current) {
        if (v.releasing || claimed.has(v.id)) continue;
        const dist = Math.abs(Math.log2(v.freq / it.freq));
        if (dist < bestDist) {
          bestDist = dist;
          best = v;
        }
      }
      if (best && bestDist <= tolLog) {
        claimed.add(best.id);
        best.missed = 0;
        best.freq = it.freq;
        best.osc.frequency.setTargetAtTime(it.freq, actx.currentTime, 0.06);
      } else {
        if (voicesRef.current.length >= MAX_VOICES) {
          const victim = voicesRef.current.reduce((a, b) => (a.missed >= b.missed ? a : b));
          releaseVoice(victim);
        }
        const nv = spawnVoice(it.freq);
        claimed.add(nv.id);
      }
    }

    for (const v of voicesRef.current.slice()) {
      if (claimed.has(v.id)) continue;
      v.missed++;
      if (v.missed > RELEASE_MISS_FRAMES) releaseVoice(v);
    }
  }

  /* ---------------- overlay rendering ---------------- */
  function drawOverlay(intersections: Intersection[]) {
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
  }

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

      const intersections = hasDrawnRef.current ? getIntersections(currentScannerXRef.current) : [];
      updateVoices(intersections);
      drawOverlay(intersections);
      setVoiceCount(voicesRef.current.filter((v) => !v.releasing).length);
    }
    rafIdRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  /* ---------------- UI handlers ---------------- */
  function handlePlayClick() {
    ensureAudio();
    const actx = actxRef.current!;
    if (actx.state === "suspended") actx.resume();
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        startTimeRef.current = null;
      } else {
        octxRef.current?.clearRect(0, 0, sizeRef.current.w, sizeRef.current.h);
        stopAllVoices(true);
      }
      return next;
    });
  }

  function handleClear() {
    const dctx = dctxRef.current;
    const { w, h } = sizeRef.current;
    dctx?.clearRect(0, 0, w, h);
    setHasDrawn(false);
    stopAllVoices(true);
  }

  const WAVES: { id: Waveform; label: string }[] = [
    { id: "sine", label: "bell" },
    { id: "triangle", label: "flute" },
    { id: "sawtooth", label: "synth" },
    { id: "square", label: "chip" },
  ];
  const SCALES: { id: ScaleMode; label: string }[] = [
    { id: "pentatonic", label: "pentatonic" },
    { id: "major", label: "major" },
    { id: "free", label: "free" },
  ];

  return (
    <div style={styles.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
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

      <header style={styles.header}>
        <div style={styles.title}>
          draw the <b style={styles.titleAccent}>sound</b>
        </div>
        <div style={styles.tagline}>geometry becomes music</div>
      </header>

      <div ref={stageRef} style={styles.stage}>
        <canvas ref={drawCanvasRef} style={{ ...styles.canvasBase, filter: "drop-shadow(0 0 6px rgba(242,184,128,0.55))" }} />
        <canvas ref={overlayCanvasRef} style={{ ...styles.canvasBase, pointerEvents: "none" }} />

        {!hasDrawn && (
          <div style={styles.hint}>
            <svg width="140" height="50" viewBox="0 0 140 50" fill="none" style={{ opacity: 0.35 }}>
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

      <footer style={styles.footer}>
        <button onClick={handlePlayClick} style={styles.playBtn} aria-label="Play or pause" title="Play / Pause">
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

        <button onClick={handleClear} style={styles.clearBtn}>
          clear
        </button>

        <div style={styles.group}>
          <span style={styles.groupLabel}>tone</span>
          <div style={styles.seg}>
            {WAVES.map((w, i) => (
              <button
                key={w.id}
                className="dts-seg-btn"
                onClick={() => setWaveform(w.id)}
                style={{
                  ...styles.segBtn,
                  ...(i < WAVES.length - 1 ? styles.segBtnBorder : {}),
                  ...(waveform === w.id ? styles.segBtnActiveTeal : {}),
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.group}>
          <span style={styles.groupLabel}>scale</span>
          <div style={styles.seg}>
            {SCALES.map((s, i) => (
              <button
                key={s.id}
                className="dts-seg-btn"
                onClick={() => setScaleMode(s.id)}
                style={{
                  ...styles.segBtn,
                  ...(i < SCALES.length - 1 ? styles.segBtnBorder : {}),
                  ...(scaleMode === s.id ? styles.segBtnActiveTeal : {}),
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

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
          {voiceCount} <b style={{ color: "#7dd3c0", fontWeight: 600 }}>{voiceCount === 1 ? "voice" : "voices"}</b>
        </div>
      </footer>
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
    background: "linear-gradient(180deg, rgba(255,255,255,0.015), transparent 40%), #111320",
    border: "1px solid rgba(242,184,128,0.12)",
    boxShadow: "0 40px 80px -40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
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
    background: "linear-gradient(180deg, rgba(242,184,128,0.16), rgba(242,184,128,0.05))",
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