import { Waveform, Voice, Intersection } from "@/types/audio";
import {
  MAX_VOICES,
  RELEASE_MISS_FRAMES,
  MATCH_TOLERANCE,
} from "@/constants/audio";

export class AudioEngine {
  private actx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private voices: Voice[] = [];
  private voiceId = 0;

  public ensureAudio(): void {
    if (this.actx) return;
    const AC =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        : null;
    if (!AC) return;
    const actx = new AC();
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

    this.actx = actx;
    this.compressor = compressor;
    this.master = master;
  }

  public unlockAudio(): void {
    this.ensureAudio();
    if (!this.actx) return;
    if (this.actx.state === "suspended") {
      this.actx.resume().catch(() => {});
    }
    try {
      const buffer = this.actx.createBuffer(1, 1, 22050);
      const source = this.actx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.actx.destination);
      source.start(0);
    } catch {
      /* no-op */
    }
  }

  public updateWaveform(waveform: Waveform): void {
    this.voices.forEach((v) => {
      try {
        v.osc.type = waveform;
      } catch {
        /* voice already stopped */
      }
    });
  }

  public spawnVoice(freq: number, waveform: Waveform): Voice | null {
    if (!this.actx || !this.master) return null;
    const osc = this.actx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = freq;
    const gain = this.actx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    const now = this.actx.currentTime;
    gain.gain.setTargetAtTime(0.22, now, 0.02);
    const v: Voice = {
      id: this.voiceId++,
      freq,
      osc,
      gain,
      missed: 0,
      releasing: false,
    };
    this.voices.push(v);
    return v;
  }

  public releaseVoice(v: Voice): void {
    if (v.releasing) return;
    v.releasing = true;
    if (this.actx) {
      const now = this.actx.currentTime;
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
      this.voices = this.voices.filter((x) => x.id !== v.id);
    }, 400);
  }

  public stopAllVoices(instant: boolean): void {
    this.voices.slice().forEach((v) => {
      if (instant && this.actx) {
        try {
          v.gain.gain.cancelScheduledValues(this.actx.currentTime);
          v.gain.gain.setTargetAtTime(0.0001, this.actx.currentTime, 0.03);
        } catch {
          /* no-op */
        }
      }
      this.releaseVoice(v);
    });
  }

  public updateVoices(intersections: Intersection[], waveform: Waveform): void {
    if (!this.actx) return;
    const claimed = new Set<number>();
    const tolLog = Math.log2(MATCH_TOLERANCE);

    for (const it of intersections) {
      let best: Voice | null = null;
      let bestDist = Infinity;
      for (const v of this.voices) {
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
        best.osc.frequency.setTargetAtTime(it.freq, this.actx.currentTime, 0.06);
      } else {
        if (this.voices.length >= MAX_VOICES) {
          const victim = this.voices.reduce((a, b) =>
            a.missed >= b.missed ? a : b
          );
          this.releaseVoice(victim);
        }
        const nv = this.spawnVoice(it.freq, waveform);
        if (nv) claimed.add(nv.id);
      }
    }

    for (const v of this.voices.slice()) {
      if (claimed.has(v.id)) continue;
      v.missed++;
      if (v.missed > RELEASE_MISS_FRAMES) this.releaseVoice(v);
    }
  }

  public getActiveVoiceCount(): number {
    return this.voices.filter((v) => !v.releasing).length;
  }
}
