import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAct, useGame, useNow } from "@/hooks/use-game";
import { COMPANY_BY_ID, RESEARCH_BY_ID } from "@/game/config";
import {
  branchCost,
  companyEcon,
  companySaleQuote,
  companyValuation,
  personalMods,
  staffCapacity,
  upgradeCost,
} from "@/game/engine";
import { corpMods } from "@/game/corp";
import { duration, money } from "@/lib/format";
import {
  Card,
  Confirm,
  Empty,
  Loading,
  MiniChart,
  Pill,
  Row,
  Segmented,
  Stat,
} from "@/components/game/ui";
import { companyImage } from "@/components/game/art";
import { WALLET_REFRESH_MS, liveCompanyWallet, liveRentWallet } from "@/components/game/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/empire_/$inst")({
  head: () => ({
    meta: [
      { title: "Company dashboard — Capitalfortune" },
      { name: "description", content: "Company finances, staff, branches and upgrades." },
      { property: "og:title", content: "Company dashboard — Capitalfortune" },
      { property: "og:description", content: "Company finances, staff, branches and upgrades." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanyPage,
});

function CompanyPage() {
  const { inst } = Route.useParams();
  const { data } = useGame();
  const now = useNow(data?.offset ?? 0, WALLET_REFRESH_MS);
  const { run, pending } = useAct();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"finance" | "staff" | "upgrades" | "branches" | "sell">("finance");
  const [inject, setInject] = useState("");
  const [saleStep, setSaleStep] = useState<0 | 1 | 2>(0);
  if (!data) return <Loading />;
  const s = data.state;
  const o = s.companies[inst];
  if (!o)
    return (
      <Empty
        title="Company not found"
        text="It may have been sold."
        action={
          <Button asChild>
            <Link to="/empire">Back to empire</Link>
          </Button>
        }
      />
    );
  const d = COMPANY_BY_ID[o.defId]!;
  const e = companyEcon(o, personalMods(s), corpMods(data.corp), now);
  const q = companySaleQuote(o, now);
  const cap = staffCapacity(o, d);
  const hist = o.history.map((h) => ({ t: h.t, v: h.rev - h.exp }));

  return (
    <div>
      <Link
        to="/empire"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Empire
      </Link>
      {companyImage(d.id) && (
        <img
          src={companyImage(d.id)}
          alt={d.name}
          className="game-art mb-4 h-44 w-full object-cover"
        />
      )}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{d.name}</h1>
          <p className="text-sm text-muted-foreground">
            {d.industry} · {d.model}
          </p>
        </div>
        <Pill
          tone={
            e.status === "Profitable"
              ? "gain"
              : e.status === "Suspended" || e.status === "Distressed"
                ? "loss"
                : "warn"
          }
        >
          {e.status}
        </Pill>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Net /h" value={money(e.net)} tone={e.net >= 0 ? "gain" : "loss"} />
        <Stat label="Reserves" value={money(o.reserves)} />
        <Stat
          label="Wallet"
          value={money(liveCompanyWallet(o, e.net, s.lastTick, now))}
          tone="gain"
        />
      </div>

      {(e.status === "Distressed" || e.status === "Suspended" || e.status === "Unprofitable") && (
        <Card className="mb-4 border-warn/40 text-sm">
          <div className="font-semibold text-warn">Recovery options</div>
          <p className="mt-1 text-muted-foreground">
            Inject capital to pay liabilities, buy efficiency upgrades, hire to meet staffing, or
            suspend operations to cut costs.
          </p>
        </Card>
      )}

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: "finance", label: "Finances" },
          { id: "staff", label: "Staff" },
          { id: "upgrades", label: "Upgrades" },
          { id: "branches", label: "Branches" },
          { id: "sell", label: "Sell" },
        ]}
      />

      {tab === "finance" && (
        <div className="space-y-3">
          <Card>
            <div className="mb-1 text-sm font-semibold">Net profit per hour (last 72h)</div>
            <MiniChart data={hist} format={(v) => money(v)} />
          </Card>
          <Card>
            <Row label="Revenue /h" value={money(e.revenue)} tone="gain" />
            {Object.entries(e.breakdown).map(([k, v]) => (
              <Row key={k} label={`· ${k}`} value={money(-v)} />
            ))}
            <Row label="Total expenses /h" value={money(-e.expenses)} tone="loss" />
            <Row
              label="Staffing factor"
              value={`${Math.round(e.factor * 100)}%`}
              tone={e.factor < 1 ? "warn" : undefined}
            />
            <Row
              label="Liabilities"
              value={money(o.liabilities)}
              tone={o.liabilities ? "warn" : undefined}
            />
            <Row label="Lifetime revenue" value={money(o.revenueTotal)} />
            <Row label="Lifetime expenses" value={money(o.expenseTotal)} />
            <Row label="Valuation (price + upgrades)" value={money(companyValuation(o))} />
          </Card>
          <Button
            className="w-full bg-gradient-primary"
            disabled={pending || liveCompanyWallet(o, e.net, s.lastTick, now) < 0.01}
            onClick={() => run({ type: "collect", inst }, "Transferred to balance")}
          >
            Transfer {money(liveCompanyWallet(o, e.net, s.lastTick, now))} to balance
          </Button>
          <Card>
            <div className="mb-2 text-sm font-semibold">Capital injection</div>
            <p className="mb-2 text-xs text-muted-foreground">
              A transfer from your balance — pays liabilities first, then reserves. Not revenue.
            </p>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                placeholder="Amount"
                value={inject}
                onChange={(ev) => setInject(ev.target.value.replace(/[^0-9]/g, ""))}
              />
              <Button
                disabled={pending || !inject}
                onClick={() =>
                  run({ type: "inject", inst, amount: Number(inject) }, "Capital injected").then(
                    () => setInject(""),
                  )
                }
              >
                Inject
              </Button>
            </div>
          </Card>
          <Button
            variant="secondary"
            className="w-full"
            disabled={pending}
            onClick={() =>
              run(
                { type: "suspend", inst, on: !o.suspended },
                o.suspended ? "Operations resumed" : "Operations suspended",
              )
            }
          >
            {o.suspended ? "Resume operations" : "Suspend operations (cuts most costs, no revenue)"}
          </Button>
        </div>
      )}

      {tab === "staff" && (
        <div className="space-y-3">
          <Card>
            <Row label="Employees" value={`${e.staff} / ${cap}`} />
            <Row
              label="Minimum required"
              value={e.need}
              tone={e.staff < e.need ? "warn" : undefined}
            />
            <p className="mt-1 text-xs text-muted-foreground">{d.shortageRule}</p>
          </Card>
          {d.roles.map((r) => (
            <Card key={r.role}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{r.role}</div>
                  <div className="text-xs text-muted-foreground">
                    {money(r.recruit)} to hire · {money(r.salary)}/h salary
                  </div>
                </div>
                <div className="num text-lg">{o.staff[r.role] ?? 0}</div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  disabled={pending || e.staff >= cap}
                  onClick={() => run({ type: "hire", inst, role: r.role, count: 1 })}
                >
                  Hire 1
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending || e.staff + 5 > cap}
                  onClick={() => run({ type: "hire", inst, role: r.role, count: 5 })}
                >
                  Hire 5
                </Button>
                <Confirm
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || !(o.staff[r.role] ?? 0)}
                    >
                      Let go 1
                    </Button>
                  }
                  title={`Let go one ${r.role}?`}
                  description={`Termination cost ${money(r.salary * 8)} (8h salary), paid from reserves first.`}
                  onConfirm={() => run({ type: "fire", inst, role: r.role, count: 1 })}
                />
              </div>
              {d.packages.map((pk, i) => (
                <Button
                  key={pk.name}
                  size="sm"
                  variant="ghost"
                  className="mt-2 w-full justify-between"
                  disabled={pending || e.staff + pk.count > cap}
                  onClick={() =>
                    run(
                      { type: "hire", inst, role: r.role, count: pk.count, pkg: i },
                      `Hired ${pk.count}`,
                    )
                  }
                >
                  <span>{pk.name} package</span>
                  <span className="num">{money(r.recruit * pk.count * (1 - pk.discount))}</span>
                </Button>
              ))}
            </Card>
          ))}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Employee capacity</div>
                <div className="text-xs text-muted-foreground">
                  Level {o.capLevel}/{d.capacityUpgrade.max} · +{d.capacityUpgrade.add} per level ·
                  instant
                </div>
              </div>
            </div>
            <Button
              className="mt-3 w-full"
              variant="secondary"
              disabled={pending || o.capLevel >= d.capacityUpgrade.max}
              onClick={() => run({ type: "staffCapacity", inst }, "Capacity expanded")}
            >
              {o.capLevel >= d.capacityUpgrade.max
                ? "Maxed"
                : `Expand · ${money(upgradeCost(d.capacityUpgrade.cost, d.capacityUpgrade.growth, o.capLevel))}`}
            </Button>
          </Card>
        </div>
      )}

      {tab === "upgrades" && (
        <div className="space-y-3">
          {d.upgrades.map((u) => {
            const lvl = o.upgrades[u.id] ?? 0;
            const locked = u.research && !s.research.done.includes(u.research);
            const cost = upgradeCost(u.cost, u.growth, lvl);
            return (
              <Card key={u.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.desc} per level</div>
                  </div>
                  <Pill>
                    {lvl}/{u.max}
                  </Pill>
                </div>
                {locked && (
                  <div className="mt-2 text-xs text-warn">
                    Requires research: {RESEARCH_BY_ID[u.research!]?.name}
                  </div>
                )}
                <Button
                  className="mt-3 w-full"
                  variant="secondary"
                  disabled={pending || lvl >= u.max || !!locked || s.cash < cost}
                  onClick={() =>
                    run({ type: "companyUpgrade", inst, upgradeId: u.id }, `${u.name} upgraded`)
                  }
                >
                  {lvl >= u.max ? "Max level" : `Upgrade · ${money(cost)}`}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "branches" && (
        <div className="space-y-3">
          {!d.branch ? (
            <Empty
              title="No branches"
              text="This business model operates from a single location."
            />
          ) : (
            <Card>
              <Row label="Branches" value={`${o.branches} / ${d.branch.max}`} />
              <Row label="Revenue per branch /h" value={money(d.branch.revenue)} />
              <Row label="Expenses per branch /h" value={money(d.branch.expense)} />
              <Row label="Staff needed per branch" value={d.branch.staff} />
              <Confirm
                trigger={
                  <Button
                    className="mt-3 w-full bg-gradient-primary"
                    disabled={
                      pending || o.branches >= d.branch.max || s.cash < branchCost(d, o.branches)
                    }
                  >
                    {o.branches >= d.branch.max
                      ? "Max branches"
                      : `Open branch · ${money(branchCost(d, o.branches))}`}
                  </Button>
                }
                title="Open a new branch?"
                description={`Costs ${money(branchCost(d, o.branches))}. Each branch needs ${d.branch.staff} more staff and adds +${d.branch.staff} employee capacity.`}
                onConfirm={() => run({ type: "branch", inst }, "Branch opened")}
              />
            </Card>
          )}
        </div>
      )}

      {tab === "sell" && (
        <Card>
          <Row label="Valuation (price + upgrades)" value={money(companyValuation(o))} />
          <Row label="Reserves" value={money(q.reserves)} />
          <Row label="Uncollected profits" value={money(q.uncollected)} />
          <Row
            label="Liabilities"
            value={money(-q.liabilities)}
            tone={q.liabilities ? "warn" : undefined}
          />
          <Row label="Termination costs" value={money(-q.termination)} />
          <Row
            label="Personal funds needed to settle"
            value={money(q.injectionNeeded)}
            tone={q.injectionNeeded ? "loss" : undefined}
          />
          <div className="mt-1 border-t border-border pt-2">
            <Row label="You receive (80%)" value={money(q.payout)} tone="gain" />
          </div>
          {!q.eligible && (
            <p className="mt-2 text-xs text-warn">
              Sellable in {duration(q.eligibleAt - now)} (6-hour minimum ownership).
            </p>
          )}
          <Button
            variant="destructive"
            className="mt-3 w-full"
            disabled={!q.eligible || pending}
            onClick={() => setSaleStep(1)}
          >
            Review sale
          </Button>
        </Card>
      )}

      <AlertDialog open={saleStep === 1} onOpenChange={(v) => !v && setSaleStep(0)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Step 1 of 2 · Review</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm">
                Valuation {money(q.valuation)} incl. remaining reserves/profits. Payout at 80%:{" "}
                <b>{money(q.payout)}</b>. Obligations of {money(q.obligations)} will be settled
                first
                {q.injectionNeeded > 0
                  ? `, needing ${money(q.injectionNeeded)} from your balance`
                  : ""}
                .
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(ev) => {
                ev.preventDefault();
                setSaleStep(2);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={saleStep === 2} onOpenChange={(v) => !v && setSaleStep(0)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Final warning</AlertDialogTitle>
            <AlertDialogDescription>
              This sale is irreversible. All {e.staff} employees will be terminated, branches close,
              and income stops.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep company</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() =>
                run({ type: "sellCompany", inst, confirm: "SELL" }, "Company sold").then(() =>
                  navigate({ to: "/empire" }),
                )
              }
            >
              Sell permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
