import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "history", label: "History", href: "/history" },
  { key: "progress", label: "Progress", href: "/progress" },
] as const;

/** History ⇄ Progress switcher, shown on both pages (5/3/1 users only). */
export function SectionTabs({ active }: { active: "history" | "progress" }) {
  return (
    <div className="flex w-fit items-center gap-1 rounded-lg border p-1">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            t.key === active
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
