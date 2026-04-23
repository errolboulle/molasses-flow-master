import { useMemo, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SmartAutocompleteInputProps = Omit<React.ComponentProps<typeof Input>, "onChange"> & {
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
};

export function SmartAutocompleteInput({ suggestions, value, onChange, className, onFocus, onBlur, onKeyDown, ...props }: SmartAutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = value.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!query) return [];
    return suggestions.filter((item) => item.toLowerCase().includes(query) && item.toLowerCase() !== query).slice(0, 8);
  }, [query, suggestions]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (open && matches.length > 0 && event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
      return;
    }
    if (open && matches.length > 0 && event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (open && matches.length > 0 && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      select(matches[activeIndex]);
      return;
    }
    onKeyDown?.(event);
  };

  return (
    <div className="relative">
      <Input
        {...props}
        value={value}
        className={className}
        autoComplete="off"
        onFocus={(event) => {
          setOpen(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          window.setTimeout(() => setOpen(false), 120);
          onBlur?.(event);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
      />
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-[var(--shadow-elevated)]">
          {matches.map((match, index) => {
            const lower = match.toLowerCase();
            const start = lower.indexOf(query);
            const end = start + query.length;
            return (
              <button
                key={match}
                type="button"
                className={cn("w-full rounded-sm px-2 py-2 text-left text-sm font-semibold text-popover-foreground", index === activeIndex && "bg-accent text-accent-foreground")}
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(match);
                }}
              >
                {start >= 0 ? <>{match.slice(0, start)}<mark className="bg-primary/25 text-foreground">{match.slice(start, end)}</mark>{match.slice(end)}</> : match}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}