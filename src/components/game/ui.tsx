import { useState, type ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "game-panel rounded-lg border border-border bg-card p-4",
        onClick && "cursor-pointer active:scale-[0.99] transition",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "gain" | "loss" | "warn" | "primary";
}) {
  return (
    <div className="game-stat min-w-0 rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "num mt-1 text-lg font-semibold",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-loss",
          tone === "warn" && "text-warn",
          tone === "primary" && "text-primary",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Row({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "gain" | "loss" | "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "num text-right",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-loss",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center game-panel rounded-lg border border-border px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "gain" | "loss" | "warn" | "primary" | "gold";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "gain" && "bg-gain/15 text-gain",
        tone === "loss" && "bg-loss/15 text-loss",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "primary" && "bg-primary/15 text-primary",
        tone === "gold" && "bg-gold/15 text-gold",
      )}
    >
      {children}
    </span>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={cn("game-progress h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className="h-full rounded-full bg-gradient-primary transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

export function Confirm({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  destructive,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const RANGES = [
  { id: "24h", ms: 86400_000 },
  { id: "7d", ms: 7 * 86400_000 },
  { id: "30d", ms: 30 * 86400_000 },
  { id: "90d", ms: 90 * 86400_000 },
  { id: "1y", ms: 365 * 86400_000 },
  { id: "All", ms: 5 * 365 * 86400_000 },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];

export function RangeTabs({ value, onChange }: { value: RangeId; onChange: (v: RangeId) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {RANGES.map((r) => (
        <Button
          variant="ghost"
          size="sm"
          key={r.id}
          onClick={() => onChange(r.id)}
          className={cn(
            "flex-1 rounded-md px-2 py-1 text-xs font-medium",
            value === r.id ? "game-button text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {r.id}
        </Button>
      ))}
    </div>
  );
}
export function useRange(initial: RangeId = "24h") {
  const [range, setRange] = useState<RangeId>(initial);
  return { range, setRange, ms: RANGES.find((r) => r.id === range)?.ms ?? RANGES[0].ms };
}

export function MiniChart({
  data,
  height = 140,
  format,
}: {
  data: { t: number; v: number }[];
  height?: number;
  format?: (v: number) => string;
}) {
  if (data.length < 2)
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground"
        style={{ height }}
      >
        Not enough history yet
      </div>
    );
  const up = (data.at(-1)?.v ?? 0) >= (data[0]?.v ?? 0);
  const color = up ? "var(--gain)" : "var(--loss)";
  const id = `g${up ? "u" : "d"}`;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
            formatter={(v) => [format ? format(Number(v)) : Number(v).toFixed(2), ""]}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
      {options.map((o) => (
        <Button
          variant="ghost"
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-w-fit flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
            value === o.id ? "game-button text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

export function ActionButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button {...props} className={cn("h-10", props.className)}>
      {children}
    </Button>
  );
}
