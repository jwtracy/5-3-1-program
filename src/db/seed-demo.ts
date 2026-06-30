/**
 * Demo data generator — fills a DB with ~3 months of realistic 5/3/1 sessions
 * for screenshots and local exploration. NEVER run this against the production
 * database. Usage:
 *   rm -f data/demo.db && DATABASE_PATH=data/demo.db pnpm db:migrate \
 *     && DATABASE_PATH=data/demo.db pnpm db:seed \
 *     && DATABASE_PATH=data/demo.db pnpm tsx src/db/seed-demo.ts
 */
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import {
  exerciseLogs,
  exercises,
  programState,
  sessions,
  setLogs,
  trainingMaxes,
  users,
  type DayGroup,
  type LiftKey,
} from "./schema";
import { prescription, ROTATION } from "@/lib/program";

const START_DAYS_AGO = 92; // ~3 months
const STEP_DAYS = 2; // train every other day

const TM: Record<LiftKey, number> = {
  bench: 185,
  row: 135,
  squat: 255,
  deadlift: 315,
  ohp: 115,
};
const INCREMENT: Record<LiftKey, number> = {
  bench: 5,
  ohp: 5,
  row: 5,
  squat: 10,
  deadlift: 10,
};

const ACCESSORY_WEIGHT: Record<string, number | null> = {
  Dips: null,
  "Pull-ups": null,
  "Hanging Leg Raises": null,
  "Dumbbell Pec Flys": 25,
  "Slow Pause Squats": 135,
  "Barbell Bicep Curls": 30,
};

const INTENSITY = ["low", "moderate", "high"];
const NOTES = [
  "Felt strong, bar speed crisp.",
  "Final light set of ohp narrow grip elbows forward and forward lean to target.",
  "Low back a little tight on the last set — kept it controlled.",
  "Great pump on the accessories.",
  "Slept poorly, still hit all the reps.",
];

function isoDaysAgo(n: number): string {
  // Local script (not a workflow) — Date is allowed here.
  const ms = Date.now() - n * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function seedDemo() {
  const user = db.select().from(users).orderBy(users.id).get();
  if (!user) throw new Error("Seed the base data first.");

  // Set training maxes.
  for (const lift of Object.keys(TM) as LiftKey[]) {
    db.update(trainingMaxes)
      .set({ trainingMax: TM[lift] })
      .where(and(eq(trainingMaxes.userId, user.id), eq(trainingMaxes.liftKey, lift)))
      .run();
  }

  // Clear any prior sessions for a clean slate (cascades to logs/sets).
  for (const s of db.select().from(sessions).where(eq(sessions.userId, user.id)).all()) {
    db.delete(sessions).where(eq(sessions.id, s.id)).run();
  }

  const exByDay = new Map<DayGroup, (typeof exercises.$inferSelect)[]>();
  for (const slot of ROTATION) {
    exByDay.set(
      slot,
      db
        .select()
        .from(exercises)
        .where(eq(exercises.dayGroup, slot))
        .orderBy(exercises.sortOrder)
        .all(),
    );
  }

  let day = START_DAYS_AGO;
  let slotIdx = 0;
  let week = 1;
  let cycle = 1;
  let count = 0;

  while (day >= 1 && count < 60) {
    const slot = ROTATION[slotIdx];
    const date = isoDaysAgo(day);
    const note = count % 4 === 0 ? NOTES[count % NOTES.length] : null;

    const session = db
      .insert(sessions)
      .values({ userId: user.id, date, dayGroup: slot, cycle, week, notes: note })
      .returning()
      .get();

    for (const ex of exByDay.get(slot) ?? []) {
      const feel = INTENSITY[count % 3];
      const log = db
        .insert(exerciseLogs)
        .values({
          sessionId: session.id,
          exerciseId: ex.id,
          status: "done",
          unit: "lb",
          feel,
        })
        .returning()
        .get();

      const rows: {
        weight: number | null;
        reps: number | null;
        holdSeconds: number | null;
        isAmrap: boolean;
      }[] = [];

      if (ex.isMain && ex.liftKey) {
        const tm = TM[ex.liftKey] + (cycle - 1) * INCREMENT[ex.liftKey];
        for (const p of prescription(week, tm)) {
          rows.push({
            weight: p.weight,
            // AMRAP set beats the floor and climbs with the cycle.
            reps: p.isAmrap ? p.reps + 3 + cycle : p.reps,
            holdSeconds: null,
            isAmrap: p.isAmrap,
          });
        }
      } else if (ex.trackingMode === "hold") {
        for (let i = 0; i < 3; i++) {
          rows.push({ weight: null, reps: null, holdSeconds: 30 + cycle * 5, isAmrap: false });
        }
      } else {
        const w = ACCESSORY_WEIGHT[ex.name] ?? null;
        for (let i = 0; i < 3; i++) {
          rows.push({ weight: w, reps: 10, holdSeconds: null, isAmrap: false });
        }
      }

      db.insert(setLogs)
        .values(
          rows.map((r, i) => ({
            exerciseLogId: log.id,
            setNumber: i + 1,
            weight: r.weight,
            reps: r.reps,
            holdSeconds: r.holdSeconds,
            techniqueGrade: r.holdSeconds == null ? 5 : null,
            isAmrap: r.isAmrap,
          })),
        )
        .run();
    }

    slotIdx += 1;
    if (slotIdx >= ROTATION.length) {
      slotIdx = 0;
      week += 1;
      if (week > 4) {
        week = 1;
        cycle += 1;
      }
    }
    day -= STEP_DAYS;
    count += 1;
  }

  db.update(programState)
    .set({ cycle, week, nextSlot: ROTATION[slotIdx] as DayGroup })
    .where(eq(programState.userId, user.id))
    .run();

  console.log(`Seeded ${count} demo sessions across ${cycle} cycle(s).`);
}

seedDemo();
