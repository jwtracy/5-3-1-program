import { getHistory } from "@/db/queries";
import { getCurrentUser } from "@/lib/current-user";
import { todayISO } from "@/lib/dates";
import {
  epley1RM,
  roundTo,
  WORKOUT_LABELS,
  WORKOUT_SUBTITLES,
} from "@/lib/program";
import type { DayGroup } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Quote a CSV field if it contains a comma, quote, or newline. */
function esc(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADER = [
  "Date",
  "Workout",
  "Focus",
  "Cycle",
  "Week",
  "Exercise",
  "Main",
  "Status",
  "Set",
  "Weight",
  "Unit",
  "Reps",
  "HoldSec",
  "Technique",
  "AMRAP",
  "Estimated1RM",
  "Intensity",
  "Notes",
];

export async function GET() {
  const user = await getCurrentUser();
  const history = getHistory(user.id);
  const lines: string[] = [HEADER.join(",")];

  for (const { session, logs } of history) {
    const base = [
      session.date,
      WORKOUT_LABELS[session.dayGroup as DayGroup] ?? session.dayGroup,
      WORKOUT_SUBTITLES[session.dayGroup as DayGroup] ?? "",
      session.cycle ?? "",
      session.week ?? "",
    ];
    for (const log of logs) {
      const lead = [...base, log.exerciseName, log.isMain ? "yes" : "no"];
      const tail = [log.feel ?? "", session.notes ?? ""];
      if (log.status === "skipped" || log.sets.length === 0) {
        lines.push(
          [...lead, log.status, "", "", log.unit, "", "", "", "", "", ...tail]
            .map(esc)
            .join(","),
        );
        continue;
      }
      for (const s of log.sets) {
        const est =
          s.weight != null && s.reps != null
            ? roundTo(epley1RM(s.weight, s.reps), 1)
            : "";
        lines.push(
          [
            ...lead,
            log.status,
            s.setNumber,
            s.weight ?? "",
            log.unit,
            s.reps ?? "",
            s.holdSeconds ?? "",
            s.techniqueGrade ?? "",
            s.isAmrap ? "yes" : "no",
            est,
            ...tail,
          ]
            .map(esc)
            .join(","),
        );
      }
    }
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="program-tracker-history-${todayISO()}.csv"`,
    },
  });
}
