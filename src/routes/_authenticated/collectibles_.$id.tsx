import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useAct, useGame, useNow } from "@/hooks/use-game";
import {
  CATEGORY_BY_ID,
  COLLECTIBLE_BY_ID,
  COLLECTIONS,
  HOLD_HOURS,
  RESALE_PCT,
  currentValue,
  demandLabel,
  valueSeries,
} from "@/game/collectibles";
import { getCollectibleStock } from "@/lib/game.functions";
import { date, duration, money, pct } from "@/lib/format";
import {
  Card,
  Confirm,
  Empty,
  Loading,
  MiniChart,
  Pill,
  RangeTabs,
  Row,
  useRange,
} from "@/components/game/ui";
import { CollectibleIcon } from "@/components/game/CollectibleIcon";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/collectibles_/$id")({
  head: () => ({
    meta: [
      { title: "Collectible — Capitalfortune" },
      { name: "description", content: "Item details, valuation history and ownership." },
      { property: "og:title", content: "Collectible — Capitalfortune" },
      { property: "og:description", content: "Item details, valuation history and ownership." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ItemPage,
});

function ItemPage() {
  const { id } = Route.useParams();
  const { data } = useGame();
  const now = useNow(data?.offset ?? 0, 30_000);
  const { run, pending } = useAct();
  const { range, setRange, ms } = useRange("30d");
  const { data: stock, refetch } = useQuery({
    queryKey: ["collectible-stock"],
    queryFn: () => getCollectibleStock(),
    staleTime: 30_000,
  });
  const it = COLLECTIBLE_BY_ID[id];
  const chart = useMemo(() => (it ? valueSeries(it, now - ms, now, 60) : []), [it, now, ms]);
  if (!data) return <Loading />;
  if (!it) return <Empty title="Item not found" />;
  const s = data.state;
  const cat = CATEGORY_BY_ID[it.category]!;
  const v = currentValue(it, now);
  const copies = Object.values(s.collectibles).filter((o) => o.itemId === it.id);
  const sold = stock?.[it.id] ?? 0;
  const released = !it.releaseAt || it.releaseAt <= now;
  const left = it.limited ? it.limited - sold : null;
  const cols = COLLECTIONS.filter((c) => c.items.includes(it.id));
  const ownedIds = new Set(Object.values(s.collectibles).map((o) => o.itemId));
  const history = s.collectibleSales.filter((x) => x.itemId === it.id);

  return (
    <div>
      <Link
        to="/collectibles"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Collectibles
      </Link>
      <div className="mb-4 flex gap-4">
        <CollectibleIcon category={it.category} rarity={it.rarity} className="h-24 w-24 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{it.name}</h1>
          <p className="text-xs text-muted-foreground">
            ID {it.id} · {cat.name} / {it.sub}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Pill tone="primary">{it.rarity}</Pill>
            <Pill tone={it.limited ? "gold" : "muted"}>
              {it.limited ? `Limited · ${it.limited} copies` : "Standard edition"}
            </Pill>
          </div>
        </div>
      </div>
      <Card className="mb-3">
        <div className="num mb-1 text-2xl font-bold">{money(v)}</div>
        <MiniChart data={chart} format={(x) => money(x)} />
        <div className="mt-2">
          <RangeTabs value={range} onChange={setRange} />
        </div>
      </Card>
      <Card className="mb-3">
        <Row label="Purchase price" value={money(it.price)} />
        <Row label="Base valuation" value={money(it.baseValue)} />
        <Row label="Current estimate" value={money(v)} />
        <Row
          label="Change vs base"
          value={pct(v / it.baseValue - 1, 1, true)}
          tone={v >= it.baseValue ? "gain" : "loss"}
        />
        <Row label="Demand" value={demandLabel(it, now)} />
        <Row label="Volatility" value={pct(cat.volatility, 0)} />
        <Row label="Valuation updates" value={`every ${cat.updateHours}h`} />
        <Row
          label="Availability"
          value={
            !released
              ? `Releases ${date(it.releaseAt!)}`
              : left === null
                ? "Always available"
                : `${left} of ${it.limited} left`
          }
        />
        <Row
          label="Resale"
          value={
            it.restrictedResale
              ? "Restricted special edition"
              : `${pct(RESALE_PCT[it.rarity], 0)} of estimate after ${HOLD_HOURS[it.rarity]}h`
          }
        />
        <Row
          label="Benefit while owned"
          value={
            it.bonus
              ? `+${it.bonus.key === "offlineHours" ? `${it.bonus.value}h offline` : pct(it.bonus.value, 1) + " " + it.bonus.key.replace("Pct", "").replace("feeCut", "fee reduction")}`
              : "Prestige only"
          }
        />
      </Card>
      <Confirm
        trigger={
          <Button
            className="mb-3 h-11 w-full bg-gradient-primary"
            disabled={pending || !released || left === 0 || s.cash < it.price}
          >
            {!released ? "Not yet released" : left === 0 ? "Sold out" : `Buy · ${money(it.price)}`}
          </Button>
        }
        title={`Buy ${it.name}?`}
        description={`${money(it.price)} from your balance. You must hold it ${HOLD_HOURS[it.rarity]}h before resale. No ongoing costs.`}
        onConfirm={() =>
          run({ type: "buyCollectible", itemId: it.id, soldCount: sold }, "Purchased").then(() =>
            refetch(),
          )
        }
      />
      <Card className="mb-3">
        <div className="mb-2 text-sm font-semibold">Your copies ({copies.length})</div>
        {copies.length === 0 ? (
          <p className="text-sm text-muted-foreground">You don't own this item.</p>
        ) : (
          copies.map((o) => {
            const canSell = !it.restrictedResale && now >= o.holdUntil;
            return (
              <div
                key={o.inst}
                className="flex items-center justify-between border-t border-border py-2 text-sm first:border-0"
              >
                <div>
                  <div>Copy #{o.inst}</div>
                  <div className="text-xs text-muted-foreground">
                    Acquired {date(o.boughtAt)} for {money(o.price)}
                  </div>
                </div>
                <Confirm
                  trigger={
                    <Button size="sm" variant="outline" disabled={!canSell || pending}>
                      {it.restrictedResale
                        ? "Restricted"
                        : now < o.holdUntil
                          ? duration(o.holdUntil - now)
                          : `Sell ${money(v * RESALE_PCT[it.rarity])}`}
                    </Button>
                  }
                  title="Sell this copy?"
                  description={`Payout ${money(v * RESALE_PCT[it.rarity])} (${pct(RESALE_PCT[it.rarity], 0)} of current estimate). Benefits from this item stop immediately.`}
                  onConfirm={() => run({ type: "sellCollectible", inst: o.inst }, "Sold")}
                />
              </div>
            );
          })
        )}
        {history.length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            Resale history:{" "}
            {history.map((h) => `${money(h.payout)} on ${date(h.soldAt)}`).join(" · ")}
          </div>
        )}
      </Card>
      {cols.length > 0 && (
        <Card>
          <div className="mb-2 text-sm font-semibold">Collections</div>
          {cols.map((c) => (
            <Row
              key={c.id}
              label={c.name}
              value={`${c.items.filter((i) => ownedIds.has(i)).length}/${c.items.length}`}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
