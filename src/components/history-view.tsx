"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SessionWithLogs } from "@/db/queries";
import type { DayGroup, SetLog } from "@/db/schema";
import { formatDate } from "@/lib/dates";
import {
  epley1RM,
  roundTo,
  WEEK_LABELS,
  WORKOUT_LABELS,
  WORKOUT_SUBTITLES,
} from "@/lib/program";
import { cn } from "@/lib/utils";

/** Render one set: weight×reps, a timed hold (Ns), or just done. */
function fmtSet(s: SetLog): string {
  const w = s.weight != null ? `${s.weight}` : "";
  if (s.holdSeconds != null) return `${w}${w ? "×" : ""}${s.holdSeconds}s`;
  const r = s.reps != null ? `×${s.reps}${s.isAmrap ? "+" : ""}` : "";
  return `${w}${r}`;
}

function setSummary(sets: SetLog[]): string {
  return (
    sets
      .filter((s) => s.weight != null || s.reps != null || s.holdSeconds != null)
      .map(fmtSet)
      .join(", ") || "done"
  );
}

function slotLabels(slot: string) {
  return {
    label: WORKOUT_LABELS[slot as DayGroup] ?? slot.toUpperCase(),
    subtitle: WORKOUT_SUBTITLES[slot as DayGroup] ?? "",
  };
}

function SessionDialog({ session, logs }: SessionWithLogs) {
  const { label, subtitle } = slotLabels(session.dayGroup);

  return (
    <Dialog>
      <DialogTrigger
        render={<div role="button" tabIndex={0} />}
        className="block w-full cursor-pointer rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card className="gap-3 p-4 transition-colors hover:bg-muted/40">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{formatDate(session.date)}</p>
              <p className="text-xs text-muted-foreground">
                {label}
                {subtitle && ` · ${subtitle}`}
              </p>
            </div>
            {session.week != null && (
              <Badge variant="outline">
                C{session.cycle} · Wk {session.week} ({WEEK_LABELS[session.week]})
              </Badge>
            )}
          </div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {logs.map((log) => (
              <li key={log.id} className="flex items-baseline justify-between gap-3">
                <span
                  className={
                    log.status === "skipped"
                      ? "text-muted-foreground line-through"
                      : "font-medium"
                  }
                >
                  {log.exerciseName}
                </span>
                <span className="text-right text-muted-foreground">
                  {log.status === "skipped"
                    ? "skipped"
                    : log.sets.length === 0
                      ? ""
                      : `${setSummary(log.sets)} ${log.unit}`}
                  {log.feel && ` · ${log.feel}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{formatDate(session.date)}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {label}
            {subtitle && ` · ${subtitle}`}
            {session.week != null &&
              ` · Cycle ${session.cycle} · Week ${session.week} (${WEEK_LABELS[session.week]})`}
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {logs.map((log) => (
            <div key={log.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "font-medium",
                    log.status === "skipped" && "text-muted-foreground line-through",
                  )}
                >
                  {log.exerciseName}
                </span>
                {log.feel && <Badge variant="secondary">{log.feel}</Badge>}
              </div>

              {log.status === "skipped" ? (
                <p className="mt-1 text-sm text-muted-foreground">skipped</p>
              ) : log.sets.length === 0 ? null : (
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {log.sets.map((s) => {
                    const est =
                      s.isAmrap && s.weight != null && s.reps != null
                        ? roundTo(epley1RM(s.weight, s.reps), 1)
                        : null;
                    return (
                      <li
                        key={s.id}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span className="text-muted-foreground">Set {s.setNumber}</span>
                        <span className="text-right">
                          <span className="font-medium">
                            {fmtSet(s)} {log.unit}
                          </span>
                          {s.isAmrap && (
                            <span className="ml-1.5 text-xs font-medium text-primary">
                              AMRAP+
                            </span>
                          )}
                          {s.techniqueGrade != null && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              · tech {s.techniqueGrade}/5
                            </span>
                          )}
                          {est != null && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              · ≈ {est} 1RM
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>

        {session.notes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <p className="text-sm whitespace-pre-wrap break-words">{session.notes}</p>
          </div>
        )}

        <Link
          href={`/log/${session.dayGroup}?date=${session.date}`}
          className="self-start rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50"
        >
          Edit session
        </Link>
      </DialogContent>
    </Dialog>
  );
}

export function HistoryView({ history }: { history: SessionWithLogs[] }) {
  return (
    <div className="flex flex-col gap-3">
      {history.map((h) => (
        <SessionDialog key={h.session.id} {...h} />
      ))}
    </div>
  );
}
