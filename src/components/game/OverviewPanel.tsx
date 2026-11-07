import { useMemo } from "react";
import { AlertTriangle, Bell } from "lucide-react";
import { useGame, useNow } from "@/hooks/use-game";
import { companyEcon, netWorth, personalMods, propertyEcon, UNLOCKS } from "@/game/engine";
import { corpMods } from "@/game/corp";
import { COMPANY_BY_ID } from "@/game/config";
import { ago, money } from "@/lib/format";
import { Card, Pill, Stat } from "@/components/game/ui";

/** Empire-wide income, alerts, unlocks and activity (moved off the clicker screen). */
export function OverviewPanel() {
  const { data } = useGame();
  const now = useNow(data?.offset ?? 0, 5000);
  const view = useMemo(() => {
    if (!data) return null;
    const s = data.state;
    const p = personalMods(s);
    const cm = corpMods(data.corp);
    let income = 0,
      uncollected = 0,
      rent = 0;
    const alerts: string[] = [];
    for (const o of Object.values(s.companies)) {
      const e = companyEcon(o, p, cm, now);
      income += e.net;
      uncollected += o.uncollected;
      if (e.status === "Distressed" || e.status === "Suspended" || e.status === "Unprofitable")
        alerts.push(`${COMPANY_BY_ID[o.defId]?.name}: ${e.status}`);
      if (e.need > e.staff) alerts.push(`${COMPANY_BY_ID[o.defId]?.name} is understaffed`);
    }
    for (const pr of Object.values(s.properties)) rent += propertyEcon(pr, p, cm, now).net;
    return { s, income, rent, alerts, uncollected, nw: netWorth(s, now) };
  }, [data, now]);
  if (!view) return null;
  const { s } = view;
  return (
    <div className="mb-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Business income /h"
          value={money(view.income)}
          tone={view.income >= 0 ? "gain" : "loss"}
          sub={`${Object.keys(s.companies).length}/${s.capacity.slots} companies`}
        />
        <Stat
          label="Net rent /h"
          value={money(view.rent)}
          tone={view.rent >= 0 ? "gain" : "loss"}
          sub={`${Object.keys(s.properties).length} properties`}
        />
        <Stat
          label="Portfolio"
          value={money(view.nw.stocks + view.nw.crypto)}
          sub={`Stocks ${money(view.nw.stocks)}`}
        />
        <Stat
          label="Net worth"
          value={money(view.nw.total)}
          sub={`Collectibles ${money(view.nw.collectibles)}`}
        />
      </div>
      {view.uncollected > 1 && (
        <Card className="flex items-center justify-between border-primary/40">
          <span className="text-sm">Uncollected profits waiting</span>
          <span className="num font-semibold text-gain">{money(view.uncollected)}</span>
        </Card>
      )}
      {view.alerts.length > 0 && (
        <Card className="border-warn/40">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-warn">
            <AlertTriangle className="h-4 w-4" />
            Alerts
          </div>
          {view.alerts.slice(0, 5).map((a) => (
            <div key={a} className="text-sm text-muted-foreground">
              • {a}
            </div>
          ))}
        </Card>
      )}
      {s.level < UNLOCKS.corporation && (
        <Card>
          <div className="text-sm font-semibold">Next unlocks</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {Object.entries(UNLOCKS)
              .filter(([, l]) => l > s.level)
              .map(([k, l]) => (
                <Pill key={k}>
                  Lv {l}: {k.replace(/([A-Z])/g, " $1").toLowerCase()}
                </Pill>
              ))}
          </div>
        </Card>
      )}
      <Card>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4 text-primary" />
          Activity
        </div>
        {s.notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Tap the coin to make your first dollar.
          </p>
        ) : (
          <div className="space-y-1.5">
            {s.notifications.slice(0, 8).map((n) => (
              <div key={n.id} className="flex justify-between gap-3 text-sm">
                <span className="truncate">{n.text}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{ago(n.t, now)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
