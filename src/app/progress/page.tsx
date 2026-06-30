import { ProgressView } from "@/components/progress-view";
import { SectionTabs } from "@/components/section-tabs";
import { getAmrapHistoryByLift } from "@/db/queries";
import { getCurrentUser } from "@/lib/current-user";
import { todayISO } from "@/lib/dates";
import type { AmrapPoint } from "@/db/queries";
import type { LiftKey } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await getCurrentUser();
  const byLift = getAmrapHistoryByLift(user.id);
  const series = Object.fromEntries(byLift) as Partial<Record<LiftKey, AmrapPoint[]>>;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="text-sm text-muted-foreground">
          Work-set weight (by 5/3/1 week) with estimated 1RM over time.
        </p>
      </div>

      <SectionTabs active="progress" />

      <ProgressView series={series} today={todayISO()} />
    </div>
  );
}
