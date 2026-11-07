import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useAct, useGame, useNow } from "@/hooks/use-game";
import { BALANCE, PROPERTY_BY_ID, PROPERTY_UPGRADES } from "@/game/config";
import { conditionLabel, personalMods, propertyEcon, propertyValue } from "@/game/engine";
import { corpMods } from "@/game/corp";
import { date, money, pct } from "@/lib/format";
import { Card, Confirm, Empty, Loading, Pill, Progress, Row } from "@/components/game/ui";
import { propertyImage } from "@/components/game/art";
import { WALLET_REFRESH_MS, liveCompanyWallet, liveRentWallet } from "@/components/game/wallet";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/realestate_/$inst")({
  head: () => ({
    meta: [
      { title: "Property — Capitalfortune" },
      { name: "description", content: "Rental performance, maintenance and upgrades." },
      { property: "og:title", content: "Property — Capitalfortune" },
      { property: "og:description", content: "Rental performance, maintenance and upgrades." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PropertyPage,
});

function PropertyPage() {
  const { inst } = Route.useParams();
  const { data } = useGame();
  const now = useNow(data?.offset ?? 0, WALLET_REFRESH_MS);
  const { run, pending } = useAct();
  const navigate = useNavigate();
  if (!data) return <Loading />;
  const s = data.state;
  const pr = s.properties[inst];
  if (!pr)
    return (
      <Empty
        title="Property not found"
        action={
          <Button asChild>
            <Link to="/realestate">Back</Link>
          </Button>
        }
      />
    );
  const d = PROPERTY_BY_ID[pr.defId]!;
  const e = propertyEcon(pr, personalMods(s), corpMods(data.corp), now);
  const value = propertyValue(pr);
  const maintCost = Math.round(pr.price * 0.02 * ((100 - pr.condition) / 100) + 50);
  return (
    <div>
      <Link
        to="/realestate"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Real estate
      </Link>
      <img
        src={propertyImage(d.category)}
        alt={d.name}
        className="mb-3 h-48 w-full rounded-xl object-cover"
      />
      <h1 className="text-2xl font-bold">{d.name}</h1>
      <p className="mb-3 text-sm text-muted-foreground">
        {d.category} · {d.location} · bought {date(pr.boughtAt)}
      </p>
      <Card className="mb-3">
        <Row label="Gross rent /h" value={money(e.gross)} tone="gain" />
        <Row label="Operating expenses /h" value={money(-e.expenses)} />
        <Row label="Net rent /h" value={money(e.net)} tone={e.net >= 0 ? "gain" : "loss"} />
        <Row label="Occupancy" value={pct(e.occupancy)} />
        <Row label="Demand multiplier" value={`×${e.demand.toFixed(2)}`} />
        <Row label="Lifetime net rent" value={money(pr.rentTotal)} />
      </Card>
      <Card className="mb-3 border-primary/40">
        <div className="text-xs text-muted-foreground">Rent wallet · {money(e.net)}/h</div>
        <div className="num text-2xl font-bold text-gain">
          {money(liveRentWallet(pr, e.net, s.lastTick, now))}
        </div>
        <Button
          className="mt-2 w-full bg-gradient-primary"
          disabled={pending || liveRentWallet(pr, e.net, s.lastTick, now) < 0.01}
          onClick={() => run({ type: "collectRent", inst }, "Transferred to balance")}
        >
          Transfer to balance
        </Button>
      </Card>
      <Card className="mb-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Condition</div>
          <Pill tone={pr.condition >= 65 ? "gain" : pr.condition >= 40 ? "warn" : "loss"}>
            {conditionLabel(pr.condition)} · {Math.round(pr.condition)}%
          </Pill>
        </div>
        <Progress value={pr.condition / 100} className="mt-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          Degrades ~{BALANCE.propertyDecayPerDay}% per day. Poor condition lowers occupancy and
          rent.
        </p>
        <Button
          className="mt-3 w-full"
          variant="secondary"
          disabled={pending || pr.condition >= 99}
          onClick={() => run({ type: "maintain", inst }, "Maintenance done")}
        >
          Maintain · {money(maintCost)}
        </Button>
      </Card>
      <div className="mb-3 space-y-2">
        {PROPERTY_UPGRADES.filter((u) => u.categories.includes(d.category)).map((u) => {
          const lvl = pr.upgrades[u.id] ?? 0;
          const cost = Math.round(d.price * u.costPct * Math.pow(1.5, lvl));
          const locked = u.research && !s.research.done.includes(u.research);
          return (
            <Card key={u.id} className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {u.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    {lvl}/{u.max}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {u.desc}
                  {locked ? " · needs research" : ""}
                </div>
              </div>
              <Button
                size="sm"
                disabled={pending || lvl >= u.max || !!locked || s.cash < cost}
                onClick={() => run({ type: "propertyUpgrade", inst, upgradeId: u.id }, "Upgraded")}
              >
                {lvl >= u.max ? "Max" : money(cost)}
              </Button>
            </Card>
          );
        })}
      </div>
      <Card>
        <Row label="Purchase price" value={money(pr.price)} />
        <Row label="Upgrade value" value={money(pr.upgradeValue)} />
        <Row label="Current value" value={money(value)} />
        <Row
          label="Resale payout (75%)"
          value={money(value * BALANCE.propertyResalePct)}
          tone="gain"
        />
        <Confirm
          destructive
          trigger={
            <Button variant="destructive" className="mt-3 w-full" disabled={pending}>
              Sell property
            </Button>
          }
          title="Sell this property?"
          description={`You'll receive ${money(value * BALANCE.propertyResalePct)}. Rent stops immediately. This cannot be undone.`}
          confirmLabel="Sell"
          onConfirm={() =>
            run({ type: "sellProperty", inst }, "Property sold").then(() =>
              navigate({ to: "/realestate" }),
            )
          }
        />
      </Card>
    </div>
  );
}
