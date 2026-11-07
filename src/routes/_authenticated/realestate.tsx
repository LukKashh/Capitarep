import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Lock } from "lucide-react";
import { useAct, useGame, useNow } from "@/hooks/use-game";
import { PROPERTIES } from "@/game/config";
import { conditionLabel, personalMods, propertyEcon, UNLOCKS } from "@/game/engine";
import { corpMods } from "@/game/corp";
import { money, pct } from "@/lib/format";
import { Card, Confirm, Empty, Loading, PageHeader, Pill, Segmented } from "@/components/game/ui";
import { propertyImage } from "@/components/game/art";
import { WALLET_REFRESH_MS, liveRentWallet } from "@/components/game/wallet";
import { Button } from "@/components/ui/button";
import { AssetsTabs } from "@/components/game/AssetsTabs";

export const Route = createFileRoute("/_authenticated/realestate")({
  head: () => ({
    meta: [
      { title: "Real Estate — Capitalfortune" },
      { name: "description", content: "Rental property investments." },
      { property: "og:title", content: "Real Estate — Capitalfortune" },
      { property: "og:description", content: "Rental property investments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RealEstatePage,
});

function RealEstatePage() {
  const { data } = useGame();
  const now = useNow(data?.offset ?? 0, WALLET_REFRESH_MS);
  const { run, pending } = useAct();
  const [tab, setTab] = useState<"owned" | "market">("owned");
  const [cat, setCat] = useState("All");
  if (!data) return <Loading />;
  const s = data.state;
  const p = personalMods(s);
  const cm = corpMods(data.corp);
  const owned = Object.values(s.properties);
  const cats = ["All", ...new Set(PROPERTIES.map((x) => x.category))];
  const locked = s.level < UNLOCKS.realEstate;
  const rentNet = owned.reduce((a, pr) => a + propertyEcon(pr, p, cm, now).net, 0);
  const rentWallet = owned.reduce(
    (a, pr) => a + liveRentWallet(pr, propertyEcon(pr, p, cm, now).net, s.lastTick, now),
    0,
  );
  return (
    <div>
      <AssetsTabs active="re" />
      <PageHeader
        title="Real Estate"
        subtitle="Rental investments · resale at 75% of value incl. upgrades"
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: "owned", label: `My properties (${owned.length})` },
          { id: "market", label: "Marketplace" },
        ]}
      />
      {tab === "owned" &&
        (owned.length === 0 ? (
          <Empty
            icon={<Home className="h-8 w-8" />}
            title="No properties yet"
            text="Buy a rental to start earning rent every hour."
            action={<Button onClick={() => setTab("market")}>Browse properties</Button>}
          />
        ) : (
          <div className="space-y-3">
            <Card className="border-primary/40">
              <div className="text-xs text-muted-foreground">Rent wallet · {money(rentNet)}/h</div>
              <div className="num text-2xl font-bold text-gain">{money(rentWallet)}</div>
              <Button
                className="mt-2 w-full bg-gradient-primary"
                disabled={pending || rentWallet < 0.01}
                onClick={() => run({ type: "collectRent" }, "Transferred to balance")}
              >
                Transfer to balance
              </Button>
            </Card>
            {owned.map((pr) => {
              const d = PROPERTIES.find((x) => x.id === pr.defId)!;
              const e = propertyEcon(pr, p, cm, now);
              return (
                <Link key={pr.inst} to="/realestate/$inst" params={{ inst: pr.inst }}>
                  <Card className="mb-3 flex gap-3 p-3">
                    <img
                      src={propertyImage(d.category)}
                      alt={d.name}
                      className="h-20 w-20 rounded-lg object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.category} · {d.location}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Pill
                          tone={pr.condition >= 65 ? "gain" : pr.condition >= 40 ? "warn" : "loss"}
                        >
                          {conditionLabel(pr.condition)}
                        </Pill>
                        <Pill>{pct(e.occupancy, 0)} occupied</Pill>
                      </div>
                      <div className={`num mt-1 text-sm ${e.net >= 0 ? "text-gain" : "text-loss"}`}>
                        {money(e.net)}/h net · wallet{" "}
                        {money(liveRentWallet(pr, e.net, s.lastTick, now))}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        ))}
      {tab === "market" && (
        <>
          {locked && (
            <Card className="mb-3 flex items-center gap-2 border-warn/40 text-sm">
              <Lock className="h-4 w-4 text-warn" />
              Property purchases unlock at Player Level {UNLOCKS.realEstate}.
            </Card>
          )}
          <div className="mb-3 flex gap-1.5 overflow-x-auto">
            {cats.map((c) => (
              <Button
                variant="ghost"
                size="sm"
                key={c}
                onClick={() => setCat(c)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs ${cat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {c}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROPERTIES.filter(
              (x) => (cat === "All" || x.category === cat) && !owned.some((o) => o.defId === x.id),
            ).map((d) => (
              <Card key={d.id} className="overflow-hidden p-0">
                <img
                  src={propertyImage(d.category)}
                  alt={d.name}
                  className="h-36 w-full object-cover"
                  loading="lazy"
                />
                <div className="p-3">
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.category} · {d.location} · demand ×{d.demand}
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-muted-foreground">Base rent</span>
                    <span className="num">{money(d.rent)}/h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expenses</span>
                    <span className="num">{money(d.expense)}/h</span>
                  </div>
                  <Confirm
                    trigger={
                      <Button
                        className="mt-3 w-full"
                        disabled={locked || pending || s.cash < d.price}
                      >
                        {s.cash < d.price ? `Need ${money(d.price)}` : `Buy · ${money(d.price)}`}
                      </Button>
                    }
                    title={`Buy ${d.name}?`}
                    description={`${money(d.price)} from your balance. Rent = base × occupancy × demand, minus expenses.`}
                    onConfirm={() =>
                      run({ type: "buyProperty", defId: d.id }, "Property purchased")
                    }
                  />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
