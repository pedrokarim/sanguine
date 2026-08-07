/**
 * Moteur audio entièrement synthétisé (Web Audio API). Aucun fichier n'est expédié.
 *
 * Trois garde-fous, tous indispensables dans un survivor-like où 300 événements peuvent
 * survenir dans la même frame :
 *   1. plafond de voix simultanées ;
 *   2. anti-empilement par effet (un même son ne se déclenche qu'à intervalle minimal) ;
 *   3. compresseur en sortie, qui rattrape les pics résiduels.
 */

const MAX_VOICES = 24;
const THROTTLE_MS = 30;

type OscType = OscillatorType;

class Engine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private comp!: DynamicsCompressorNode;

  private voices = 0;
  private lastPlayed = new Map<string, number>();

  private noiseBuffer: AudioBuffer | null = null;

  masterVol = 0.8;
  sfxVol = 0.7;
  musicVol = 0.45;
  muted = false;

  // -- Musique -------------------------------------------------------------
  private musicTimer = 0;
  private nextNoteTime = 0;
  private step = 0;
  /** Intensité ∈ [0,1], pilote le tempo et les couches actives. */
  intensity = 0;
  private bossMode = false;
  private musicOn = false;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Doit être appelé depuis un geste utilisateur (politique d'autoplay des navigateurs). */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    this.ctx = ctx;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 20;
    this.comp.ratio.value = 8;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.2;

    this.master = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();

    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.comp);
    this.comp.connect(ctx.destination);
    this.applyVolumes();

    // Buffer de bruit blanc, réutilisé par tous les effets percussifs.
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    void ctx.resume();
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    const m = this.muted ? 0 : this.masterVol;
    this.master.gain.value = m;
    this.sfxBus.gain.value = this.sfxVol;
    this.musicBus.gain.value = this.musicVol;
  }

  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  private canPlay(key: string): boolean {
    if (!this.ctx || this.muted) return false;
    if (this.voices >= MAX_VOICES) return false;
    const now = performance.now();
    const last = this.lastPlayed.get(key) ?? -1e9;
    if (now - last < THROTTLE_MS) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  private track(node: AudioScheduledSourceNode, stopAt: number): void {
    this.voices++;
    node.onended = (): void => {
      this.voices--;
    };
    node.stop(stopAt);
  }

  // ------------------------------------------------------------ primitives

  /** Oscillateur avec enveloppe percussive. */
  private blip(
    freq: number,
    dur: number,
    type: OscType,
    gain: number,
    bus: GainNode,
    detune = 0,
    freqEnd?: number,
  ): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    osc.detune.value = detune;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.008, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    this.track(osc, t + dur + 0.02);
  }

  /** Bruit filtré – impacts, explosions, souffle. */
  private noise(
    dur: number,
    gain: number,
    bus: GainNode,
    filterType: BiquadFilterType,
    cutoff: number,
    cutoffEnd?: number,
  ): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(cutoff, t);
    if (cutoffEnd !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(40, cutoffEnd), t + dur);
    f.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t);
    this.track(src, t + dur + 0.02);
  }

  /** Sinus descendant + clic : grosse caisse, explosion, impact lourd. */
  private thump(f0: number, f1: number, dur: number, gain: number, bus: GainNode): void {
    this.blip(f0, dur, 'sine', gain, bus, 0, f1);
  }

  // --------------------------------------------------------------- effets

  play(name: SfxName, pitch = 1): void {
    if (!this.canPlay(name)) return;
    const bus = this.sfxBus;
    const d = (v: number): number => (Math.random() * 2 - 1) * v;

    switch (name) {
      case 'shoot':
        this.blip(900 * pitch, 0.06, 'square', 0.09, bus, d(50), 380 * pitch);
        break;
      case 'shootHeavy':
        this.blip(420 * pitch, 0.12, 'sawtooth', 0.11, bus, d(40), 150);
        this.noise(0.05, 0.05, bus, 'highpass', 1800);
        break;
      case 'swing':
        this.noise(0.14, 0.10, bus, 'bandpass', 1400, 500);
        break;
      case 'hit':
        this.noise(0.045, 0.075, bus, 'highpass', 2200);
        break;
      case 'crit':
        this.noise(0.05, 0.09, bus, 'highpass', 2600);
        this.blip(1400, 0.09, 'square', 0.07, bus, d(30), 900);
        break;
      case 'kill':
        this.thump(170, 60, 0.09, 0.09, bus);
        this.noise(0.06, 0.05, bus, 'lowpass', 1200);
        break;
      case 'killHeavy':
        this.thump(95, 38, 0.22, 0.16, bus);
        this.noise(0.18, 0.09, bus, 'lowpass', 700);
        break;
      case 'hurt':
        this.noise(0.19, 0.20, bus, 'lowpass', 700, 200);
        this.thump(80, 45, 0.26, 0.19, bus);
        break;
      case 'gem':
        this.blip(880 * pitch, 0.045, 'square', 0.055, bus, d(20));
        break;
      case 'gold':
        this.blip(1180, 0.07, 'triangle', 0.06, bus, d(60));
        this.blip(1580, 0.06, 'triangle', 0.045, bus, d(60));
        break;
      case 'heal':
        this.blip(523, 0.35, 'sine', 0.07, bus);
        this.blip(659, 0.35, 'sine', 0.055, bus);
        this.blip(784, 0.4, 'sine', 0.045, bus);
        break;
      case 'levelup':
        [523, 659, 784, 1046, 1318].forEach((f, i) => {
          setTimeout(() => {
            if (this.ctx) this.blip(f, 0.3, 'triangle', 0.085, bus);
          }, i * 62);
        });
        this.duck();
        break;
      case 'chest':
        this.noise(0.5, 0.07, bus, 'bandpass', 380, 1500);
        [392, 523, 659, 784].forEach((f, i) => {
          setTimeout(() => {
            if (this.ctx) this.blip(f, 0.4, 'square', 0.06, bus);
          }, 220 + i * 75);
        });
        this.duck();
        break;
      case 'relic':
        [659, 988, 1318].forEach((f, i) => {
          setTimeout(() => {
            if (this.ctx) this.blip(f, 0.7, 'sine', 0.08, bus);
          }, i * 55);
        });
        this.duck();
        break;
      case 'relicCursed':
        this.blip(110, 1.0, 'sawtooth', 0.10, bus);
        this.blip(155.6, 0.9, 'sawtooth', 0.07, bus); // triton : dissonance volontaire
        this.blip(55, 1.2, 'sine', 0.12, bus);
        this.duck();
        break;
      case 'evolve':
        [440, 554, 659, 880, 1108, 1318].forEach((f, i) => {
          setTimeout(() => {
            if (this.ctx) this.blip(f, 0.5, 'sawtooth', 0.07, bus);
          }, i * 48);
        });
        this.duck();
        break;
      case 'boss':
        this.blip(40, 2.2, 'sine', 0.22, bus);
        this.blip(60, 2.0, 'sawtooth', 0.09, bus);
        this.blip(89, 1.8, 'sawtooth', 0.06, bus);
        this.noise(1.6, 0.06, bus, 'lowpass', 300);
        this.duck(1.4);
        break;
      case 'bossDie':
        [523, 494, 440, 392, 349, 294, 262].forEach((f, i) => {
          setTimeout(() => {
            if (this.ctx) this.blip(f, 0.28, 'sawtooth', 0.09, bus);
          }, i * 90);
        });
        setTimeout(() => {
          if (this.ctx) {
            this.thump(120, 30, 0.9, 0.22, bus);
            this.noise(0.8, 0.16, bus, 'lowpass', 900, 150);
          }
        }, 640);
        this.duck(2);
        break;
      case 'explode':
        this.noise(0.42, 0.20, bus, 'lowpass', 2600, 180);
        this.thump(140, 34, 0.42, 0.17, bus);
        break;
      case 'nova':
        this.blip(220, 0.3, 'sine', 0.09, bus, 0, 900);
        this.noise(0.24, 0.07, bus, 'bandpass', 900, 3000);
        break;
      case 'zap':
        this.noise(0.12, 0.11, bus, 'highpass', 3200);
        this.blip(2400, 0.09, 'square', 0.05, bus, d(200), 600);
        break;
      case 'fire':
        this.noise(0.3, 0.045, bus, 'bandpass', 700, 260);
        break;
      case 'select':
        this.blip(660, 0.035, 'square', 0.045, bus);
        break;
      case 'confirm':
        this.blip(880, 0.06, 'square', 0.06, bus);
        this.blip(1760, 0.09, 'square', 0.035, bus);
        break;
      case 'deny':
        this.blip(180, 0.14, 'square', 0.06, bus, 0, 110);
        break;
      case 'death':
        this.stopMusic();
        [294, 349, 440].forEach((f) => this.blip(f, 2.6, 'sine', 0.1, bus));
        this.blip(147, 3.0, 'sine', 0.14, bus);
        this.noise(2.4, 0.05, bus, 'lowpass', 900, 90);
        break;
      case 'victory':
        [523, 659, 784, 1046].forEach((f, i) => {
          setTimeout(() => {
            if (this.ctx) {
              this.blip(f, 0.9, 'triangle', 0.1, bus);
              this.blip(f * 2, 0.7, 'sine', 0.05, bus);
            }
          }, i * 150);
        });
        break;
      case 'unlock':
        [392, 523, 784].forEach((f, i) => {
          setTimeout(() => {
            if (this.ctx) this.blip(f, 0.6, 'triangle', 0.09, bus);
          }, i * 110);
        });
        break;
    }
  }

  /** Baisse temporairement la musique pour laisser passer un événement important. */
  private duck(seconds = 0.9): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.musicBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(this.musicVol, t);
    g.linearRampToValueAtTime(this.musicVol * 0.45, t + 0.06);
    g.linearRampToValueAtTime(this.musicVol, t + seconds);
  }

  // -------------------------------------------------------------- musique

  startMusic(): void {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 25);
  }

  stopMusic(): void {
    this.musicOn = false;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = 0;
    }
  }

  setBossMode(on: boolean): void {
    this.bossMode = on;
  }

  /**
   * Séquenceur à lookahead : on programme les notes ~120 ms à l'avance sur l'horloge audio,
   * ce qui rend le rythme insensible aux hoquets de la boucle de rendu.
   */
  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn) return;

    const bpm = 84 + this.intensity * 48;
    const stepDur = 60 / bpm / 2; // doubles-croches → croches

    while (this.nextNoteTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % 32;
    }
  }

  private playStep(step: number, when: number, dur: number): void {
    const ctx = this.ctx!;
    const bus = this.musicBus;
    const I = this.intensity;
    const bar = Math.floor(step / 8);

    // Ré mineur : Dm – Bb – F – A7. Le A7 final laisse une tension non résolue.
    const roots = [146.83, 116.54, 174.61, 110.0];
    const chords = [
      [146.83, 174.61, 220.0],
      [116.54, 146.83, 174.61],
      [174.61, 220.0, 261.63],
      [110.0, 138.59, 164.81, 196.0],
    ];
    const root = roots[bar]!;
    const chord = chords[bar]!;

    const at = (
      freq: number,
      d: number,
      type: OscType,
      gain: number,
      detune = 0,
    ): void => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(gain, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, when + d);
      osc.connect(g);
      g.connect(bus);
      osc.start(when);
      osc.stop(when + d + 0.02);
    };

    // Couche 1 – bourdon (toujours actif)
    if (step % 8 === 0) {
      at(root / 2, dur * 8, 'sine', 0.10);
      at(root, dur * 8, 'triangle', 0.035);
    }

    // Couche 2 – pouls
    if (I > 0.15 && step % 4 === 0) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, when);
      osc.frequency.exponentialRampToValueAtTime(38, when + 0.16);
      g.gain.setValueAtTime(0.14 * Math.min(1, I * 1.6), when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
      osc.connect(g);
      g.connect(bus);
      osc.start(when);
      osc.stop(when + 0.2);
    }

    // Couche 3 – arpège
    if (I > 0.35) {
      const pattern = [0, 2, 1, 2, 0, 1, 2, 1];
      const n = chord[pattern[step % 8]! % chord.length]!;
      at(n * 2, dur * 1.6, 'triangle', 0.045 * Math.min(1, (I - 0.35) * 3));
    }

    // Couche 4 – contrechant
    if (I > 0.6 && step % 8 === 4) {
      at(chord[1]! * 2, dur * 5, 'sine', 0.05);
    }

    // Couche 5 – cuivres
    if (I > 0.8 && step % 16 === 0) {
      for (const f of chord) at(f, dur * 10, 'sawtooth', 0.022, -6);
    }

    // Couche boss – chœur d'oscillateurs désaccordés
    if (this.bossMode && step % 8 === 0) {
      for (const det of [-14, 0, 14]) at(root * 2, dur * 8, 'sawtooth', 0.03, det);
      at(root / 2, dur * 8, 'square', 0.05);
    }
  }
}

export type SfxName =
  | 'shoot'
  | 'shootHeavy'
  | 'swing'
  | 'hit'
  | 'crit'
  | 'kill'
  | 'killHeavy'
  | 'hurt'
  | 'gem'
  | 'gold'
  | 'heal'
  | 'levelup'
  | 'chest'
  | 'relic'
  | 'relicCursed'
  | 'evolve'
  | 'boss'
  | 'bossDie'
  | 'explode'
  | 'nova'
  | 'zap'
  | 'fire'
  | 'select'
  | 'confirm'
  | 'deny'
  | 'death'
  | 'victory'
  | 'unlock';

export const audio = new Engine();
