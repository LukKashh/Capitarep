import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Clock } from "lucide-react";
import { useAct, useGame, useNow } from "@/hooks/use-game";
import { COMPANIES, type CompanyDef } from "@/game/config";
import {
  capacityUpgradeCost,
  capacityUpgradeHours,
  companyEcon,
  companyValuation,
  personalMods,
} from "@/game/engine";
import { corpMods } from "@/game/corp";
import { duration, money } from "@/lib/format";
import {
  Card,
  Confirm,
  Empty,
  Loading,
  PageHeader,
  Pill,
  Progress,
  Row,
  Segmented,
  Stat,
} from "@/components/game/ui";
import { Button } from "@/components/ui/button";
import { companyImage } from "@/components/game/art";
import { WALLET_REFRESH_MS, liveCompanyWallet, liveRentWallet } from "@/components/game/wallet";
import { OverviewPanel } from "@/components/game/OverviewPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/empire")({
  head: () => ({
    meta: [
      { title: "Business Empire — Capitalfortune" },
      { name: "description", content: "Manage and acquire companies." },
      { property: "og:title", content: "Business Empire — Capitalfortune" },
      { property: "og:description", content: "Manage and acquire companies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmpirePage,
});

const statusTone = (s: string) =>
  (s === "Profitable"
    ? "gain"
    : s === "Break-even"
      ? "muted"
      : s === "Unprofitable"
        ? "warn"
        : "loss") as "gain" | "muted" | "warn" | "loss";

function EmpirePage() {
  const { data } = useGame();
  const now = useNow(data?.offset ?? 0, WALLET_REFRESH_MS);
  const { run, pending } = useAct();
  const [tab, setTab] = useState<"owned" | "market" | "report">("owned");
  const [detail, setDetail] = useState<CompanyDef | null>(null);
  if (!data) return <Loading />;
  const s = data.state;
  const p = personalMods(s);
  const cm = corpMods(data.corp);
  const owned = Object.values(s.companies);
  const econ = owned.map((o) => ({ o, e: companyEcon(o, p, cm, now) }));
  const totals = econ.reduce(
    (a, { o, e }) => ({
      rev: a.rev + e.revenue,
      exp: a.exp + e.expenses,
      val: a.val + companyValuation(o),
      unc: a.unc + liveCompanyWallet(o, e.net, s.lastTick, now),
      inv: a.inv + o.price + o.upgradeValue,
      life: a.life + o.revenueTotal - o.expenseTotal,
    }),
    { rev: 0, exp: 0, val: 0, unc: 0, inv: 0, life: 0 },
  );
  const up = s.capacity.upgrading;
  const capCost = capacityUpgradeCost(s.capacity.level);

  return (
    <div>
      <PageHeader
        title="Business Empire"
        subtitle={`${owned.length}/${s.capacity.slots} company slots used`}
      />

      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Business Management</div>
            <div className="text-xs text-muted-foreground">
              Each upgrade adds exactly +1 company slot
            </div>
          </div>
          {up ? (
            <Pill tone="primary">
              <Clock className="mr-1 h-3 w-3" />
              {duration(up.endsAt - now)}
            </Pill>
          ) : null}
        </div>
        {up ? (
          <>
            <Progress
              className="mt-3"
              value={1 - (up.endsAt - now) / (capacityUpgradeHours(s.capacity.level) * 3600_000)}
            />
            <p className="mt-2 text-xs text-warn">
              While upgrading you can't buy new companies. Existing companies keep running.
            </p>
          </>
        ) : (
          <Confirm
            trigger={
              <Button variant="secondary" className="mt-3 w-full" disabled={s.cash < capCost}>
                Upgrade to {s.capacity.slots + 1} slots · {money(capCost)} ·{" "}
                {duration(capacityUpgradeHours(s.capacity.level) * 3600_000)}
              </Button>
            }
            title="Start capacity upgrade?"
            description={
              <>
                Costs {money(capCost)} and takes{" "}
                {duration(capacityUpgradeHours(s.capacity.level) * 3600_000)} of real time. You
                can't buy companies until it completes.
              </>
            }
            onConfirm={() => run({ type: "capacityUpgrade" }, "Upgrade started")}
          />
        )}
      </Card>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: "owned", label: "My companies" },
          { id: "market", label: "Marketplace" },
          { id: "report", label: "Report" },
        ]}
      />

      {tab === "owned" && (
        <div className="space-y-3">
          {owned.length > 0 && (
            <Card className="border-primary/40">
              <div className="text-xs text-muted-foreground">
                Business wallet · {money(totals.rev - totals.exp)}/h
              </div>
              <div className="num text-2xl font-bold text-gain">{money(totals.unc)}</div>
              <Button
                className="mt-2 w-full bg-gradient-primary"
                disabled={pending || totals.unc < 0.01}
                onClick={() => run({ type: "collect" }, "Transferred to balance")}
              >
                Transfer to balance
              </Button>
            </Card>
          )}
          {owned.length === 0 ? (
            <Empty
              icon={<Building2 className="h-8 w-8" />}
              title="No companies yet"
              text="Earn your first $1,000 with the clicker, then buy Sunny Lemonade Stands from the marketplace."
              action={<Button onClick={() => setTab("market")}>Browse marketplace</Button>}
            />
          ) : (
            econ.map(({ o, e }) => {
              const d = COMPANIES.find((c) => c.id === o.defId)!;
              return (
                <Link key={o.inst} to="/empire/$inst" params={{ inst: o.inst }}>
                  <Card className="mb-3">
                    {companyImage(d.id) && (
                      <img
                        src={companyImage(d.id)}
                        alt={d.name}
                        className="game-art float-left mr-3 h-20 w-24"
                      />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{d.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.industry} · {o.branches} branches · {e.staff}/{e.need} staff
                        </div>
                      </div>
                      <Pill tone={statusTone(e.status)}>{e.status}</Pill>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Revenue/h</div>
                        <div className="num">{money(e.revenue)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Expenses/h</div>
                        <div className="num">{money(e.expenses)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Net/h</div>
                        <div className={`num ${e.net >= 0 ? "text-gain" : "text-loss"}`}>
                          {money(e.net)}
                        </div>
                      </div>
                    </div>
                    <div className="num mt-2 text-xs text-gain">
                      Wallet: {money(liveCompanyWallet(o, e.net, s.lastTick, now))}
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      )}

      {tab === "market" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Fixed catalogue · every company is available from day one. Catalogue data is shared;
            ownership is yours.
          </p>
          {[...COMPANIES]
            .sort((a, b) => a.price - b.price)
            .map((d) => (
              <Card key={d.id} onClick={() => setDetail(d)}>
                {companyImage(d.id) && (
                  <img
                    src={companyImage(d.id)}
                    alt={d.name}
                    className="game-art float-left mr-3 h-20 w-24"
                    loading="lazy"
                  />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.industry} · {d.model}
                    </div>
                  </div>
                  <div className="num shrink-0 whitespace-nowrap text-right font-semibold">
                    {money(d.price)}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill tone="primary">Business wallet</Pill>
                  <Pill>
                    {d.offlineEligible ? `Offline ${d.offlineMaxHours}h` : "No offline income"}
                  </Pill>
                  <Pill>{d.minStaff ? `Needs ${d.minStaff} staff` : "No staff needed"}</Pill>
                </div>
              </Card>
            ))}
        </div>
      )}

      {tab === "report" && (
        <div className="space-y-3">
          <OverviewPanel />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Revenue /h" value={money(totals.rev)} />
            <Stat label="Expenses /h" value={money(totals.exp)} />
            <Stat
              label="Net profit /h"
              value={money(totals.rev - totals.exp)}
              tone={totals.rev >= totals.exp ? "gain" : "loss"}
            />
            <Stat label="Valuation" value={money(totals.val)} />
            <Stat label="Invested" value={money(totals.inv)} />
            <Stat
              label="Lifetime ROI"
              value={totals.inv ? `${((totals.life / totals.inv) * 100).toFixed(1)}%` : "—"}
              tone={totals.life >= 0 ? "gain" : "loss"}
            />
          </div>
          <Card>
            <div className="mb-2 text-sm font-semibold">Sale history</div>
            {s.soldCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No companies sold yet.</p>
            ) : (
              s.soldCompanies.map((x, i) => <Row key={i} label={x.name} value={money(x.payout)} />)
            )}
          </Card>
        </div>
      )}

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.name}</SheetTitle>
              </SheetHeader>
              {companyImage(detail.id) && (
                <img
                  src={companyImage(detail.id)}
                  alt={detail.name}
                  className="game-art mt-3 h-40 w-full object-cover"
                />
              )}
              <p className="mt-1 text-sm text-muted-foreground">{detail.modelDesc}</p>
              <div className="mt-3 divide-y divide-border">
                <Row label="Price" value={money(detail.price)} />
                <Row label="Base revenue /h" value={money(detail.revenue)} />
                <Row label="Fixed expenses /h" value={money(detail.fixedExpense)} />
                <Row label="Starting reserves" value={money(detail.reserves)} />
                <Row
                  label="Existing liabilities"
                  value={money(detail.liabilities)}
                  tone={detail.liabilities ? "warn" : undefined}
                />
                <Row
                  label="Starting workforce"
                  value={`${detail.startStaff} (cap ${detail.staffCapacity})`}
                />
                <Row
                  label="Roles"
                  value={detail.roles.map((r) => `${r.role} $${r.salary}/h`).join(", ")}
                />
                <Row
                  label="Branches"
                  value={
                    detail.branch
                      ? `Up to ${detail.branch.max}, from ${money(detail.branch.cost)}`
                      : "Not available"
                  }
                />
                <Row
                  label="Offline income"
                  value={
                    detail.offlineEligible ? `Up to ${detail.offlineMaxHours}h` : "Not eligible"
                  }
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Staffing rule: {detail.shortageRule}
              </p>
              <Confirm
                trigger={
                  <Button
                    className="mt-4 h-11 w-full bg-gradient-primary"
                    disabled={
                      pending || s.cash < detail.price || !!up || owned.length >= s.capacity.slots
                    }
                  >
                    {up
                      ? "Capacity upgrade in progress"
                      : owned.length >= s.capacity.slots
                        ? "No free slots"
                        : s.cash < detail.price
                          ? `Need ${money(detail.price - s.cash)} more`
                          : `Buy for ${money(detail.price)}`}
                  </Button>
                }
                title={`Buy ${detail.name}?`}
                description={
                  <>
                    {money(detail.price)} will be deducted from your balance. You must own it for at
                    least 6 hours before reselling (80% of valuation).
                  </>
                }
                onConfirm={() =>
                  run({ type: "buyCompany", defId: detail.id }, `Acquired ${detail.name}`).then(
                    () => setDetail(null),
                  )
                }
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
