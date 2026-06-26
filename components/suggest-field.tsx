"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function parse(value: string) {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function SuggestField({
  id,
  name,
  label,
  placeholder,
  suggestions,
  defaultValue = "",
}: {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  suggestions: string[];
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const tokens = parse(value);
  const has = (s: string) =>
    tokens.some((t) => t.toLowerCase() === s.toLowerCase());

  function toggle(s: string) {
    const next = has(s)
      ? tokens.filter((t) => t.toLowerCase() !== s.toLowerCase())
      : [...tokens, s];
    setValue(next.join(", "));
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => {
          const active = has(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(s)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-input text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              )}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
