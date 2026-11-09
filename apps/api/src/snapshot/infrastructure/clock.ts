import type { Clock } from '../application/ports.js';

export const systemClock = (): Clock => ({ now: () => new Date() });

/** Starts at `anchor` and keeps ticking in real time, so the dataset cut behaves like "now" and new fills land after it. */
export const anchoredClock = (anchor: Date): Clock => {
  const offsetMs = anchor.getTime() - Date.now();
  return { now: () => new Date(Date.now() + offsetMs) };
};
