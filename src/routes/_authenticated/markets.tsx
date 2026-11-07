import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ListOrdered, Lock, Search, Wallet } from "lucide-react";
import { useAct, useGame, useNow } from "@/hooks/use-game";
import { cryptoNow, stocksNow, UNLOCKS } from "@/game/engine";
import {
  cryptoPriceAtTick,
  cryptoTick,
  stockPriceAtTick,
  stockTick,
  upcomingStockListing,
} from "@/game/market";
import { date, duration, money, pct, price } from "@/lib/format";
import { Card, Empty, Loading, PageHeader, Pill, Segmented } from "@/components/game/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/markets")({
  head: () => ({
    meta: [
      { title: "Markets — Capitalfortune" },
      { name: "description", content: "Simulated stock and crypto exchanges." },
      { property: "og:title", content: "Markets — Capitalfortune" },
      { property: "og:description", content: "Simulated stock and crypto exchanges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketsPage,
});

type Tab = "stocks" | "crypto";

function MarketsPage() {
  const { data } = useGame();
  const now = useNow(data?.offset ?? 0, 10_000);
  const { run, pending } = useAct();
  const [tab, setTab] = useState<Tab>("stocks");
  const [panel, setPanel] = useState<null | "portfolio" | "orders">(null);
  const [pf, setPf] = useState<Tab>("stocks");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("All");
  const st = stocksNow(now);
  const cr = cryptoNow(now);
  const rows = useMemo(() => {
    const sk = stockTick(now);
    const ck = cryptoTick(now);
    return {
      stocks: st.list.map((s) => {
        const p = stockPriceAtTick(s, sk);
        const prev = stockPriceAtTick(s, sk - 288);
        return { s, p, ch: p / prev - 1 };
      }),
      crypto: cr.list.map((c) => {
        const p = cryptoPriceAtTick(c, ck);
        const prev = cryptoPriceAtTick(c, ck - 720);
        return { c, p, ch: p / prev - 1 };
      }),
    };
  }, [now, st, cr]);
  if (!data) return <Loading />;
  const s = data.state;
  const sectors = ["All", ...new Set(st.list.map((x) => x.sector))];
  const filt = (n: string, t: string) =>
    !q || n.toLowerCase().includes(q.toLowerCase()) || t.toLowerCase().includes(q.toLowerCase());
  const upcoming = upcomingStockListing(now);

  const holdings = [
    ...Object.entries(s.stocks.holdings).map(([sym, h]) => {
      const d = st.map[sym];
      const p = d ? stockPriceAtTick(d, stockTick(now)) : 0;
      const dy = d && d.dividendYield > 0 ? d.dividendYield : 0;
      return {
        market: "stock" as const,
        sym,
        name: d?.name ?? sym,
        h,
        value: h.qty * p,
        pl: h.qty * p - h.cost,
        dy,
        divDay: (h.qty * p * dy) / 365,
      };
    }),
    ...Object.entries(s.crypto.holdings).map(([sym, h]) => {
      const d = cr.map[sym];
      const p = d ? cryptoPriceAtTick(d, cryptoTick(now)) : 0;
      return {
        market: "crypto" as const,
        sym,
        name: d?.name ?? sym,
        h,
        value: h.qty * p,
        pl: h.qty * p - h.cost,
        dy: 0,
        divDay: 0,
      };
    }),
  ];
  const shown = holdings.filter((h) => h.market === (pf === "stocks" ? "stock" : "crypto"));
  const sum = (a: typeof holdings) => a.reduce((t, h) => t + h.value, 0);
  const walletTotal = sum(holdings);
  const typeTotal = sum(shown);
  const typePl = shown.reduce((t, h) => t + h.pl, 0);
  const divDay = shown.reduce((t, h) => t + h.divDay, 0);

  return (
    <div>
      <PageHeader title="Markets" />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button
          variant={panel === "portfolio" ? "default" : "outline"}
          onClick={() => setPanel(panel === "portfolio" ? null : "portfolio")}
        >
          <Wallet className="mr-1 h-4 w-4" />
          Portfolio · {money(walletTotal)}
        </Button>
        <Button
          variant={panel === "orders" ? "default" : "outline"}
          onClick={() => setPanel(panel === "orders" ? null : "orders")}
        >
          <ListOrdered className="mr-1 h-4 w-4" />
          Orders
        </Button>
      </div>

      {panel === "portfolio" && (
        <Card className="mb-3">
          <Segmented
            value={pf}
            onChange={setPf}
            options={[
              { id: "stocks", label: "Stocks" },
              { id: "crypto", label: "Crypto" },
            ]}
          />
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">
                {pf === "stocks" ? "Stocks" : "Crypto"} value
              </div>
              <div className="num font-semibold">{money(typeTotal)}</div>
              <div className={`num text-xs ${typePl >= 0 ? "text-gain" : "text-loss"}`}>
                {money(typePl, { sign: true })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total wallet</div>
              <div className="num font-semibold">{money(walletTotal)}</div>
            </div>
            {pf === "stocks" && (
              <>
                <div>
                  <div className="text-xs text-muted-foreground">Dividend income</div>
                  <div className="num font-semibold text-gain">{money(divDay)}/day</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Avg. yield</div>
                  <div className="num font-semibold">
                    {pct(typeTotal > 0 ? (divDay * 365) / typeTotal : 0, 2)}
                  </div>
                </div>
              </>
            )}
          </div>
          {shown.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No {pf} owned yet.</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto overscroll-contain">
              {shown.map((h) => (
                <Link
                  key={h.market + h.sym}
                  to="/markets/$market/$sym"
                  params={{ market: h.market, sym: h.sym }}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{h.sym}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {h.h.qty.toLocaleString(undefined, { maximumFractionDigits: 6 })} units
                      {h.h.reserved ? ` · ${h.h.reserved} reserved` : ""}
                    </div>
                    {h.market === "stock" && (
                      <div className="text-xs text-muted-foreground">
                        {h.dy > 0
                          ? `Yield ${pct(h.dy, 2)} · ${money(h.divDay)}/day`
                          : "No dividend"}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="num">{money(h.value)}</div>
                    <div className={`num text-xs ${h.pl >= 0 ? "text-gain" : "text-loss"}`}>
                      {money(h.pl, { sign: true })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}
      {panel === "orders" && (
        <div className="mb-3 max-h-80 overflow-y-auto overscroll-contain">
          {s.orders.length === 0 ? (
            <Empty title="No orders" text="Your order history appears here." />
          ) : (
            <div className="space-y-2">
              {s.orders.map((o) => (
                <Card key={o.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">
                        {o.side.toUpperCase()} {o.sym}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {o.kind}
                          {o.limit ? ` @ ${price(o.limit)}` : ""}
                          {o.trigger ? ` trigger ${price(o.trigger)}` : ""}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {o.filled.toLocaleString(undefined, { maximumFractionDigits: 6 })}/
                        {o.qty.toLocaleString(undefined, { maximumFractionDigits: 6 })} filled
                        {o.avgPrice ? ` · avg ${price(o.avgPrice)}` : ""} · fees {money(o.fees)} ·{" "}
                        {date(o.createdAt)}
                      </div>
                    </div>
                    <Pill
                      tone={
                        o.status === "Executed"
                          ? "gain"
                          : o.status === "Cancelled" || o.status === "Expired"
                            ? "muted"
                            : "primary"
                      }
                    >
                      {o.status}
                    </Pill>
                  </div>
                  {(o.status === "Open" ||
                    o.status === "Partially Filled" ||
                    o.status === "Triggered") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={pending}
                      onClick={() => run({ type: "cancelOrder", id: o.id }, "Order cancelled")}
                    >
                      Cancel
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: "stocks", label: "Stocks" },
          { id: "crypto", label: "Crypto" },
        ]}
      />
      {
        <>
          {s.level < (tab === "stocks" ? UNLOCKS.stocks : UNLOCKS.crypto) && (
            <Card className="mb-3 flex items-center gap-2 border-warn/40 text-sm">
              <Lock className="h-4 w-4 text-warn" />
              Trading unlocks at Player Level {tab === "stocks" ? UNLOCKS.stocks : UNLOCKS.crypto}.
              You can browse now.
            </Card>
          )}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
          {tab === "stocks" && (
            <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
              {sectors.map((x) => (
                <Button
                  variant="ghost"
                  size="sm"
                  key={x}
                  onClick={() => setSector(x)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${sector === x ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {x}
                </Button>
              ))}
            </div>
          )}
          {tab === "stocks" && (
            <p className="mb-2 text-xs text-muted-foreground">
              Next IPO: {upcoming.name} in {duration(upcoming.at - now)}
            </p>
          )}
          <div className="game-market-list max-h-[55vh] overflow-y-auto overscroll-contain rounded-xl">
            {tab === "stocks"
              ? rows.stocks
                  .filter(
                    (r) =>
                      filt(r.s.name, r.s.ticker) && (sector === "All" || r.s.sector === sector),
                  )
                  .map((r) => (
                    <Link
                      key={r.s.ticker}
                      to="/markets/$market/$sym"
                      params={{ market: "stock", sym: r.s.ticker }}
                      className="game-market-row flex items-center justify-between px-3 py-3"
                    >
                      <span className="game-market-monogram">{r.s.ticker.slice(0, 1)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">
                          {r.s.ticker} {r.s.generated && <Pill tone="primary">New</Pill>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.s.name} · {r.s.sector}
                        </div>
                      </div>
                      <Sparkline
                        values={Array.from({ length: 18 }, (_, i) =>
                          stockPriceAtTick(r.s, stockTick(now) - (17 - i) * 16),
                        )}
                        up={r.ch >= 0}
                      />
                      <div className="shrink-0 text-right">
                        <div className="num text-sm">{price(r.p)}</div>
                        <div className={`num text-xs ${r.ch >= 0 ? "text-gain" : "text-loss"}`}>
                          {pct(r.ch, 2, true)}
                        </div>
                      </div>
                    </Link>
                  ))
              : rows.crypto
                  .filter((r) => filt(r.c.name, r.c.symbol))
                  .map((r) => (
                    <Link
                      key={r.c.symbol}
                      to="/markets/$market/$sym"
                      params={{ market: "crypto", sym: r.c.symbol }}
                      className="game-market-row flex items-center justify-between px-3 py-3"
                    >
                      <span className="game-market-monogram">{r.c.symbol.slice(0, 1)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{r.c.symbol}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.c.name} · {r.c.profile} volatility
                        </div>
                      </div>
                      <Sparkline
                        values={Array.from({ length: 18 }, (_, i) =>
                          cryptoPriceAtTick(r.c, cryptoTick(now) - (17 - i) * 40),
                        )}
                        up={r.ch >= 0}
                      />
                      <div className="shrink-0 text-right">
                        <div className="num text-sm">{price(r.p)}</div>
                        <div className={`num text-xs ${r.ch >= 0 ? "text-gain" : "text-loss"}`}>
                          {pct(r.ch, 2, true)}
                        </div>
                      </div>
                    </Link>
                  ))}
          </div>
        </>
      }
    </div>
  );
}

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  const low = Math.min(...values),
    high = Math.max(...values);
  const points = values
    .map(
      (v, i) =>
        `${(i * 58) / Math.max(1, values.length - 1)},${24 - ((v - low) / (high - low || 1)) * 22}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 58 26"
      aria-hidden="true"
      className={`game-sparkline ${up ? "text-gain" : "text-loss"}`}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
