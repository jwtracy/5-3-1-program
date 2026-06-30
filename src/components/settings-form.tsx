"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  pauseProgram,
  resumeProgram,
  saveTrainingMaxes,
  setProgramState,
} from "@/app/actions";
import type { DayGroup, LiftKey } from "@/db/schema";
import { roundTo, WEEK_LABELS, WORKOUT_LABELS, WORKOUT_SUBTITLES } from "@/lib/program";
import { formatDate, todayISO } from "@/lib/dates";

export interface TmRow {
  liftKey: LiftKey;
  label: string;
  trainingMax: number | null;
}

interface SettingsFormProps {
  userId: number;
  rows: TmRow[];
  program: { cycle: number; week: number; nextSlot: DayGroup };
  pausedUntil: string | null;
}

const PAUSE_PRESETS = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
];

export function SettingsForm({ userId, rows, program, pausedUntil }: SettingsFormProps) {
  const router = useRouter();
  const [savingTm, startTm] = useTransition();
  const [savingProg, startProg] = useTransition();
  const [savingPause, startPause] = useTransition();

  const [tm, setTm] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.liftKey, r.trainingMax?.toString() ?? ""])),
  );
  const [cycle, setCycle] = useState(program.cycle);
  const [week, setWeek] = useState(program.week);
  const [nextSlot, setNextSlot] = useState<DayGroup>(program.nextSlot);
  const [customDays, setCustomDays] = useState("");

  const isPaused = !!pausedUntil && pausedUntil >= todayISO();

  const saveTms = () => {
    startTm(async () => {
      try {
        await saveTrainingMaxes(
          userId,
          rows.map((r) => {
            const v = tm[r.liftKey]?.trim();
            return { liftKey: r.liftKey, trainingMax: v ? Number(v) : null };
          }),
        );
        toast.success("Training maxes saved");
        router.refresh();
      } catch (err) {
        console.error(err);
        toast.error("Couldn't save — try again");
      }
    });
  };

  const saveProgram = () => {
    startProg(async () => {
      try {
        await setProgramState(userId, { cycle, week, nextSlot });
        toast.success("Program updated");
        router.refresh();
      } catch (err) {
        console.error(err);
        toast.error("Couldn't save — try again");
      }
    });
  };

  const pause = (days: number) => {
    if (!days || days < 1) return;
    startPause(async () => {
      try {
        await pauseProgram(userId, days);
        toast.success(`Paused for ${days} day${days === 1 ? "" : "s"}`);
        router.refresh();
      } catch (err) {
        console.error(err);
        toast.error("Couldn't pause — try again");
      }
    });
  };

  const resume = () => {
    startPause(async () => {
      try {
        await resumeProgram(userId);
        toast.success("Program resumed");
        router.refresh();
      } catch (err) {
        console.error(err);
        toast.error("Couldn't resume — try again");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-4 p-4">
        <div>
          <h2 className="font-semibold">Training Maxes</h2>
          <p className="text-xs text-muted-foreground">
            The Training Max drives every prescribed weight — it&apos;s 90% of your 1RM.
            (Use the 1RM Calculator to set one from a rep max.) The 1RM each TM implies is
            shown on the right.
          </p>
        </div>

        {rows.map((r) => {
          const tmVal = Number(tm[r.liftKey]);
          const implied = tmVal > 0 ? roundTo(tmVal / 0.9, 1) : null;
          return (
            <div key={r.liftKey} className="flex flex-wrap items-end gap-x-5 gap-y-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">{r.label} — TM (lb)</Label>
                <Input
                  inputMode="decimal"
                  className="h-11 w-28 text-center text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  value={tm[r.liftKey] ?? ""}
                  onChange={(e) =>
                    setTm((prev) => ({ ...prev, [r.liftKey]: e.target.value }))
                  }
                />
              </div>
              <span className="pb-2.5 text-xs text-muted-foreground">
                {implied != null ? `≈ ${implied} lb 1RM` : "—"}
              </span>
            </div>
          );
        })}

        <Button type="button" disabled={savingTm} onClick={saveTms} className="self-start">
          {savingTm ? "Saving…" : "Save training maxes"}
        </Button>
      </Card>

      <Card className="gap-4 p-4">
        <div>
          <h2 className="font-semibold">Pause program</h2>
          <p className="text-xs text-muted-foreground">
            Pause while travelling, sick, or injured — logging won&apos;t advance the
            cycle/week until the pause ends.
          </p>
        </div>

        {isPaused && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            <span>Paused until {formatDate(pausedUntil!)}</span>
            <Button type="button" size="sm" variant="outline" disabled={savingPause} onClick={resume}>
              Resume now
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          {PAUSE_PRESETS.map((p) => (
            <Button
              key={p.days}
              type="button"
              size="sm"
              variant="secondary"
              disabled={savingPause}
              onClick={() => pause(p.days)}
            >
              {p.label}
            </Button>
          ))}
          <div className="flex items-end gap-1.5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Custom (days)</Label>
              <Input
                inputMode="numeric"
                placeholder="days"
                className="h-9 w-20 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={savingPause || !customDays.trim()}
              onClick={() => pause(Number(customDays))}
            >
              Pause
            </Button>
          </div>
        </div>
      </Card>

      <Card className="gap-4 p-4">
        <div>
          <h2 className="font-semibold">Program state</h2>
          <p className="text-xs text-muted-foreground">
            Auto-advances as you log. Override here if a workout was missed or logged out of
            order.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Cycle</Label>
            <Input
              inputMode="numeric"
              className="h-11 w-20 text-center text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              value={cycle}
              onChange={(e) => setCycle(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Week</Label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((w) => (
                <Button
                  key={w}
                  type="button"
                  size="sm"
                  variant={week === w ? "default" : "outline"}
                  onClick={() => setWeek(w)}
                >
                  {w}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <p className="-mt-1 text-xs text-muted-foreground">Week {week}: {WEEK_LABELS[week]}</p>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Next workout</Label>
          <div className="flex flex-wrap gap-1.5">
            {(["a", "b", "c", "d"] as DayGroup[]).map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={nextSlot === s ? "default" : "outline"}
                onClick={() => setNextSlot(s)}
              >
                {WORKOUT_LABELS[s]} · {WORKOUT_SUBTITLES[s]}
              </Button>
            ))}
          </div>
        </div>

        <Separator />
        <Button
          type="button"
          disabled={savingProg}
          onClick={saveProgram}
          className="self-start"
        >
          {savingProg ? "Saving…" : "Save program state"}
        </Button>
      </Card>
    </div>
  );
}
