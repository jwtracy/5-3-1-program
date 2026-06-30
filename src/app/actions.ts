"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  exerciseLogs,
  programState,
  sessions,
  setLogs,
  trainingMaxes,
  type DayGroup,
  type ExerciseStatus,
  type LiftKey,
  type WeightUnit,
  type WorkoutSlot,
} from "@/db/schema";
import { isLastSlot, nextSlot, roundTo } from "@/lib/program";
import { addDays, todayISO } from "@/lib/dates";

export interface SetEntry {
  weight: number | null;
  reps: number | null;
  holdSeconds: number | null;
  techniqueGrade: number | null;
  isAmrap: boolean;
}

export interface ExerciseEntry {
  exerciseId: number;
  status: ExerciseStatus;
  unit: WeightUnit;
  feel: string | null;
  notes: string | null;
  sets: SetEntry[];
}

export interface SaveSessionInput {
  userId: number;
  dayGroup: WorkoutSlot;
  date: string; // ISO YYYY-MM-DD
  notes: string | null;
  entries: ExerciseEntry[];
}

/** A set worth persisting has at least a weight, a rep count, or a hold time. */
function meaningful(s: SetEntry): boolean {
  return s.weight != null || s.reps != null || s.holdSeconds != null;
}

/**
 * Upsert a training session for (userId, dayGroup, date) and replace its
 * exercise logs. Re-saving the same day overwrites that day's entries — this is
 * also how editing a past session works (it's not "new", so nothing advances).
 * Creating a *new* session stamps the current cycle/week and advances the
 * program (cycle rolls over + every training max bumps after Workout D of week
 * 4) — unless the program is paused.
 */
export async function saveSession(input: SaveSessionInput) {
  db.transaction((tx) => {
    let session = tx
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, input.userId),
          eq(sessions.dayGroup, input.dayGroup),
          eq(sessions.date, input.date),
        ),
      )
      .get();

    const isNew = !session;
    const state = tx
      .select()
      .from(programState)
      .where(eq(programState.userId, input.userId))
      .get();
    const paused = !!state?.pausedUntil && state.pausedUntil >= todayISO();

    if (session) {
      tx.update(sessions)
        .set({ notes: input.notes })
        .where(eq(sessions.id, session.id))
        .run();
      tx.delete(exerciseLogs).where(eq(exerciseLogs.sessionId, session.id)).run();
    } else {
      session = tx
        .insert(sessions)
        .values({
          userId: input.userId,
          dayGroup: input.dayGroup,
          date: input.date,
          cycle: state?.cycle ?? null,
          week: state?.week ?? null,
          notes: input.notes,
        })
        .returning()
        .get();
    }

    for (const e of input.entries) {
      const log = tx
        .insert(exerciseLogs)
        .values({
          sessionId: session!.id,
          exerciseId: e.exerciseId,
          status: e.status,
          unit: e.unit,
          feel: e.feel,
          notes: e.notes,
        })
        .returning()
        .get();

      if (e.status !== "done") continue;
      const sets = e.sets.filter(meaningful);
      if (sets.length === 0) continue;
      tx.insert(setLogs)
        .values(
          sets.map((s, i) => ({
            exerciseLogId: log.id,
            setNumber: i + 1,
            weight: s.weight,
            reps: s.reps,
            holdSeconds: s.holdSeconds,
            techniqueGrade: s.techniqueGrade,
            isAmrap: s.isAmrap,
          })),
        )
        .run();
    }

    // Advance the rotation on a *new* session; roll the cycle + bump every
    // training max after Workout D of week 4. Skipped while the program is paused.
    if (isNew && state && !paused) {
      const slot = input.dayGroup as DayGroup;
      let { cycle, week } = state;
      if (isLastSlot(slot)) {
        week += 1;
        if (week > 4) {
          week = 1;
          cycle += 1;
          tx.update(trainingMaxes)
            .set({
              trainingMax: sql`${trainingMaxes.trainingMax} + ${trainingMaxes.incrementLb}`,
              updatedAt: sql`(CURRENT_TIMESTAMP)`,
            })
            .where(
              and(
                eq(trainingMaxes.userId, input.userId),
                isNotNull(trainingMaxes.trainingMax),
              ),
            )
            .run();
        }
      }
      tx.update(programState)
        .set({ cycle, week, nextSlot: nextSlot(slot) })
        .where(eq(programState.userId, input.userId))
        .run();
    }
  });

  revalidatePath("/history");
  revalidatePath(`/log/${input.dayGroup}`);
  revalidatePath("/");
}

// --- training maxes / program overrides ------------------------------------

export async function saveTrainingMaxes(
  userId: number,
  values: { liftKey: LiftKey; trainingMax: number | null }[],
) {
  db.transaction((tx) => {
    for (const v of values) {
      tx.update(trainingMaxes)
        .set({ trainingMax: v.trainingMax, updatedAt: sql`(CURRENT_TIMESTAMP)` })
        .where(
          and(
            eq(trainingMaxes.userId, userId),
            eq(trainingMaxes.liftKey, v.liftKey),
          ),
        )
        .run();
    }
  });
  revalidatePath("/settings");
  revalidatePath("/calculator");
  revalidatePath("/log/a");
  revalidatePath("/log/b");
  revalidatePath("/log/c");
  revalidatePath("/log/d");
}

/** Set a lift's training max to 90% of an estimated 1RM (rounded to 5 lb). */
export async function setTrainingMaxFromOneRM(
  userId: number,
  liftKey: LiftKey,
  oneRM: number,
) {
  const tm = roundTo(oneRM * 0.9);
  await saveTrainingMaxes(userId, [{ liftKey, trainingMax: tm }]);
  return tm;
}

export async function setProgramState(
  userId: number,
  input: { cycle: number; week: number; nextSlot: DayGroup },
) {
  db.update(programState)
    .set({ cycle: input.cycle, week: input.week, nextSlot: input.nextSlot })
    .where(eq(programState.userId, userId))
    .run();
  revalidatePath("/settings");
  revalidatePath("/");
}

/** Pause the program for `days` days so logging won't advance the cycle/week. */
export async function pauseProgram(userId: number, days: number) {
  const until = addDays(todayISO(), Math.max(1, Math.floor(days)));
  db.update(programState)
    .set({ pausedUntil: until })
    .where(eq(programState.userId, userId))
    .run();
  revalidatePath("/settings");
  revalidatePath("/");
}

/** Resume a paused program immediately. */
export async function resumeProgram(userId: number) {
  db.update(programState)
    .set({ pausedUntil: null })
    .where(eq(programState.userId, userId))
    .run();
  revalidatePath("/settings");
  revalidatePath("/");
}
