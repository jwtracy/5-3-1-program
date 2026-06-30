"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/stepper";
import type { SetEntry } from "@/app/actions";
import { epley1RM, roundTo, type TargetSet } from "@/lib/program";
import type { TrackingMode } from "@/db/schema";
import { cn } from "@/lib/utils";

const GRADES = [1, 2, 3, 4, 5];

interface SetRowProps {
  index: number;
  set: SetEntry;
  unit: string;
  /** 5/3/1 prescription for this set (main lifts only), shown as a hint. */
  target?: TargetSet | null;
  /** "reps" (weight + reps + technique) or "hold" (weight + seconds). */
  trackingMode?: TrackingMode;
  canRemove: boolean;
  onChange: (patch: Partial<SetEntry>) => void;
  onRemove: () => void;
}

export function SetRow({
  index,
  set,
  unit,
  target,
  trackingMode = "reps",
  canRemove,
  onChange,
  onRemove,
}: SetRowProps) {
  const isHold = trackingMode === "hold";
  const targetHint = target
    ? `${target.pct}%${target.weight != null ? ` · ${target.weight}${unit}` : ""} × ${target.reps}${target.isAmrap ? "+" : ""}`
    : null;

  // Live 1RM estimate for the AMRAP set (uses the calculator's Epley formula).
  // Climbs with your reps — that's the progress signal.
  const liveEst =
    set.isAmrap && set.weight != null && set.weight > 0 && set.reps != null && set.reps > 0
      ? roundTo(epley1RM(set.weight, set.reps), 1)
      : null;

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">Set {index + 1}</span>
          {set.isAmrap && (
            <span className="text-xs font-medium text-primary">AMRAP +</span>
          )}
          {targetHint && (
            <span className="text-xs text-muted-foreground">{targetHint}</span>
          )}
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label={`Remove set ${index + 1}`}
            onClick={onRemove}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {liveEst != null && (
        <p className="mb-2 text-xs font-medium">
          ≈ {liveEst} {unit} estimated 1RM
        </p>
      )}

      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Weight ({unit})</Label>
          <Input
            inputMode="decimal"
            aria-label={`Set ${index + 1} weight`}
            placeholder={target?.weight != null ? String(target.weight) : "—"}
            className="h-11 w-24 text-center text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            value={set.weight ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              onChange({ weight: v === "" ? null : Number(v) });
            }}
          />
        </div>
        {isHold ? (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Hold (sec)</Label>
            <Stepper
              ariaLabel={`Set ${index + 1} hold seconds`}
              value={set.holdSeconds}
              min={0}
              step={5}
              onChange={(v) => onChange({ holdSeconds: v })}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Reps</Label>
            <Stepper
              ariaLabel={`Set ${index + 1} reps`}
              value={set.reps}
              min={0}
              onChange={(v) => onChange({ reps: v })}
            />
          </div>
        )}
      </div>

      {!isHold && (
        <div className="mt-3 flex flex-col gap-1.5">
          <Label className="text-xs">Technique (1–5)</Label>
          <div className="flex gap-1.5">
            {GRADES.map((g) => (
              <Button
                key={g}
                type="button"
                size="icon"
                variant={set.techniqueGrade === g ? "default" : "outline"}
                className={cn("size-9")}
                aria-label={`Set ${index + 1} technique ${g}`}
                aria-pressed={set.techniqueGrade === g}
                onClick={() =>
                  onChange({ techniqueGrade: set.techniqueGrade === g ? null : g })
                }
              >
                {g}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
