"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ExerciseCard } from "@/components/exercise-card";
import { saveSession, type ExerciseEntry } from "@/app/actions";
import type { TrackingMode, WorkoutSlot } from "@/db/schema";
import type { TargetSet } from "@/lib/program";

export interface LogFormItem {
  name: string;
  entry: ExerciseEntry;
  isMain: boolean;
  targets: TargetSet[] | null;
  needsTrainingMax: boolean;
  trackingMode: TrackingMode;
  lastSummary: string | null;
}

interface LogFormProps {
  userId: number;
  dayGroup: WorkoutSlot;
  date: string;
  items: LogFormItem[];
  initialNotes: string | null;
  alreadyLogged: boolean;
}

export function LogForm({
  userId,
  dayGroup,
  date,
  items,
  initialNotes,
  alreadyLogged,
}: LogFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entries, setEntries] = useState<ExerciseEntry[]>(items.map((i) => i.entry));
  const [notes, setNotes] = useState(initialNotes ?? "");

  const patch = (idx: number, p: Partial<ExerciseEntry>) =>
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...p } : e)));

  const onSave = () => {
    startTransition(async () => {
      try {
        await saveSession({
          userId,
          dayGroup,
          date,
          notes: notes.trim() || null,
          entries,
        });
        toast.success(alreadyLogged ? "Session updated" : "Session saved");
        router.push("/history");
      } catch (err) {
        console.error(err);
        toast.error("Couldn't save — try again");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {items.map((item, idx) => (
        <ExerciseCard
          key={item.entry.exerciseId}
          name={item.name}
          entry={entries[idx]}
          isMain={item.isMain}
          targets={item.targets}
          needsTrainingMax={item.needsTrainingMax}
          trackingMode={item.trackingMode}
          lastSummary={item.lastSummary}
          onChange={(p) => patch(idx, p)}
        />
      ))}

      <Separator />

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea
          rows={3}
          placeholder="how it felt, cues, anything worth remembering…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="sticky bottom-4 z-10">
        <Button
          type="button"
          size="lg"
          className="w-full shadow-lg"
          disabled={pending}
          onClick={onSave}
        >
          {pending ? "Saving…" : alreadyLogged ? "Update session" : "Save session"}
        </Button>
      </div>
    </div>
  );
}
