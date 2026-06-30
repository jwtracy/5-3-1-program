import type { DayGroup, LiftKey } from "@/db/schema";

// ---------------------------------------------------------------------------
// Rotation — three workouts cycle a → b → c → a, trained every other day.
// ---------------------------------------------------------------------------

export const ROTATION: DayGroup[] = ["a", "b", "c", "d"];

export const WORKOUT_LABELS: Record<DayGroup, string> = {
  a: "Workout A",
  b: "Workout B",
  c: "Workout C",
  d: "Workout D",
};

/** Short hint of the main lift in each workout. */
export const WORKOUT_SUBTITLES: Record<DayGroup, string> = {
  a: "Bench / Rows",
  b: "Squat",
  c: "Deadlift",
  d: "Press",
};

/** True when `slot` is the last workout in the rotation (completes a 5/3/1 week). */
export function isLastSlot(slot: DayGroup): boolean {
  return slot === ROTATION[ROTATION.length - 1];
}

export function isDayGroup(value: string): value is DayGroup {
  return (ROTATION as string[]).includes(value);
}

/** The next workout in the rotation after `slot`. */
export function nextSlot(slot: DayGroup): DayGroup {
  const i = ROTATION.indexOf(slot);
  return ROTATION[(i + 1) % ROTATION.length];
}

// ---------------------------------------------------------------------------
// 5/3/1 — Wendler, percentages of the Training Max (TM = 90% of 1RM).
// The last work set each week is AMRAP ("+"). One full a→b→c rotation = one week.
// ---------------------------------------------------------------------------

export interface PrescribedSet {
  pct: number; // % of training max
  reps: number; // target reps (the AMRAP set's reps is a floor)
  isAmrap: boolean;
}

export const WEEK_LABELS: Record<number, string> = {
  1: "5s",
  2: "3s",
  3: "5/3/1",
  4: "Deload",
};

/** The set scheme for each 5/3/1 week (1–4). */
export const WEEK_SCHEME: Record<number, PrescribedSet[]> = {
  1: [
    { pct: 65, reps: 5, isAmrap: false },
    { pct: 75, reps: 5, isAmrap: false },
    { pct: 85, reps: 5, isAmrap: true },
  ],
  2: [
    { pct: 70, reps: 3, isAmrap: false },
    { pct: 80, reps: 3, isAmrap: false },
    { pct: 90, reps: 3, isAmrap: true },
  ],
  3: [
    { pct: 75, reps: 5, isAmrap: false },
    { pct: 85, reps: 3, isAmrap: false },
    { pct: 95, reps: 1, isAmrap: true },
  ],
  4: [
    { pct: 40, reps: 5, isAmrap: false },
    { pct: 50, reps: 5, isAmrap: false },
    { pct: 60, reps: 5, isAmrap: false },
  ],
};

/** Round to the nearest `step` (default 5 lb). */
export function roundTo(value: number, step = 5): number {
  return Math.round(value / step) * step;
}

/** Round UP to the nearest `step` (default 5 lb) — used for prescribed loads. */
export function roundUpTo(value: number, step = 5): number {
  return Math.ceil(value / step) * step;
}

export interface TargetSet {
  pct: number;
  reps: number;
  isAmrap: boolean;
  weight: number | null; // null when the training max isn't set yet
}

/**
 * The prescribed work sets for a main lift on a given 5/3/1 week.
 * `tm` is the training max; pass null/0 and weights come back null.
 */
export function prescription(week: number, tm: number | null): TargetSet[] {
  const scheme = WEEK_SCHEME[week] ?? WEEK_SCHEME[1];
  return scheme.map((s) => ({
    pct: s.pct,
    reps: s.reps,
    isAmrap: s.isAmrap,
    // Round prescribed bar weight UP to the nearest 5 lb (safe at a 90% TM).
    weight: tm && tm > 0 ? roundUpTo((tm * s.pct) / 100) : null,
  }));
}

// ---------------------------------------------------------------------------
// 1RM estimation — Epley (what 5/3/1 itself uses for the AMRAP estimate).
// ---------------------------------------------------------------------------

/** Estimated one-rep max from a set of `reps` at `weight` (Epley). */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * % of 1RM you can expect to lift for a given rep count (Epley inverse):
 * a set of `reps` reps is performed at 1 / (1 + reps/30) of your 1RM.
 */
export function pctOfMaxForReps(reps: number): number {
  return 100 / (1 + reps / 30);
}

/** Reps 1–12 → (%1RM, weight at that %) for the calculator's reference table. */
export function repPercentTable(
  oneRM: number,
): { reps: number; pct: number; weight: number }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const reps = i + 1;
    const pct = pctOfMaxForReps(reps);
    return { reps, pct, weight: roundTo((oneRM * pct) / 100) };
  });
}

export const LIFT_LABELS: Record<LiftKey, string> = {
  bench: "Bench Press",
  deadlift: "Deadlift",
  ohp: "Overhead Press",
  squat: "Squat",
  row: "Rows",
};
