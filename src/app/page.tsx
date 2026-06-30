import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  getExercisesByDay,
  getMostRecentSession,
  getProgramState,
} from "@/db/queries";
import { getCurrentUser } from "@/lib/current-user";
import { daysBetween, formatDate, todayISO } from "@/lib/dates";
import {
  ROTATION,
  WEEK_LABELS,
  WORKOUT_LABELS,
  WORKOUT_SUBTITLES,
} from "@/lib/program";

export const dynamic = "force-dynamic";

function lastTrainedLabel(userId: number): string | null {
  const last = getMostRecentSession(userId);
  if (!last) return null;
  const daysAgo = daysBetween(todayISO(), last.date);
  if (daysAgo <= 0) return "Trained today";
  if (daysAgo === 1) return "Last trained yesterday";
  return `Last trained ${daysAgo} days ago`;
}

export default async function Home() {
  const user = await getCurrentUser();
  const state = getProgramState(user.id);
  const next = state.nextSlot;
  const lastLabel = lastTrainedLabel(user.id);
  const today = todayISO();
  const paused = !!state.pausedUntil && state.pausedUntil >= today;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">{formatDate(today)}</p>
        <h1 className="text-2xl font-bold tracking-tight">Next up</h1>
        <p className="text-sm text-muted-foreground">
          Cycle {state.cycle} · Week {state.week} ({WEEK_LABELS[state.week]})
          {lastLabel && ` · ${lastLabel}`}
        </p>
      </div>

      {paused && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Program paused until {formatDate(state.pausedUntil!)} — logging won&apos;t advance
          the cycle.{" "}
          <Link href="/settings" className="font-medium underline-offset-4 hover:underline">
            Manage →
          </Link>
        </div>
      )}

      <Link href={`/log/${next}`}>
        <Card className="flex items-center justify-between border-primary/40 bg-primary/5 p-5 transition-colors hover:bg-primary/10">
          <div>
            <p className="font-semibold">
              {WORKOUT_LABELS[next]} · {WORKOUT_SUBTITLES[next]}
            </p>
            <p className="text-sm text-muted-foreground">
              {getExercisesByDay(user.id, next)
                .map((e) => e.name)
                .join(" · ")}
            </p>
          </div>
          <span aria-hidden className="text-2xl">
            →
          </span>
        </Card>
      </Link>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Log another workout</p>
        {ROTATION.map((slot) => {
          const exercises = getExercisesByDay(user.id, slot);
          return (
            <Link key={slot} href={`/log/${slot}`}>
              <Card className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
                <div>
                  <p className="font-medium">
                    {WORKOUT_LABELS[slot]} · {WORKOUT_SUBTITLES[slot]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {exercises.length} exercises
                  </p>
                </div>
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Link href="/calculator" className="flex-1">
          <Card className="p-4 text-center text-sm font-medium transition-colors hover:bg-muted/50">
            1RM Calculator
          </Card>
        </Link>
        <Link href="/settings" className="flex-1">
          <Card className="p-4 text-center text-sm font-medium transition-colors hover:bg-muted/50">
            Training Maxes
          </Card>
        </Link>
      </div>
    </div>
  );
}
