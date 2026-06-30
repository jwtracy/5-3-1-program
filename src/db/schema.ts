import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The four rotating 5/3/1 workouts. They cycle a → b → c → d → a as they're
 * logged. a = Bench day, b = Squat day, c = Deadlift day, d = Press day.
 */
export type DayGroup = "a" | "b" | "c" | "d";

/** A workout slot key (a/b/c/d). Kept as a free string for storage flexibility. */
export type WorkoutSlot = string;

/** The 5/3/1 main lifts (everything else is plain accessory work). */
export type LiftKey = "bench" | "deadlift" | "ohp" | "squat" | "row";

/** Program type column (single program now). Retained for schema stability. */
export type ProgramType = "wendler531" | "circuit";

/**
 * The single app user. The multi-user concept was removed, but the `users` row
 * and the `user_id` foreign keys are retained so existing data stays intact.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  programType: text("program_type").$type<ProgramType>().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** How an exercise is logged: per-rep, or as a timed static hold (seconds). */
export type TrackingMode = "reps" | "hold";

/** The exercise catalog — seeded once, one row per exercise in each user's split. */
export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  // The workout slot this exercise belongs to (a/b/c/d).
  dayGroup: text("day_group").$type<WorkoutSlot>().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  // True for the 5/3/1 main lifts; they run the percentage scheme.
  isMain: integer("is_main", { mode: "boolean" }).notNull().default(false),
  // Set for main lifts only — links to the training max + cycle increment.
  liftKey: text("lift_key").$type<LiftKey>(),
  // "reps" (default) or "hold" — timed static holds logged in seconds.
  trackingMode: text("tracking_mode").$type<TrackingMode>().notNull().default("reps"),
  // Deprecated (circuit quick-pick); retained nullable to avoid a table rebuild.
  weightOptions: text("weight_options"),
  // Removed from the active program but kept for historical sessions.
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

/** One training-day instance (a single date you worked out a given slot). */
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  // ISO date string (YYYY-MM-DD) — the calendar day of the session.
  date: text("date").notNull(),
  dayGroup: text("day_group").$type<WorkoutSlot>().notNull(),
  // The 5/3/1 cycle + week (1–4) this session was logged under. Stamped at
  // save time so history and re-opens stay stable as the program advances.
  // Null for non-5/3/1 (circuit/cardio) sessions.
  cycle: integer("cycle"),
  week: integer("week"),
  // Deprecated session metrics (former circuit/cardio); retained nullable.
  rounds: integer("rounds"),
  durationMin: integer("duration_min"),
  distance: real("distance"),
  distanceUnit: text("distance_unit"),
  // Deprecated: merged into `notes`. Retained nullable for back-compat.
  overallFeel: text("overall_feel"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type ExerciseStatus = "done" | "skipped";
export type WeightUnit = "lb" | "kg";

/**
 * One logged exercise within a session. The actual numbers live in child
 * `setLogs` rows (one per set). The legacy sets/reps/weight/techniqueGrade
 * columns are deprecated — kept nullable so the migration doesn't have to
 * rebuild the table; no longer written.
 */
export const exerciseLogs = sqliteTable("exercise_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id),
  status: text("status").$type<ExerciseStatus>().notNull().default("done"),
  unit: text("unit").$type<WeightUnit>().notNull().default("lb"),
  // Free text + quick chips, e.g. "solid", "strong", "tired", "pain".
  feel: text("feel"),
  notes: text("notes"),
  // --- deprecated (data moved to setLogs); retained for back-compat. TS names
  // are prefixed `legacy` so they don't collide with the joined `sets` array. ---
  legacySets: integer("sets"),
  legacyReps: integer("reps"),
  legacyWeight: real("weight"),
  legacyTechniqueGrade: integer("technique_grade"),
});

/** One set within a logged exercise. */
export const setLogs = sqliteTable("set_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exerciseLogId: integer("exercise_log_id")
    .notNull()
    .references(() => exerciseLogs.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  weight: real("weight"),
  reps: integer("reps"),
  // For timed-hold exercises: seconds held (instead of reps).
  holdSeconds: integer("hold_seconds"),
  // Reps in reserve (how many more you could have done).
  rir: integer("rir"),
  // Self-graded technique, 1 (poor) – 5 (excellent).
  techniqueGrade: integer("technique_grade"),
  // The 5/3/1 "+" (AMRAP) set — used to estimate 1RM.
  isAmrap: integer("is_amrap", { mode: "boolean" }).notNull().default(false),
});

/** Per-lift training max (90% of 1RM) for the 5/3/1 program. */
export const trainingMaxes = sqliteTable("training_maxes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  liftKey: text("lift_key").$type<LiftKey>().notNull().unique(),
  // Null until the user sets it (on /settings or via the calculator).
  trainingMax: real("training_max"),
  unit: text("unit").$type<WeightUnit>().notNull().default("lb"),
  // Per-cycle increment: +5 (upper: bench, ohp) / +10 (lower: squat, deadlift).
  incrementLb: real("increment_lb").notNull().default(5),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

/** Tracks where we are in the 5/3/1 program. */
export const programState = sqliteTable("program_state", {
  id: integer("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  cycle: integer("cycle").notNull().default(1),
  week: integer("week").notNull().default(1),
  nextSlot: text("next_slot").$type<DayGroup>().notNull().default("a"),
  // When set and still in the future, the program is paused: logging a session
  // won't advance the cycle/week (travel, illness, injury, etc.).
  pausedUntil: text("paused_until"),
});

export type User = typeof users.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type ExerciseLog = typeof exerciseLogs.$inferSelect;
export type SetLog = typeof setLogs.$inferSelect;
export type TrainingMax = typeof trainingMaxes.$inferSelect;
export type ProgramState = typeof programState.$inferSelect;
