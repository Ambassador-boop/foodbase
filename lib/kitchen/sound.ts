/**
 * The kitchen alert tone (Batch 3C).
 *
 * Synthesised with the Web Audio API rather than shipped as an audio file. Three
 * reasons: there is nothing to download on a slow kitchen connection, there is no
 * licence to track, and the envelope can be shaped so the tone cuts through a
 * range hood without being a klaxon.
 *
 * Browsers refuse to start an AudioContext before a user gesture, so nothing here
 * makes noise until `primeKitchenAudio()` has been called from a real tap. The
 * board's start screen exists exactly for that tap.
 *
 * Voice: a bright two-partial bell (fundamental plus a quieter octave) on A5, C#6,
 * E6 — a rising major triad, which reads as "order in" rather than as an alarm.
 */

export type KitchenAlertUrgency = 'new' | 'repeat' | 'test';

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!ctor) return null;
  if (!context || context.state === 'closed') {
    try {
      context = new ctor();
    } catch {
      return null;
    }
  }
  return context;
}

export function kitchenAudioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext,
  );
}

/**
 * Call from a real tap. Returns true when audio is ready to play, false when the
 * browser has no Web Audio or refused to resume.
 */
export async function primeKitchenAudio(): Promise<boolean> {
  const ctx = getContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    // A silent, zero-length buffer during the gesture is the most reliable way to
    // unlock iOS Safari for later playback.
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

function bell(
  ctx: AudioContext,
  at: number,
  frequency: number,
  duration: number,
  level: number,
): void {
  const fundamental = ctx.createOscillator();
  const octave = ctx.createOscillator();
  const fundamentalGain = ctx.createGain();
  const octaveGain = ctx.createGain();
  const master = ctx.createGain();

  fundamental.type = 'triangle';
  octave.type = 'sine';
  fundamental.frequency.setValueAtTime(frequency, at);
  octave.frequency.setValueAtTime(frequency * 2, at);

  fundamentalGain.gain.setValueAtTime(0, at);
  fundamentalGain.gain.linearRampToValueAtTime(level, at + 0.012);
  fundamentalGain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  octaveGain.gain.setValueAtTime(0, at);
  octaveGain.gain.linearRampToValueAtTime(level * 0.34, at + 0.01);
  octaveGain.gain.exponentialRampToValueAtTime(0.0001, at + duration * 0.7);

  master.gain.value = 1;

  fundamental.connect(fundamentalGain).connect(master);
  octave.connect(octaveGain).connect(master);
  master.connect(ctx.destination);

  fundamental.start(at);
  octave.start(at);
  fundamental.stop(at + duration + 0.02);
  octave.stop(at + duration + 0.02);
}

const A5 = 880;
const CS6 = 1108.73;
const E6 = 1318.51;

/**
 * Plays the alert. `volume` is 0–1 from the device settings; the ceiling is 0.22
 * because a tablet at full system volume plus a full-scale oscillator is unkind.
 */
export function playKitchenAlert(options: { urgency?: KitchenAlertUrgency; volume?: number } = {}): boolean {
  const ctx = getContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  const urgency = options.urgency ?? 'new';
  const volume = Math.min(1, Math.max(0, options.volume ?? 0.7));
  if (volume <= 0) return false;
  const level = 0.22 * volume;
  const now = ctx.currentTime + 0.02;

  if (urgency === 'test') {
    bell(ctx, now, A5, 0.24, level);
    return true;
  }
  if (urgency === 'repeat') {
    // Two clearly separated pairs: insistent, still short.
    bell(ctx, now, A5, 0.2, level);
    bell(ctx, now + 0.22, E6, 0.2, level);
    bell(ctx, now + 0.9, A5, 0.2, level);
    bell(ctx, now + 1.12, E6, 0.2, level);
    return true;
  }
  bell(ctx, now, A5, 0.26, level);
  bell(ctx, now + 0.2, CS6, 0.26, level);
  bell(ctx, now + 0.4, E6, 0.34, level);
  return true;
}

/** Exposed for the "sound needs a tap" fallback banner on the orders page. */
export function kitchenAudioState(): string {
  const ctx = getContext();
  return ctx ? ctx.state : 'unavailable';
}
