"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SetRow } from "@/components/set-row";
import type { ExerciseEntry, SetEntry } from "@/app/actions";
import type { TargetSet } from "@/lib/program";
import type { TrackingMode } from "@/db/schema";
import { cn } from "@/lib/utils";

// Per-exercise intensity (low → high maps to easy → hard effort).
const INTENSITY_CHIPS = ["low", "moderate", "high"];

/** A fresh set, prefilled from the previous set's weight. */
function defaultSet(prevWeight: number | null, mode: TrackingMode): SetEntry {
  return {
    weight: prevWeight,
    reps: mode === "hold" ? null : 5,
    holdSeconds: mode === "hold" ? 30 : null,
    techniqueGrade: mode === "hold" ? null : 5,
    isAmrap: false,
  };
}

interface ExerciseCardProps {
  name: string;
  entry: ExerciseEntry;
  isMain: boolean;
  /** Prescribed sets for a main lift (by set index); null for accessories. */
  targets: TargetSet[] | null;
  /** True when this main lift still needs a Training Max set. */
  needsTrainingMax: boolean;
  /** How this exercise logs sets: per-rep or timed static hold. */
  trackingMode?: TrackingMode;
  lastSummary?: string | null;
  onChange: (patch: Partial<ExerciseEntry>) => void;
}

export function ExerciseCard({
  name,
  entry,
  isMain,
  targets,
  needsTrainingMax,
  trackingMode = "reps",
  lastSummary,
  onChange,
}: ExerciseCardProps) {
  const done = entry.status === "done";
  const sets = entry.sets;

  const patchSet = (idx: number, p: Partial<SetEntry>) =>
    onChange({ sets: sets.map((s, i) => (i === idx ? { ...s, ...p } : s)) });

  const addSet = () => {
    const prev = sets[sets.length - 1];
    onChange({ sets: [...sets, defaultSet(prev?.weight ?? null, trackingMode)] });
  };

  const removeSet = (idx: number) =>
    onChange({ sets: sets.filter((_, i) => i !== idx) });

  return (
    <Card className={cn("gap-3 p-4", !done && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold leading-tight">{name}</h3>
            {isMain && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                5/3/1
              </span>
            )}
          </div>
          {lastSummary && (
            <p className="text-xs text-muted-foreground">Last: {lastSummary}</p>
          )}
        </div>
        <Button
          type="button"
          variant={done ? "outline" : "secondary"}
          size="sm"
          onClick={() => onChange({ status: done ? "skipped" : "done" })}
        >
          {done ? "Skip" : "Skipped ✓ — undo"}
        </Button>
      </div>

      {done && (
        <>
          {isMain && needsTrainingMax && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              No training max set for this lift.{" "}
              <Link
                href="/settings"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Set your Training Max →
              </Link>
            </p>
          )}

          <div className="flex flex-col gap-2.5">
            {sets.map((s, i) => (
              <SetRow
                key={i}
                index={i}
                set={s}
                unit={entry.unit}
                target={targets?.[i] ?? null}
                trackingMode={trackingMode}
                canRemove={sets.length > 1}
                onChange={(p) => patchSet(i, p)}
                onRemove={() => removeSet(i)}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={addSet}
          >
            <Plus className="size-4" /> Add set
          </Button>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Intensity</Label>
            <div className="flex flex-wrap gap-2">
              {INTENSITY_CHIPS.map((chip) => (
                <Button
                  key={chip}
                  type="button"
                  size="sm"
                  variant={entry.feel === chip ? "default" : "outline"}
                  onClick={() => onChange({ feel: entry.feel === chip ? null : chip })}
                >
                  {chip}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
