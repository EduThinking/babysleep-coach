/**
 * In-browser sleep sound engine (Web Audio API).
 * Most sounds are generated procedurally; sounds with a `src` stream an audio file
 * through the same graph, so volume, fade-in/out and the sleep timer behave the same.
 */
import { soundById } from "../data/sounds";

type Stopper = () => void;

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// [midi note, beats]; 0 = rest
const TWINKLE: [number, number][] = [
  [72, 1], [72, 1], [79, 1], [79, 1], [81, 1], [81, 1], [79, 2],
  [77, 1], [77, 1], [76, 1], [76, 1], [74, 1], [74, 1], [72, 2],
  [79, 1], [79, 1], [77, 1], [77, 1], [76, 1], [76, 1], [74, 2],
  [79, 1], [79, 1], [77, 1], [77, 1], [76, 1], [76, 1], [74, 2],
  [72, 1], [72, 1], [79, 1], [79, 1], [81, 1], [81, 1], [79, 2],
  [77, 1], [77, 1], [76, 1], [76, 1], [74, 1], [74, 1], [72, 2], [0, 2],
];
const BRAHMS: [number, number][] = [
  [64, 0.5], [64, 0.5], [67, 2], [64, 0.5], [64, 0.5], [67, 2],
  [64, 0.5], [67, 0.5], [72, 1], [71, 1.5], [69, 0.5], [69, 1], [67, 1],
  [62, 0.5], [64, 0.5], [65, 1], [62, 1], [62, 0.5], [64, 0.5], [65, 2],
  [62, 0.5], [65, 0.5], [71, 0.5], [69, 0.5], [67, 1], [71, 1], [72, 3], [0, 2],
];
// a simple original pentatonic hum
const SOFT: [number, number][] = [
  [67, 2], [69, 1], [67, 1], [64, 2], [62, 2], [64, 2], [67, 1], [64, 1], [62, 4],
  [60, 2], [62, 1], [64, 1], [67, 2], [64, 2], [62, 2], [64, 1], [62, 1], [60, 4], [0, 2],
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private stopCurrent: Stopper | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private volume = 0.45;
  private fadeTimer: number | null = null;

  private ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return { ctx: this.ctx, master: this.master! };
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1);
  }

  private noise(kind: "white" | "pink" | "brown") {
    const { ctx } = this.ensure();
    if (this.buffers[kind]) return this.buffers[kind];
    const len = ctx.sampleRate * 8;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === "white") d[i] = w * 0.35;
        else if (kind === "pink") {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.09;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.2;
        }
      }
      // crossfade the loop seam
      const fade = Math.floor(ctx.sampleRate * 0.05);
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        d[len - fade + i] = d[len - fade + i] * (1 - t) + d[i] * t;
      }
    }
    this.buffers[kind] = buf;
    return buf;
  }

  private loopSource(kind: "white" | "pink" | "brown") {
    const { ctx } = this.ensure();
    const src = ctx.createBufferSource();
    src.buffer = this.noise(kind);
    src.loop = true;
    return src;
  }

  private lfo(freq: number, depth: number, target: AudioParam) {
    const { ctx } = this.ensure();
    const o = ctx.createOscillator();
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
    return o;
  }

  play(id: string) {
    const { ctx, master } = this.ensure();
    this.stop(0.25);
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(this.volume, ctx.currentTime);
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.6); // gentle fade-in
    out.connect(master);
    const nodes: (AudioScheduledSourceNode)[] = [];
    const timers: number[] = [];
    const cleanups: (() => void)[] = [];

    const start = (n: AudioScheduledSourceNode) => {
      n.start();
      nodes.push(n);
    };

    const file = soundById(id)?.src;
    if (file) {
      // stream instead of decoding: a few minutes of decoded audio is tens of MB on a phone
      const el = new Audio(file);
      el.loop = true;
      el.preload = "auto";
      const node = ctx.createMediaElementSource(el);
      node.connect(out);
      el.play().catch((err) => console.warn("[sound] could not play", file, err));
      cleanups.push(() => {
        el.pause();
        el.removeAttribute("src");
        el.load();
        node.disconnect();
      });
    }

    switch (id) {
      case "white":
      case "pink":
      case "brown": {
        const s = this.loopSource(id);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = id === "white" ? 9000 : 6000;
        s.connect(lp).connect(out);
        start(s);
        break;
      }
      case "rain": {
        const s = this.loopSource("pink");
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 500;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 7000;
        const g = ctx.createGain();
        g.gain.value = 0.9;
        s.connect(hp).connect(lp).connect(g).connect(out);
        start(s);
        // droplets
        const d = this.loopSource("white");
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 3200;
        bp.Q.value = 1.5;
        const dg = ctx.createGain();
        dg.gain.value = 0;
        d.connect(bp).connect(dg).connect(out);
        start(d);
        timers.push(
          window.setInterval(() => {
            const t = ctx.currentTime;
            for (let i = 0; i < 6; i++) {
              if (Math.random() < 0.5) continue;
              const at = t + Math.random() * 0.2;
              dg.gain.setValueAtTime(0.15 + Math.random() * 0.25, at);
              dg.gain.exponentialRampToValueAtTime(0.001, at + 0.03);
            }
          }, 200),
        );
        break;
      }
      case "waves": {
        const s = this.loopSource("brown");
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 800;
        const g = ctx.createGain();
        g.gain.value = 0.55;
        s.connect(lp).connect(g).connect(out);
        start(s);
        nodes.push(this.lfo(0.09, 0.45, g.gain), this.lfo(0.09, 400, lp.frequency));
        break;
      }
      case "wind": {
        const s = this.loopSource("white");
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 700;
        bp.Q.value = 0.8;
        const g = ctx.createGain();
        g.gain.value = 0.7;
        s.connect(bp).connect(g).connect(out);
        start(s);
        nodes.push(this.lfo(0.05, 350, bp.frequency), this.lfo(0.07, 0.3, g.gain));
        break;
      }
      case "forest": {
        const s = this.loopSource("pink");
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 1100;
        const g = ctx.createGain();
        g.gain.value = 0.6;
        s.connect(lp).connect(g).connect(out);
        start(s);
        nodes.push(this.lfo(0.06, 0.2, g.gain));
        timers.push(
          window.setInterval(() => {
            if (Math.random() > 0.35) return;
            const t = ctx.currentTime + 0.05;
            const base = 2400 + Math.random() * 1600;
            const n = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < n; i++) {
              const o = ctx.createOscillator();
              const og = ctx.createGain();
              const at = t + i * 0.16;
              o.frequency.setValueAtTime(base, at);
              o.frequency.exponentialRampToValueAtTime(base * 1.35, at + 0.09);
              og.gain.setValueAtTime(0.0001, at);
              og.gain.exponentialRampToValueAtTime(0.05, at + 0.02);
              og.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
              o.connect(og).connect(out);
              o.start(at);
              o.stop(at + 0.13);
            }
          }, 1500),
        );
        break;
      }
      case "heartbeat": {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 180;
        lp.connect(out);
        const thump = (at: number, level: number) => {
          const o = ctx.createOscillator();
          o.frequency.setValueAtTime(70, at);
          o.frequency.exponentialRampToValueAtTime(40, at + 0.12);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(level, at + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
          o.connect(g).connect(lp);
          o.start(at);
          o.stop(at + 0.2);
        };
        let next = ctx.currentTime + 0.1;
        const beat = 60 / 66;
        timers.push(
          window.setInterval(() => {
            while (next < ctx.currentTime + 0.5) {
              thump(next, 0.9);
              thump(next + 0.28, 0.55);
              next += beat;
            }
          }, 100),
        );
        // soft womb-like bed
        const s = this.loopSource("brown");
        const bg = ctx.createGain();
        bg.gain.value = 0.25;
        const blp = ctx.createBiquadFilter();
        blp.type = "lowpass";
        blp.frequency.value = 400;
        s.connect(blp).connect(bg).connect(out);
        start(s);
        break;
      }
      case "musicbox":
      case "brahms":
      case "soft": {
        const melody = id === "musicbox" ? TWINKLE : id === "brahms" ? BRAHMS : SOFT;
        const bpm = id === "musicbox" ? 84 : id === "brahms" ? 66 : 56;
        const beat = 60 / bpm;
        const verb = ctx.createGain();
        verb.gain.value = 0.9;
        const delay = ctx.createDelay();
        delay.delayTime.value = 0.28;
        const fb = ctx.createGain();
        fb.gain.value = 0.28;
        verb.connect(out);
        verb.connect(delay);
        delay.connect(fb).connect(delay);
        delay.connect(out);
        const note = (midi: number, at: number, dur: number) => {
          const f = midiHz(midi);
          const g = ctx.createGain();
          g.connect(verb);
          if (id === "musicbox") {
            [1, 2.01, 4.1].forEach((mult, i) => {
              const o = ctx.createOscillator();
              o.type = "sine";
              o.frequency.value = f * mult;
              const og = ctx.createGain();
              og.gain.value = [0.22, 0.06, 0.02][i];
              o.connect(og).connect(g);
              o.start(at);
              o.stop(at + 1.6);
            });
            g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(1, at + 0.005);
            g.gain.exponentialRampToValueAtTime(0.0001, at + 1.5);
          } else if (id === "brahms") {
            const lp = ctx.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.value = 2200;
            lp.connect(g);
            ["triangle", "sine"].forEach((type, i) => {
              const o = ctx.createOscillator();
              o.type = type as OscillatorType;
              o.frequency.value = f * (i ? 2 : 1);
              const og = ctx.createGain();
              og.gain.value = i ? 0.05 : 0.22;
              o.connect(og).connect(lp);
              o.start(at);
              o.stop(at + dur + 1.4);
            });
            g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(1, at + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 1.2);
          } else {
            [0, 4].forEach((cents) => {
              const o = ctx.createOscillator();
              o.type = "sine";
              o.frequency.value = f;
              o.detune.value = cents;
              o.connect(g);
              o.start(at);
              o.stop(at + dur + 0.8);
            });
            g.gain.setValueAtTime(0.0001, at);
            g.gain.linearRampToValueAtTime(0.16, at + 0.25);
            g.gain.setValueAtTime(0.16, at + Math.max(0.3, dur - 0.1));
            g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.7);
          }
        };
        let idx = 0;
        let next = ctx.currentTime + 0.15;
        timers.push(
          window.setInterval(() => {
            while (next < ctx.currentTime + 0.4) {
              const [m, beats] = melody[idx];
              if (m) note(m, next, beats * beat);
              next += beats * beat;
              idx = (idx + 1) % melody.length;
            }
          }, 100),
        );
        break;
      }
    }

    this.stopCurrent = () => {
      timers.forEach((t) => clearInterval(t));
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 0.3);
      setTimeout(() => {
        nodes.forEach((n) => {
          try {
            n.stop();
          } catch {
            /* already stopped */
          }
        });
        cleanups.forEach((c) => c());
        out.disconnect();
      }, 400);
    };
  }

  /** stop with an optional fade-out (seconds) */
  stop(fadeSec = 0.3) {
    const stopper = this.stopCurrent;
    this.stopCurrent = null;
    if (!stopper) return;
    if (fadeSec <= 0.3 || !this.ctx || !this.master) return stopper();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + fadeSec);
    this.fadeTimer = window.setTimeout(() => {
      this.fadeTimer = null;
      stopper();
      this.master?.gain.setValueAtTime(this.volume, this.ctx!.currentTime + 0.5);
    }, fadeSec * 1000);
  }
}

export const soundEngine = new SoundEngine();
