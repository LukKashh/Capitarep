import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useGame, useNow } from "@/hooks/use-game";
import { netWorth } from "@/game/engine";
import { getLedger } from "@/lib/game.functions";
import { date, money, num } from "@/lib/format";
import {
  Card,
  Loading,
  MiniChart,
  PageHeader,
  RangeTabs,
  Row,
  Stat,
  useRange,
} from "@/components/game/ui";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({
    meta: [
      { title: "Statistics — Capitalfortune" },
      { name: "description", content: "Net worth, history and transaction ledger." },
      { property: "og:title", content: "Statistics — Capitalfortune" },
      { property: "og:description", content: "Net worth, history and transaction ledger." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const { data } = useGame();
  const now = useNow(data?.offset ?? 0, 30_000);
  const { range, setRange, ms } = useRange("7d");
  const { data: ledger } = useQuery({ queryKey: ["ledger"], queryFn: () => getLedger() });
  const series = useMemo(() => {
    if (!data) return [];
    const h = data.state.history;
    const src = ms <= 30 * 86400_000 ? h.hourly : h.daily;
    return [
      ...src.filter((x) => x.t >= now - ms).map((x) => ({ t: x.t, v: x.nw })),
      { t: now, v: netWorth(data.state, now).total },
    ];
  }, [data, ms, now]);
  if (!data) return <Loading />;
  const s = data.state;
  const nw = netWorth(s, now);
  const st = s.stats;
  return (
    <div>
      <PageHeader title="Statistics" subtitle="Server-recorded history" />
      <Card className="mb-4">
        <div className="text-xs text-muted-foreground">Net worth</div>
        <div className="num text-2xl font-bold">{money(nw.total)}</div>
        <MiniChart data={series} format={(v) => money(v)} />
        <div className="mt-2">
          <RangeTabs value={range} onChange={setRange} />
        </div>
      </Card>
      <Card className="mb-4">
        <div className="mb-1 text-sm font-semibold">Net worth breakdown</div>
        <Row label="Liquid cash" value={money(s.cash)} />
        <Row label="Reserved for open orders" value={money(s.reservedCash)} />
        <Row label="Businesses (valuation + reserves + uncollected)" value={money(nw.business)} />
        <Row label="Stocks" value={money(nw.stocks)} />
        <Row label="Crypto" value={money(nw.crypto)} />
        <Row label="Real estate" value={money(nw.property)} />
        <Row label="Collectibles (incl. restricted)" value={money(nw.collectibles)} />
        <Row
          label="Liabilities"
          value={money(-nw.liabilities)}
          tone={nw.liabilities ? "loss" : undefined}
        />
      </Card>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Stat label="Lifetime earned" value={money(st.lifetimeEarned)} />
        <Stat label="Total clicks" value={num(st.clicks)} />
        <Stat
          label="Companies bought / sold"
          value={`${st.companiesBought} / ${st.companiesSold}`}
        />
        <Stat label="Branches opened" value={st.branches} />
        <Stat label="Hires" value={st.hires} />
        <Stat label="Upgrades" value={st.upgrades} />
        <Stat label="Stock / crypto fills" value={`${st.stockTrades} / ${st.cryptoTrades}`} />
        <Stat label="Dividends" value={money(st.dividends)} />
        <Stat label="Rent earned" value={money(st.rentEarned)} />
        <Stat label="Collectibles bought" value={st.collectiblesBought} />
        <Stat label="Research completed" value={st.researchDone} />
        <Stat label="RP generated" value={num(s.research.rpTotal)} />
        <Stat label="Corp contributions" value={money(st.corpContributed)} />
        <Stat label="Peak net worth" value={money(st.netWorth)} />
      </div>
      <Card>
        <div className="mb-2 text-sm font-semibold">Transaction ledger</div>
        {!ledger ? (
          <Loading />
        ) : ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {ledger.map((l) => {
              const inflow = l.destination === "player:cash";
              return (
                <div key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{l.type.replace(/_/g, " ")}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {l.source} → {l.destination}
                      {l.entity ? ` · ${l.entity}` : ""} · {date(new Date(l.created_at).getTime())}
                    </div>
                  </div>
                  <div className={`num shrink-0 ${inflow ? "text-gain" : "text-muted-foreground"}`}>
                    {inflow ? "+" : "−"}
                    {money(Number(l.amount))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
