import { notFound } from "next/navigation";
import { LogForm, type LogFormItem } from "@/components/log-form";
import type { ExerciseEntry, SetEntry } from "@/app/actions";
import {
  getExercisesByDay,
  getLatestLogsByExercise,
  getProgramState,
  getSession,
  getSessionLogsByExercise,
  getTrainingMaxMap,
  type LogWithSets,
} from "@/db/queries";
import type { SetLog } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { formatDate, todayISO } from "@/lib/dates";
import {
  isDayGroup,
  prescription,
  WEEK_LABELS,
  WORKOUT_LABELS,
  WORKOUT_SUBTITLES,
  type TargetSet,
} from "@/lib/program";

export const dynamic = "force-dynamic";

/** Compact one-line recap of a previous session's sets. */
function summarize(sets: SetLog[], date: string, skipped: boolean): string {
  if (skipped) return `skipped (${formatDate(date)})`;
  const bits = sets
    .filter((s) => s.weight != null || s.reps != null || s.holdSeconds != null)
    .map((s) => {
      const w = s.weight != null ? `${s.weight}` : "";
      if (s.holdSeconds != null) return `${w}${w ? "×" : ""}${s.holdSeconds}s`;
      const r = s.reps != null ? `×${s.reps}${s.isAmrap ? "+" : ""}` : "";
      return `${w}${r}`;
    })
    .filter(Boolean);
  return `${bits.join(", ") || "done"} (${formatDate(date)})`;
}

function setEntryFromLog(s: SetLog): SetEntry {
  return {
    weight: s.weight,
    reps: s.reps,
    holdSeconds: s.holdSeconds,
    techniqueGrade: s.techniqueGrade,
    isAmrap: s.isAmrap,
  };
}

function setEntryFromTarget(t: TargetSet): SetEntry {
  return {
    weight: t.weight,
    reps: t.reps,
    holdSeconds: null,
    techniqueGrade: 5,
    isAmrap: t.isAmrap,
  };
}

export default async function LogPage({
  params,
  searchParams,
}: {
  params: Promise<{ day: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { day } = await params;
  if (!isDayGroup(day)) notFound();
  const user = await getCurrentUser();

  // Optional ?date= lets you edit a past session (else today's).
  const sp = await searchParams;
  const isValidDate = typeof sp?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date);
  const date = isValidDate ? sp.date! : todayISO();

  const exercises = getExercisesByDay(user.id, day);
  const session = getSession(user.id, day, date);
  const existingByExercise: Map<number, LogWithSets> = session
    ? getSessionLogsByExercise(session.id)
    : new Map();
  const latest = getLatestLogsByExercise(user.id, day, date);

  const state = getProgramState(user.id);
  const tmMap = getTrainingMaxMap(user.id);
  // Prescribe under the session's stamped week if it exists, else the current one.
  const week = session?.week ?? state.week;

  const items: LogFormItem[] = exercises.map((ex) => {
    const tm = ex.liftKey ? (tmMap.get(ex.liftKey)?.trainingMax ?? null) : null;
    const targets: TargetSet[] | null = ex.isMain ? prescription(week, tm) : null;
    const isHold = ex.trackingMode === "hold";

    const existing = existingByExercise.get(ex.id);
    const prior = latest.get(ex.id);

    const fallbackSet: SetEntry = {
      weight: prior?.sets[0]?.weight ?? null,
      reps: isHold ? null : 5,
      holdSeconds: isHold ? (prior?.sets[0]?.holdSeconds ?? 30) : null,
      techniqueGrade: isHold ? null : 5,
      isAmrap: false,
    };

    let entry: ExerciseEntry;
    if (existing) {
      entry = {
        exerciseId: ex.id,
        status: existing.log.status,
        unit: existing.log.unit,
        feel: existing.log.feel,
        notes: existing.log.notes,
        sets:
          existing.sets.length > 0
            ? existing.sets.map(setEntryFromLog)
            : [fallbackSet],
      };
    } else {
      const sets: SetEntry[] = targets
        ? targets.map(setEntryFromTarget)
        : [fallbackSet];
      entry = {
        exerciseId: ex.id,
        status: "done",
        unit: prior?.log.unit ?? "lb",
        feel: null,
        notes: null,
        sets,
      };
    }

    return {
      name: ex.name,
      entry,
      isMain: ex.isMain,
      targets,
      trackingMode: ex.trackingMode,
      needsTrainingMax: ex.isMain && tm == null,
      lastSummary: prior
        ? summarize(prior.sets, prior.date, prior.log.status === "skipped")
        : null,
    };
  });

  const isToday = date === todayISO();
  const status = session
    ? isToday
      ? " · already logged today"
      : " · editing this session"
    : "";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted-foreground">{formatDate(date)}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {WORKOUT_LABELS[day]}
          <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">
            · {WORKOUT_SUBTITLES[day]}
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Cycle {session?.cycle ?? state.cycle} · Week {week} ({WEEK_LABELS[week]})
          {status}
        </p>
      </div>

      <LogForm
        userId={user.id}
        dayGroup={day}
        date={date}
        items={items}
        initialNotes={session?.notes ?? null}
        alreadyLogged={Boolean(session)}
      />
    </div>
  );
}
