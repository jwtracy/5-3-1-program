"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StepperProps {
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  ariaLabel: string;
}

/** A +/- number input tuned for touch (large tap targets). */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  ariaLabel,
}: StepperProps) {
  const adjust = (delta: number) => {
    const base = value ?? 0;
    const next = Math.max(min, base + delta);
    onChange(next);
  };

  return (
    <div className="flex items-stretch">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 rounded-r-none"
        onClick={() => adjust(-step)}
        aria-label={`Decrease ${ariaLabel}`}
      >
        <Minus className="size-4" />
      </Button>
      <Input
        inputMode="decimal"
        aria-label={ariaLabel}
        className="h-11 w-16 rounded-none border-x-0 text-center text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value.trim();
          onChange(v === "" ? null : Number(v));
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 rounded-l-none"
        onClick={() => adjust(step)}
        aria-label={`Increase ${ariaLabel}`}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
