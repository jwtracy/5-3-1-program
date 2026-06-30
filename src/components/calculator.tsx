"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/stepper";
import { setTrainingMaxFromOneRM } from "@/app/actions";
import type { LiftKey } from "@/db/schema";
import { epley1RM, repPercentTable, roundTo } from "@/lib/program";

export interface AmrapCard {
  liftKey: LiftKey;
  label: string;
  weight: number;
  reps: number;
  date: string;
  est1RM: number;
  currentTM: number | null;
}

export function Calculator({
  userId,
  amraps,
}: {
  userId: number;
  amraps: AmrapCard[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [weight, setWeight] = useState("185");
  const [reps, setReps] = useState<number | null>(5);

  const w = Number(weight) || 0;
  const r = reps ?? 0;
  const est = useMemo(() => (w > 0 && r > 0 ? epley1RM(w, r) : 0), [w, r]);
  const table = useMemo(() => (est > 0 ? repPercentTable(est) : []), [est]);

  const applyTM = (liftKey: LiftKey, oneRM: number, label: string) => {
    startTransition(async () => {
      try {
        const tm = await setTrainingMaxFromOneRM(userId, liftKey, oneRM);
        toast.success(`${label} training max set to ${tm} lb`);
        router.refresh();
      } catch (err) {
        console.error(err);
        toast.error("Couldn't update — try again");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-4 p-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Weight (lb)</Label>
            <Input
              inputMode="decimal"
              className="h-11 w-28 text-center text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Reps</Label>
            <Stepper ariaLabel="reps" value={reps} min={1} onChange={setReps} />
          </div>
        </div>

        <div className="rounded-md bg-muted px-4 py-3">
          <p className="text-sm text-muted-foreground">Estimated 1RM (Epley)</p>
          <p className="text-3xl font-bold tracking-tight">
            {est > 0 ? `${roundTo(est, 1)} lb` : "—"}
          </p>
        </div>

        {table.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Reps</th>
                  <th className="py-1 pr-3 font-medium">% 1RM</th>
                  <th className="py-1 font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr key={row.reps} className="border-t">
                    <td className="py-1 pr-3">{row.reps}</td>
                    <td className="py-1 pr-3 text-muted-foreground">
                      {Math.round(row.pct)}%
                    </td>
                    <td className="py-1 font-medium">{row.weight} lb</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">From your recent AMRAP sets</h2>
        {amraps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No AMRAP sets logged yet. The last (“+”) set on each main lift shows up here
            once you log it.
          </p>
        ) : (
          amraps.map((a) => (
            <Card key={a.liftKey} className="gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.weight} lb × {a.reps} → est 1RM ≈ {roundTo(a.est1RM, 1)} lb
                    {a.currentTM != null && ` · current TM ${a.currentTM}`}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => applyTM(a.liftKey, a.est1RM, a.label)}
                >
                  Set TM {roundTo(a.est1RM * 0.9)}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
