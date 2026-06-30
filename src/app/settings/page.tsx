import { SettingsForm, type TmRow } from "@/components/settings-form";
import { getProgramState, getTrainingMaxMap } from "@/db/queries";
import { getCurrentUser } from "@/lib/current-user";
import { LIFT_LABELS } from "@/lib/program";
import type { LiftKey } from "@/db/schema";

export const dynamic = "force-dynamic";

const LIFT_ORDER: LiftKey[] = ["bench", "row", "squat", "deadlift", "ohp"];

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const tmMap = getTrainingMaxMap(user.id);
  const state = getProgramState(user.id);

  const rows: TmRow[] = LIFT_ORDER.map((liftKey) => ({
    liftKey,
    label: LIFT_LABELS[liftKey],
    trainingMax: tmMap.get(liftKey)?.trainingMax ?? null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <SettingsForm
        userId={user.id}
        rows={rows}
        program={{ cycle: state.cycle, week: state.week, nextSlot: state.nextSlot }}
        pausedUntil={state.pausedUntil}
      />
    </div>
  );
}
