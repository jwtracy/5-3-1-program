import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "./index";
import {
  exerciseLogs,
  exercises,
  programState,
  sessions,
  setLogs,
  trainingMaxes,
  users,
  type Exercise,
  type ExerciseLog,
  type LiftKey,
  type ProgramState,
  type Session,
  type SetLog,
  type TrainingMax,
  type User,
  type WorkoutSlot,
} from "./schema";

/** Look up a user by their slug (e.g. "john", "alisa"). */
export function getUserBySlug(slug: string): User | undefined {
  return db.select().from(users).where(eq(users.slug, slug)).get();
}

export function getExercisesByDay(
  userId: number,
  dayGroup: WorkoutSlot,
): Exercise[] {
  return db
    .select()
    .from(exercises)
    .where(
      and(
        eq(exercises.userId, userId),
        eq(exercises.dayGroup, dayGroup),
        eq(exercises.archived, false),
      ),
    )
    .orderBy(exercises.sortOrder)
    .all();
}

/** The session for a given slot on a given date, if one exists. */
export function getSession(
  userId: number,
  dayGroup: WorkoutSlot,
  date: string,
): Session | undefined {
  return db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.dayGroup, dayGroup),
        eq(sessions.date, date),
      ),
    )
    .get();
}

export interface LogWithSets {
  log: ExerciseLog;
  sets: SetLog[];
}

/** Fetch all set rows for the given exercise-log ids, grouped by log id. */
function setsByLogId(logIds: number[]): Map<number, SetLog[]> {
  const grouped = new Map<number, SetLog[]>();
  if (logIds.length === 0) return grouped;
  const rows = db
    .select()
    .from(setLogs)
    .where(inArray(setLogs.exerciseLogId, logIds))
    .orderBy(setLogs.exerciseLogId, setLogs.setNumber)
    .all();
  for (const r of rows) {
    const list = grouped.get(r.exerciseLogId) ?? [];
    list.push(r);
    grouped.set(r.exerciseLogId, list);
  }
  return grouped;
}

/** This session's logged exercises (with their sets), keyed by exerciseId. */
export function getSessionLogsByExercise(
  sessionId: number,
): Map<number, LogWithSets> {
  const logs = db
    .select()
    .from(exerciseLogs)
    .where(eq(exerciseLogs.sessionId, sessionId))
    .all();
  const sets = setsByLogId(logs.map((l) => l.id));
  return new Map(
    logs.map((log) => [log.exerciseId, { log, sets: sets.get(log.id) ?? [] }]),
  );
}

/**
 * The most recent prior log per exercise (any session before `beforeDate`),
 * with its sets, keyed by exerciseId. Used to pre-fill / show "Last: …".
 */
export function getLatestLogsByExercise(
  userId: number,
  dayGroup: WorkoutSlot,
  beforeDate: string,
): Map<number, { log: ExerciseLog; sets: SetLog[]; date: string }> {
  const rows = db
    .select({ log: exerciseLogs, date: sessions.date })
    .from(exerciseLogs)
    .innerJoin(sessions, eq(exerciseLogs.sessionId, sessions.id))
    .innerJoin(exercises, eq(exerciseLogs.exerciseId, exercises.id))
    .where(
      and(
        eq(sessions.userId, userId),
        eq(exercises.dayGroup, dayGroup),
        eq(exerciseLogs.status, "done"),
      ),
    )
    .orderBy(desc(sessions.date), desc(exerciseLogs.id))
    .all();

  const latest = new Map<number, { log: ExerciseLog; date: string }>();
  for (const { log, date } of rows) {
    if (date >= beforeDate) continue; // only strictly-prior sessions
    if (!latest.has(log.exerciseId)) latest.set(log.exerciseId, { log, date });
  }

  const sets = setsByLogId([...latest.values()].map((v) => v.log.id));
  return new Map(
    [...latest.entries()].map(([exId, v]) => [
      exId,
      { log: v.log, sets: sets.get(v.log.id) ?? [], date: v.date },
    ]),
  );
}

/** The most recent prior session for a slot (for circuit/cardio "last time"). */
export function getMostRecentSlotSession(
  userId: number,
  dayGroup: WorkoutSlot,
  beforeDate: string,
): Session | undefined {
  const rows = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.dayGroup, dayGroup)))
    .orderBy(desc(sessions.date), desc(sessions.id))
    .all();
  return rows.find((s) => s.date < beforeDate);
}

export interface SessionWithLogs {
  session: Session;
  logs: (ExerciseLog & { exerciseName: string; isMain: boolean; sets: SetLog[] })[];
}

/** A user's sessions, newest first, each with its logs + sets (names joined). */
export function getHistory(userId: number): SessionWithLogs[] {
  const allSessions = db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.date), desc(sessions.id))
    .all();

  return allSessions.map((session) => {
    const rows = db
      .select({
        log: exerciseLogs,
        exerciseName: exercises.name,
        isMain: exercises.isMain,
      })
      .from(exerciseLogs)
      .innerJoin(exercises, eq(exerciseLogs.exerciseId, exercises.id))
      .where(eq(exerciseLogs.sessionId, session.id))
      .orderBy(exercises.sortOrder)
      .all();
    const sets = setsByLogId(rows.map((r) => r.log.id));
    const logs = rows.map((r) => ({
      ...r.log,
      exerciseName: r.exerciseName,
      isMain: r.isMain,
      sets: sets.get(r.log.id) ?? [],
    }));
    return { session, logs };
  });
}

/** The user's most recently logged session, if any. */
export function getMostRecentSession(userId: number): Session | undefined {
  return db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.date), desc(sessions.id))
    .get();
}

// --- 5/3/1 program state ---------------------------------------------------

export function getProgramState(userId: number): ProgramState {
  const row = db
    .select()
    .from(programState)
    .where(eq(programState.userId, userId))
    .get();
  // Seeded with a row; fall back defensively.
  return row ?? { id: 0, userId, cycle: 1, week: 1, nextSlot: "a", pausedUntil: null };
}

export function getTrainingMaxes(userId: number): TrainingMax[] {
  return db
    .select()
    .from(trainingMaxes)
    .where(eq(trainingMaxes.userId, userId))
    .orderBy(trainingMaxes.id)
    .all();
}

export function getTrainingMaxMap(userId: number): Map<LiftKey, TrainingMax> {
  return new Map(getTrainingMaxes(userId).map((tm) => [tm.liftKey, tm]));
}

export interface AmrapResult {
  weight: number;
  reps: number;
  date: string;
}

/** The most recent logged AMRAP ("+") set per main lift, for the calculator. */
export function getLatestAmrapByLift(userId: number): Map<LiftKey, AmrapResult> {
  const rows = db
    .select({
      liftKey: exercises.liftKey,
      weight: setLogs.weight,
      reps: setLogs.reps,
      date: sessions.date,
      setId: setLogs.id,
    })
    .from(setLogs)
    .innerJoin(exerciseLogs, eq(setLogs.exerciseLogId, exerciseLogs.id))
    .innerJoin(exercises, eq(exerciseLogs.exerciseId, exercises.id))
    .innerJoin(sessions, eq(exerciseLogs.sessionId, sessions.id))
    .where(
      and(
        eq(sessions.userId, userId),
        eq(setLogs.isAmrap, true),
        isNotNull(exercises.liftKey),
      ),
    )
    .orderBy(desc(sessions.date), desc(setLogs.id))
    .all();

  const latest = new Map<LiftKey, AmrapResult>();
  for (const r of rows) {
    if (!r.liftKey || r.weight == null || r.reps == null) continue;
    if (!latest.has(r.liftKey)) {
      latest.set(r.liftKey, { weight: r.weight, reps: r.reps, date: r.date });
    }
  }
  return latest;
}

export interface AmrapPoint {
  date: string;
  cycle: number | null;
  week: number | null;
  weight: number;
  reps: number;
}

/**
 * Every logged AMRAP ("+") set per main lift, oldest first — the raw series for
 * the Progress charts (work-set weight + Epley 1RM over time). Deload weeks have
 * no AMRAP set, so they're naturally absent.
 */
export function getAmrapHistoryByLift(
  userId: number,
): Map<LiftKey, AmrapPoint[]> {
  const rows = db
    .select({
      liftKey: exercises.liftKey,
      weight: setLogs.weight,
      reps: setLogs.reps,
      date: sessions.date,
      cycle: sessions.cycle,
      week: sessions.week,
    })
    .from(setLogs)
    .innerJoin(exerciseLogs, eq(setLogs.exerciseLogId, exerciseLogs.id))
    .innerJoin(exercises, eq(exerciseLogs.exerciseId, exercises.id))
    .innerJoin(sessions, eq(exerciseLogs.sessionId, sessions.id))
    .where(
      and(
        eq(sessions.userId, userId),
        eq(setLogs.isAmrap, true),
        isNotNull(exercises.liftKey),
      ),
    )
    .orderBy(sessions.date, setLogs.id)
    .all();

  const byLift = new Map<LiftKey, AmrapPoint[]>();
  for (const r of rows) {
    if (!r.liftKey || r.weight == null || r.reps == null) continue;
    const list = byLift.get(r.liftKey) ?? [];
    list.push({
      date: r.date,
      cycle: r.cycle,
      week: r.week,
      weight: r.weight,
      reps: r.reps,
    });
    byLift.set(r.liftKey, list);
  }
  return byLift;
}
