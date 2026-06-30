import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  exercises,
  programState,
  trainingMaxes,
  users,
  type LiftKey,
  type TrackingMode,
  type WorkoutSlot,
} from "./schema";

// Single private user. Multi-user support was removed; the row + user_id FKs are
// retained internally. No personal name in the source.
const USER = { slug: "me", name: "Lifter", programType: "wendler531" as const };

interface CatalogItem {
  name: string;
  dayGroup: WorkoutSlot;
  liftKey?: LiftKey;
  trackingMode?: TrackingMode;
}

/** The 5/3/1 split. Order within each day is screen order. */
const CATALOG: CatalogItem[] = [
  // Workout A — Bench day
  { name: "Barbell Bench Press", dayGroup: "a", liftKey: "bench" },
  { name: "Rows", dayGroup: "a", liftKey: "row" },
  { name: "Back Extensions", dayGroup: "a", trackingMode: "hold" },
  // Workout B — Squat day
  { name: "Squats", dayGroup: "b", liftKey: "squat" },
  { name: "Dips", dayGroup: "b" },
  { name: "Pull-ups", dayGroup: "b" },
  // Workout C — Deadlift day
  { name: "Deadlifts", dayGroup: "c", liftKey: "deadlift" },
  { name: "Hanging Leg Raises", dayGroup: "c" },
  { name: "Dumbbell Pec Flys", dayGroup: "c" },
  // Workout D — Press day
  { name: "Overhead Press", dayGroup: "d", liftKey: "ohp" },
  { name: "Slow Pause Squats", dayGroup: "d" },
  { name: "Barbell Bicep Curls", dayGroup: "d" },
];

/** Per-cycle training-max increment: +5 upper, +10 lower. */
const INCREMENT: Record<LiftKey, number> = {
  bench: 5,
  ohp: 5,
  row: 5,
  squat: 10,
  deadlift: 10,
};

async function seedUser(): Promise<number> {
  const existing = db.select().from(users).orderBy(users.id).get();
  if (existing) return existing.id;
  const row = db.insert(users).values({ ...USER, sortOrder: 0 }).returning().get();
  console.log(`Seeded user "${USER.slug}".`);
  return row.id;
}

async function seedCatalog(userId: number) {
  if ((await db.$count(exercises, eq(exercises.userId, userId))) > 0) {
    console.log("Catalog already seeded — skipping exercises.");
    return;
  }
  db.insert(exercises)
    .values(
      CATALOG.map((e, i) => ({
        userId,
        name: e.name,
        dayGroup: e.dayGroup,
        sortOrder: i,
        isMain: e.liftKey != null,
        liftKey: e.liftKey ?? null,
        trackingMode: e.trackingMode ?? "reps",
      })),
    )
    .run();
  console.log(`Seeded ${CATALOG.length} exercises.`);
}

async function seedTrainingMaxes(userId: number) {
  if ((await db.$count(trainingMaxes, eq(trainingMaxes.userId, userId))) > 0) {
    console.log("Training maxes already seeded — skipping.");
    return;
  }
  const lifts = Object.keys(INCREMENT) as LiftKey[];
  db.insert(trainingMaxes)
    .values(
      lifts.map((liftKey) => ({
        userId,
        liftKey,
        trainingMax: null,
        incrementLb: INCREMENT[liftKey],
      })),
    )
    .run();
  console.log(`Seeded ${lifts.length} training-max rows (unset).`);
}

async function seedProgramState(userId: number) {
  if ((await db.$count(programState, eq(programState.userId, userId))) > 0) {
    console.log("Program state already seeded — skipping.");
    return;
  }
  db.insert(programState)
    .values({ userId, cycle: 1, week: 1, nextSlot: "a" })
    .run();
  console.log("Seeded program state (cycle 1, week 1, next: a).");
}

async function seed() {
  const userId = await seedUser();
  await seedCatalog(userId);
  await seedTrainingMaxes(userId);
  await seedProgramState(userId);
}

seed();
