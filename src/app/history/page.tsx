import Link from "next/link";
import { HistoryView } from "@/components/history-view";
import { SectionTabs } from "@/components/section-tabs";
import { getHistory } from "@/db/queries";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  const history = getHistory(user.id);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <a
          href="/history/export"
          download
          className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50"
        >
          Export CSV
        </a>
      </div>

      <SectionTabs active="history" />

      {history.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-lg font-medium">No sessions logged yet</p>
          <p className="text-sm text-muted-foreground">
            Log your first workout from the home screen.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Go to today →
          </Link>
        </div>
      ) : (
        <HistoryView history={history} />
      )}
    </div>
  );
}
