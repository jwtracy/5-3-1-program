"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AmrapPoint } from "@/db/queries";
import type { LiftKey } from "@/db/schema";
import { epley1RM, LIFT_LABELS, roundTo } from "@/lib/program";

const LIFT_ORDER: LiftKey[] = ["bench", "squat", "deadlift", "ohp", "row"];

// The AMRAP set's rep status per 5/3/1 week (week 3's top set is a 1+).
const REP_STATUS: Record<number, string> = { 1: "5s", 2: "3s", 3: "1s" };
const repStatus = (week: number | null) => (week ? REP_STATUS[week] ?? "?" : "?");

const WINDOWS = [
  { key: "1mo", label: "1mo", days: 31 },
  { key: "3mo", label: "3mo", days: 92 },
  { key: "6mo", label: "6mo", days: 183 },
  { key: "1yr", label: "1yr", days: 366 },
] as const;
type WindowKey = (typeof WINDOWS)[number]["key"];

// Distinct hues for the 5/3/1 week scheme (readable on light + dark).
const WEEK_COLOR: Record<number, string> = {
  1: "#3b82f6", // 5s — blue
  2: "#f59e0b", // 3s — amber
  3: "#10b981", // 1s — green
  4: "#9ca3af", // deload (no AMRAP, here for completeness)
};

interface Point extends AmrapPoint {
  day: number; // epoch day
  est1RM: number;
}

interface TotalPoint {
  day: number;
  squat: number;
  bench: number;
  deadlift: number;
  total: number;
}

// The powerlifting total — squat + bench + deadlift (OHP excluded).
const BIG3: LiftKey[] = ["squat", "bench", "deadlift"];

/** ISO YYYY-MM-DD → whole days since epoch (UTC, no TZ skew). */
function epochDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function fmtDay(day: number): string {
  const d = new Date(day * 86_400_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export function ProgressView({
  series,
  today,
}: {
  series: Partial<Record<LiftKey, AmrapPoint[]>>;
  today: string;
}) {
  const [lift, setLift] = useState<LiftKey>("bench");
  const [windowKey, setWindowKey] = useState<WindowKey>("3mo");

  const todayDay = epochDay(today);
  const windowDays = WINDOWS.find((w) => w.key === windowKey)!.days;
  const cutoff = todayDay - windowDays;

  const points: Point[] = useMemo(() => {
    const raw = series[lift] ?? [];
    return raw
      .map((p) => ({ ...p, day: epochDay(p.date), est1RM: epley1RM(p.weight, p.reps) }))
      .filter((p) => p.day >= cutoff)
      .sort((a, b) => a.day - b.day);
  }, [series, lift, cutoff]);

  // Theoretical total: carry each lift's latest est 1RM forward and sum the big
  // three whenever any of them is re-tested.
  const totalPoints: TotalPoint[] = useMemo(() => {
    const events = BIG3.flatMap((lk) =>
      (series[lk] ?? []).map((p) => ({
        lk,
        day: epochDay(p.date),
        est: epley1RM(p.weight, p.reps),
      })),
    ).sort((a, b) => a.day - b.day);

    const latest: Partial<Record<LiftKey, number>> = {};
    const out: TotalPoint[] = [];
    for (const e of events) {
      latest[e.lk] = e.est;
      const { squat, bench, deadlift } = latest;
      if (squat == null || bench == null || deadlift == null) continue;
      const pt: TotalPoint = {
        day: e.day,
        squat,
        bench,
        deadlift,
        total: squat + bench + deadlift,
      };
      if (out.length && out[out.length - 1].day === e.day) out[out.length - 1] = pt;
      else out.push(pt);
    }
    return out.filter((p) => p.day >= cutoff);
  }, [series, cutoff]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {LIFT_ORDER.map((k) => (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={lift === k ? "default" : "outline"}
            onClick={() => setLift(k)}
          >
            {LIFT_LABELS[k]}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {WINDOWS.map((w) => (
          <Button
            key={w.key}
            type="button"
            size="sm"
            variant={windowKey === w.key ? "secondary" : "ghost"}
            onClick={() => setWindowKey(w.key)}
          >
            {w.label}
          </Button>
        ))}
      </div>

      <Card className="gap-3 p-4">
        <LiftChart points={points} cutoff={cutoff} todayDay={todayDay} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-foreground" /> est 1RM
          </span>
          {[1, 2, 3].map((wk) => (
            <span key={wk} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: WEEK_COLOR[wk] }}
              />
              {REP_STATUS[wk]} work set
            </span>
          ))}
        </div>
      </Card>

      <Card className="gap-3 p-4">
        <div>
          <p className="text-sm font-semibold">Theoretical total</p>
          <p className="text-xs text-muted-foreground">
            Squat + Bench + Deadlift estimated 1RMs over time.
          </p>
        </div>
        <TotalChart points={totalPoints} cutoff={cutoff} todayDay={todayDay} />
      </Card>
    </div>
  );
}

function LiftChart({
  points,
  cutoff,
  todayDay,
}: {
  points: Point[];
  cutoff: number;
  todayDay: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = 260;
  const padL = 44;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const layout = useMemo(() => {
    if (points.length === 0) return null;
    const weights = points.flatMap((p) => [p.weight, p.est1RM]);
    let y0 = Math.min(...weights);
    let y1 = Math.max(...weights);
    const padY = Math.max(5, (y1 - y0) * 0.1);
    y0 = Math.floor((y0 - padY) / 5) * 5;
    y1 = Math.ceil((y1 + padY) / 5) * 5;
    // x domain spans the selected window; single point sits at the right edge.
    const x0 = cutoff;
    const x1 = Math.max(todayDay, points[points.length - 1].day);
    const xSpan = x1 - x0 || 1;
    const ySpan = y1 - y0 || 1;
    const xS = (day: number) => padL + ((day - x0) / xSpan) * plotW;
    const yS = (w: number) => padT + (1 - (w - y0) / ySpan) * plotH;
    const yTicks = Array.from({ length: 4 }, (_, i) =>
      roundTo(y0 + ((y1 - y0) * i) / 3, 5),
    );
    const xTicks = Array.from({ length: 4 }, (_, i) => Math.round(x0 + (xSpan * i) / 3));
    return { x0, x1, y0, y1, xS, yS, yTicks, xTicks };
  }, [points, cutoff, todayDay, plotW, plotH]);

  if (!layout) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        No AMRAP sets in this window.
      </div>
    );
  }

  const { xS, yS, yTicks, xTicks } = layout;
  const estPath = points.map((p) => `${xS(p.day)},${yS(p.est1RM)}`).join(" ");
  const wtPath = points.map((p) => `${xS(p.day)},${yS(p.weight)}`).join(" ");

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xView = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xS(p.day) - xView);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover != null ? points[hover] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none select-none"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label="Lift progression chart"
    >
      {/* horizontal gridlines + y labels */}
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yS(t)}
            y2={yS(t)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text
            x={padL - 6}
            y={yS(t) + 3}
            textAnchor="end"
            fontSize={10}
            fill="var(--muted-foreground)"
          >
            {t}
          </text>
        </g>
      ))}

      {/* x labels */}
      {xTicks.map((t, i) => (
        <text
          key={i}
          x={xS(t)}
          y={H - 8}
          textAnchor="middle"
          fontSize={10}
          fill="var(--muted-foreground)"
        >
          {fmtDay(t)}
        </text>
      ))}

      {/* hover guide */}
      {hp && (
        <line
          x1={xS(hp.day)}
          x2={xS(hp.day)}
          y1={padT}
          y2={padT + plotH}
          stroke="var(--ring)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      {/* work-weight series: faint line + colored dots */}
      {points.length > 1 && (
        <polyline
          points={wtPath}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={1}
          strokeOpacity={0.4}
        />
      )}

      {/* est 1RM progression line */}
      {points.length > 1 && (
        <polyline
          points={estPath}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={2}
        />
      )}
      {points.map((p, i) => (
        <circle
          key={`e${i}`}
          cx={xS(p.day)}
          cy={yS(p.est1RM)}
          r={hover === i ? 3.5 : 2.5}
          fill="var(--foreground)"
        />
      ))}

      {/* work-weight dots, colored by 5/3/1 week */}
      {points.map((p, i) => (
        <circle
          key={`w${i}`}
          cx={xS(p.day)}
          cy={yS(p.weight)}
          r={hover === i ? 5 : 4}
          fill={WEEK_COLOR[p.week ?? 0] ?? "var(--muted-foreground)"}
          stroke="var(--background)"
          strokeWidth={1.5}
        >
          <title>{`${p.date}: ${p.weight} × ${p.reps} (${repStatus(p.week)}) · ≈ ${roundTo(p.est1RM, 1)} 1RM`}</title>
        </circle>
      ))}

      {/* tooltip */}
      {hp && (
        <ChartTooltip
          lines={[
            fmtDay(hp.day),
            `${hp.weight} × ${hp.reps} (${repStatus(hp.week)})`,
            `≈ ${roundTo(hp.est1RM, 1)} 1RM`,
          ]}
          x={xS(hp.day)}
          y={yS(hp.est1RM)}
          W={W}
        />
      )}
    </svg>
  );
}

function ChartTooltip({
  lines,
  x,
  y,
  W,
  boxW = 110,
}: {
  lines: string[];
  x: number;
  y: number;
  W: number;
  boxW?: number;
}) {
  const boxH = 16 + lines.length * 13;
  const bx = Math.min(Math.max(x - boxW / 2, 4), W - boxW - 4);
  const by = Math.max(y - boxH - 10, 4);
  return (
    <g pointerEvents="none">
      <rect
        x={bx}
        y={by}
        width={boxW}
        height={boxH}
        rx={6}
        fill="var(--popover)"
        stroke="var(--border)"
      />
      {lines.map((t, i) => (
        <text
          key={i}
          x={bx + 8}
          y={by + 14 + i * 13}
          fontSize={10}
          fill="var(--popover-foreground)"
          fontWeight={i === 0 ? 600 : 400}
        >
          {t}
        </text>
      ))}
    </g>
  );
}

function TotalChart({
  points,
  cutoff,
  todayDay,
}: {
  points: TotalPoint[];
  cutoff: number;
  todayDay: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = 220;
  const padL = 48;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const layout = useMemo(() => {
    if (points.length === 0) return null;
    const vals = points.map((p) => p.total);
    let y0 = Math.min(...vals);
    let y1 = Math.max(...vals);
    const padY = Math.max(10, (y1 - y0) * 0.1);
    y0 = Math.floor((y0 - padY) / 10) * 10;
    y1 = Math.ceil((y1 + padY) / 10) * 10;
    const x0 = cutoff;
    const x1 = Math.max(todayDay, points[points.length - 1].day);
    const xSpan = x1 - x0 || 1;
    const ySpan = y1 - y0 || 1;
    const xS = (day: number) => padL + ((day - x0) / xSpan) * plotW;
    const yS = (v: number) => padT + (1 - (v - y0) / ySpan) * plotH;
    const yTicks = Array.from({ length: 4 }, (_, i) =>
      roundTo(y0 + ((y1 - y0) * i) / 3, 5),
    );
    const xTicks = Array.from({ length: 4 }, (_, i) => Math.round(x0 + (xSpan * i) / 3));
    return { xS, yS, yTicks, xTicks };
  }, [points, cutoff, todayDay, plotW, plotH]);

  if (!layout) {
    return (
      <div className="flex h-[160px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Need squat, bench &amp; deadlift AMRAP sets in this window.
      </div>
    );
  }

  const { xS, yS, yTicks, xTicks } = layout;
  const path = points.map((p) => `${xS(p.day)},${yS(p.total)}`).join(" ");

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xView = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xS(p.day) - xView);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover != null ? points[hover] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none select-none"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label="Theoretical total chart"
    >
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yS(t)}
            y2={yS(t)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text
            x={padL - 6}
            y={yS(t) + 3}
            textAnchor="end"
            fontSize={10}
            fill="var(--muted-foreground)"
          >
            {t}
          </text>
        </g>
      ))}

      {xTicks.map((t, i) => (
        <text
          key={i}
          x={xS(t)}
          y={H - 8}
          textAnchor="middle"
          fontSize={10}
          fill="var(--muted-foreground)"
        >
          {fmtDay(t)}
        </text>
      ))}

      {hp && (
        <line
          x1={xS(hp.day)}
          x2={xS(hp.day)}
          y1={padT}
          y2={padT + plotH}
          stroke="var(--ring)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      {points.length > 1 && (
        <polyline points={path} fill="none" stroke="var(--foreground)" strokeWidth={2} />
      )}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={xS(p.day)}
          cy={yS(p.total)}
          r={hover === i ? 4.5 : 3.5}
          fill="var(--foreground)"
        >
          <title>{`${fmtDay(p.day)}: total ${roundTo(p.total, 1)} (S ${roundTo(p.squat, 1)} · B ${roundTo(p.bench, 1)} · D ${roundTo(p.deadlift, 1)})`}</title>
        </circle>
      ))}

      {hp && (
        <ChartTooltip
          lines={[
            `${fmtDay(hp.day)} · total ${roundTo(hp.total, 1)}`,
            `S ${roundTo(hp.squat, 1)} · B ${roundTo(hp.bench, 1)} · D ${roundTo(hp.deadlift, 1)}`,
          ]}
          x={xS(hp.day)}
          y={yS(hp.total)}
          W={W}
          boxW={150}
        />
      )}
    </svg>
  );
}
