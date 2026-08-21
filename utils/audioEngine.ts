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

  public updateWaveform(): void {
    this.stopAllVoices(true);
  }

  public spawnVoice(freq: number, waveform: Waveform): Voice | null {
    if (!this.actx || !this.master) return null;
    const now = this.actx.currentTime;

    const osc = this.actx.createOscillator();
    const gain = this.actx.createGain();
    gain.gain.value = 0.0001;

    let osc2: OscillatorNode | undefined;
    let gain2: GainNode | undefined;

    if (waveform === "sine") {
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.gain.setTargetAtTime(0.24, now, 0.015);
    } else if (waveform === "triangle") {
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.gain.setTargetAtTime(0.24, now, 0.015);
    } else if (waveform === "sawtooth") {
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.gain.setTargetAtTime(0.18, now, 0.015);
    } else if (waveform === "square") {
      osc.type = "square";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.gain.setTargetAtTime(0.16, now, 0.015);
    } else if (waveform === "arcade") {
      // 8-Bit Retro Pulse
      osc.type = "square";
      osc.frequency.value = freq;

      osc2 = this.actx.createOscillator();
      osc2.type = "square";
      osc2.frequency.value = freq * 1.005;

      gain2 = this.actx.createGain();
      gain2.gain.value = 0.1;
      osc2.connect(gain2);
      gain2.connect(gain);

      osc.connect(gain);
      osc2.start(now);
      gain.gain.setTargetAtTime(0.18, now, 0.01);
    } else if (waveform === "organ") {
      // Light Blue Organ (Fundamental + 2.0x drawbar octave)
      osc.type = "sine";
      osc.frequency.value = freq;

      osc2 = this.actx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = freq * 2.0;

      gain2 = this.actx.createGain();
      gain2.gain.value = 0.18;
      osc2.connect(gain2);
      gain2.connect(gain);

      osc.connect(gain);
      osc2.start(now);
      gain.gain.setTargetAtTime(0.22, now, 0.02);
    } else if (waveform === "crystal") {
      // Dark Blue Glass Crystal (Fundamental + 2.76x metallic glass chime overtone)
      osc.type = "sine";
      osc.frequency.value = freq;

      osc2 = this.actx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = freq * 2.76;

      gain2 = this.actx.createGain();
      gain2.gain.value = 0.22;
      osc2.connect(gain2);
      gain2.connect(gain);

      osc.connect(gain);
      osc2.start(now);
      gain.gain.setTargetAtTime(0.26, now, 0.008);
    } else {
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.gain.setTargetAtTime(0.22, now, 0.02);
    }

    gain.connect(this.master);
    osc.start(now);

    const v: Voice = {
      id: this.voiceId++,
      freq,
      waveform,
      osc,
      osc2,
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
        if (v.osc2) {
          v.osc2.stop();
          v.osc2.disconnect();
        }
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

  public updateVoices(
    intersections: Intersection[],
    fallbackWaveform: Waveform
  ): void {
    if (!this.actx) return;
    const claimed = new Set<number>();
    const tolLog = Math.log2(MATCH_TOLERANCE);

    for (const it of intersections) {
      let best: Voice | null = null;
      let bestDist = Infinity;
      const targetWave = it.waveform || fallbackWaveform;

      for (const v of this.voices) {
        if (v.releasing || claimed.has(v.id)) continue;
        if (v.waveform !== targetWave) continue;
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
        best.osc.frequency.setTargetAtTime(
          it.freq,
          this.actx.currentTime,
          0.06
        );

        if (best.osc2) {
          let mult = 1.0;
          if (targetWave === "arcade") mult = 1.005;
          else if (targetWave === "organ") mult = 2.0;
          else if (targetWave === "crystal") mult = 2.76;
          best.osc2.frequency.setTargetAtTime(
            it.freq * mult,
            this.actx.currentTime,
            0.06
          );
        }
      } else {
        if (this.voices.length >= MAX_VOICES) {
          const victim = this.voices.reduce((a, b) =>
            a.missed >= b.missed ? a : b
          );
          this.releaseVoice(victim);
        }
        const nv = this.spawnVoice(it.freq, targetWave);
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
