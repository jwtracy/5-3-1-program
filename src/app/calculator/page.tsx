import { Calculator, type AmrapCard } from "@/components/calculator";
import { getLatestAmrapByLift, getTrainingMaxMap } from "@/db/queries";
import { getCurrentUser } from "@/lib/current-user";
import { epley1RM, LIFT_LABELS } from "@/lib/program";
import type { LiftKey } from "@/db/schema";

export const dynamic = "force-dynamic";

const LIFT_ORDER: LiftKey[] = ["bench", "squat", "deadlift", "ohp", "row"];

export default async function CalculatorPage() {
  const user = await getCurrentUser();
  const amrapByLift = getLatestAmrapByLift(user.id);
  const tmMap = getTrainingMaxMap(user.id);

  const amraps: AmrapCard[] = LIFT_ORDER.flatMap((liftKey) => {
    const a = amrapByLift.get(liftKey);
    if (!a) return [];
    return [
      {
        liftKey,
        label: LIFT_LABELS[liftKey],
        weight: a.weight,
        reps: a.reps,
        date: a.date,
        est1RM: epley1RM(a.weight, a.reps),
        currentTM: tmMap.get(liftKey)?.trainingMax ?? null,
      },
    ];
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">1RM Calculator</h1>
        <p className="text-sm text-muted-foreground">
          Epley estimate. Training Max = 90% of 1RM.
        </p>
      </div>
      <Calculator userId={user.id} amraps={amraps} />
    </div>
  );
}
