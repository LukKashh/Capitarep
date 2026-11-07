import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAct } from "@/hooks/use-game";
import { duration, money, pct } from "@/lib/format";
import type { OfflineReport } from "@/game/types";
import { Row } from "./ui";

export function OfflineReportDialog({ report }: { report: OfflineReport }) {
  const { run, pending } = useAct();
  return (
    <Dialog open onOpenChange={(o) => !o && run({ type: "dismissOffline" })}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Welcome back</DialogTitle>
          <DialogDescription>
            You were away for {duration(report.awaySec * 1000)}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {report.lines.map((l, i) => (
            <div key={i} className="rounded-lg bg-muted/50 px-3 py-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{l.name}</span>
                <span className={`num ${l.amount >= 0 ? "text-gain" : "text-loss"}`}>
                  {money(l.amount, { sign: true })}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {l.hours.toFixed(2)}h eligible · {l.note}
              </div>
            </div>
          ))}
          {report.rent !== 0 && (
            <Row
              label="Net rental income"
              value={money(report.rent, { sign: true })}
              tone={report.rent >= 0 ? "gain" : "loss"}
            />
          )}
          {report.rp > 0 && <Row label="Research points" value={`+${Math.floor(report.rp)} RP`} />}
          {report.bonusPct > 0 && (
            <Row label="Active business bonuses" value={pct(report.bonusPct)} />
          )}
          <div className="border-t border-border pt-2">
            <Row
              label="Credited to balance"
              value={money(report.total, { sign: true })}
              tone="gain"
            />
          </div>
        </div>
        <Button
          disabled={pending}
          onClick={() => run({ type: "dismissOffline" })}
          className="w-full bg-gradient-primary"
        >
          Collect & continue
        </Button>
      </DialogContent>
    </Dialog>
  );
}
