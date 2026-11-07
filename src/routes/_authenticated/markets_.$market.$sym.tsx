import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAct, useGame, useNow } from "@/hooks/use-game";
import { cryptoNow, feePct, personalMods, stocksNow, UNLOCKS } from "@/game/engine";
import { corpMods } from "@/game/corp";
import {
  cryptoLiquidity,
  cryptoPriceAtTick,
  cryptoSupply,
  cryptoTick,
  cryptoTickTime,
  series,
  stockLiquidity,
  stockPriceAtTick,
  stockProfitable,
  stockTick,
  stockTickTime,
} from "@/game/market";
import { money, num, pct, price } from "@/lib/format";
import {
  Card,
  Confirm,
  Empty,
  Loading,
  MiniChart,
  RangeTabs,
  Row,
  Segmented,
  useRange,
} from "@/components/game/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OrderKind } from "@/game/types";

export const Route = createFileRoute("/_authenticated/markets_/$market/$sym")({
  head: () => ({
    meta: [
      { title: "Asset — Capitalfortune" },
      { name: "description", content: "Asset profile, chart and trading." },
      { property: "og:title", content: "Asset — Capitalfortune" },
      { property: "og:description", content: "Asset profile, chart and trading." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssetPage,
});

function AssetPage() {
  const { market, sym } = Route.useParams();
  const isStock = market === "stock";
  const { data } = useGame();
  const now = useNow(data?.offset ?? 0, 5000);
  const { run, pending } = useAct();
  const { range, setRange, ms } = useRange();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [kind, setKind] = useState<OrderKind>("market");
  const [qty, setQty] = useState("");
  const [limit, setLimit] = useState("");
  const st = stocksNow(now);
  const cr = cryptoNow(now);
  const sd = isStock ? st.map[sym] : undefined;
  const cd = !isStock ? cr.map[sym] : undefined;
  const chart = useMemo(() => {
    if (sd)
      return series(
        (k) => stockPriceAtTick(sd, k),
        stockTick,
        stockTickTime,
        Math.max(sd.listedAt, now - ms),
        now,
        80,
      );
    if (cd)
      return series(
        (k) => cryptoPriceAtTick(cd, k),
        cryptoTick,
        cryptoTickTime,
        Math.max(cd.listedAt, now - ms),
        now,
        80,
      );
    return [];
  }, [sd, cd, now, ms]);
  if (!data) return <Loading />;
  if (!sd && !cd) return <Empty title="Asset not found" />;
  const s = data.state;
  const p = isStock
    ? stockPriceAtTick(sd!, stockTick(now))
    : cryptoPriceAtTick(cd!, cryptoTick(now));
  const fee = feePct(isStock ? "stock" : "crypto", personalMods(s), corpMods(data.corp));
  const h = (isStock ? s.stocks.holdings : s.crypto.holdings)[sym];
  const q = Number(qty) || 0;
  const execPrice = kind === "market" ? p : Number(limit) || p;
  const gross = q * execPrice;
  const feeAmt = gross * fee;
  const locked = s.level < (isStock ? UNLOCKS.stocks : UNLOCKS.crypto);
  const liq = isStock ? stockLiquidity(sd!, stockTick(now)) : cryptoLiquidity(cd!, cryptoTick(now));
  const kinds: { id: OrderKind; label: string }[] = isStock
    ? [
        { id: "market", label: "Market" },
        { id: "limit", label: "Limit" },
      ]
    : side === "buy"
      ? [
          { id: "market", label: "Market" },
          { id: "limit", label: "Limit" },
        ]
      : [
          { id: "market", label: "Market" },
          { id: "limit", label: "Limit" },
          { id: "stop", label: "Stop-loss" },
          { id: "tp", label: "Take-profit" },
        ];

  function submit() {
    run(
      {
        type: "order",
        market: isStock ? "stock" : "crypto",
        sym,
        side,
        kind,
        qty: q,
        ...(kind === "limit" ? { limit: Number(limit) } : {}),
        ...(kind === "stop" || kind === "tp" ? { trigger: Number(limit) } : {}),
      },
      kind === "market" ? "Order executed" : "Order placed",
    ).then(() => setQty(""));
  }

  return (
    <div>
      <Link
        to="/markets"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Markets
      </Link>
      <div className="mb-2">
        <h1 className="text-2xl font-bold">{sym}</h1>
        <p className="text-sm text-muted-foreground">
          {sd?.name ?? cd?.name} · {sd?.sector ?? `${cd?.profile} volatility`}
        </p>
      </div>
      <div className="num mb-3 text-3xl font-bold">{price(p)}</div>
      <Card className="mb-3">
        <MiniChart data={chart} height={180} format={price} />
        <div className="mt-2">
          <RangeTabs value={range} onChange={setRange} />
        </div>
      </Card>

      <Card className="mb-3">
        <Segmented
          value={side}
          onChange={(v) => {
            setSide(v);
            setKind("market");
          }}
          options={[
            { id: "buy", label: "Buy" },
            { id: "sell", label: "Sell" },
          ]}
        />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <Button
              variant="ghost"
              size="sm"
              key={k.id}
              onClick={() => setKind(k.id)}
              className={`rounded-full px-3 py-1 text-xs ${kind === k.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {k.label}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          <Input
            inputMode="decimal"
            placeholder={`Quantity${isStock ? " (whole shares)" : ""}`}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-11"
          />
          {kind !== "market" && (
            <Input
              inputMode="decimal"
              placeholder={kind === "limit" ? "Limit price" : "Trigger price"}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="h-11"
            />
          )}
        </div>
        <div className="mt-2">
          <Row label="Estimated value" value={money(gross)} />
          <Row label={`Fee (${pct(fee, 3)})`} value={money(feeAmt)} />
          <Row
            label={side === "buy" ? "Total cost" : "Proceeds"}
            value={money(side === "buy" ? gross + feeAmt : gross - feeAmt)}
          />
          <Row
            label="Owned"
            value={
              h
                ? `${h.qty.toLocaleString(undefined, { maximumFractionDigits: 6 })}${h.reserved ? ` (${h.reserved} reserved)` : ""}`
                : "0"
            }
          />
          <Row label="Liquidity per update" value={num(liq, 2)} />
        </div>
        {kind === "market" && q > liq && (
          <p className="mt-1 text-xs text-warn">
            Only ~{num(liq, 2)} available now — the rest of a market order will be cancelled (no fee
            on unfilled part).
          </p>
        )}
        {(kind === "stop" || kind === "tp") && (
          <p className="mt-1 text-xs text-muted-foreground">
            Executes at the next market price after triggering — not guaranteed across price gaps.
          </p>
        )}
        <Confirm
          trigger={
            <Button
              className="mt-3 h-11 w-full bg-gradient-primary"
              disabled={locked || pending || q <= 0}
            >
              {locked
                ? `Unlocks at Level ${isStock ? UNLOCKS.stocks : UNLOCKS.crypto}`
                : `Review ${side} order`}
            </Button>
          }
          title={`Confirm ${kind} ${side}`}
          description={
            <>
              {q} {sym}{" "}
              {kind === "market"
                ? `at ~${price(p)}`
                : `${kind === "limit" ? "limit" : "trigger"} ${price(Number(limit) || 0)}`}
              . Fee {pct(fee, 3)} charged only on filled quantity
              {kind !== "market" && side === "buy"
                ? "; funds are reserved until filled or cancelled"
                : ""}
              .
            </>
          }
          onConfirm={submit}
        />
      </Card>

      <Card>
        {sd &&
          (() => {
            const shares = sd.shares;
            const mc = shares * p;
            const profit = sd.revenue * sd.margin;
            return (
              <>
                <p className="mb-2 text-sm text-muted-foreground">{sd.desc}</p>
                <Row label="Market cap" value={money(mc)} />
                <Row label="Outstanding shares" value={num(shares)} />
                <Row
                  label="Authorized / Treasury"
                  value={`${num(sd.authorized)} / ${num(sd.treasury)}`}
                />
                <Row label="Exchange available" value={num(shares - sd.treasury)} />
                <Row label="Revenue (annual)" value={money(sd.revenue)} />
                <Row
                  label="Net margin"
                  value={pct(sd.margin)}
                  tone={sd.margin >= 0 ? "gain" : "loss"}
                />
                <Row label="EPS" value={price(profit / shares)} />
                <Row
                  label="Assets / Liabilities"
                  value={`${money(sd.assets)} / ${money(sd.liabilities)}`}
                />
                <Row
                  label="Dividend yield"
                  value={sd.dividendYield ? pct(sd.dividendYield, 2) : "None"}
                />
                <Row
                  label="Dividends today"
                  value={
                    sd.dividendYield
                      ? stockProfitable(sd, Math.floor(now / 86400_000))
                        ? "Paying"
                        : "Suspended (loss)"
                      : "—"
                  }
                />
              </>
            );
          })()}
        {cd &&
          (() => {
            const sup = cryptoSupply(cd, now);
            return (
              <>
                <p className="mb-2 text-sm text-muted-foreground">{cd.desc}</p>
                <Row label="Supply model" value={cd.supplyModel} />
                <Row label="Circulating" value={num(sup.circulating)} />
                <Row label="Max supply" value={sup.max ? num(sup.max) : "Unlimited"} />
                <Row label="Burned" value={num(sup.burned)} />
                <Row label="Inflation" value={pct(cd.inflation)} />
                <Row label="Market cap" value={money(sup.circulating * p)} />
                <Row label="FDV" value={sup.max ? money(sup.max * p) : "n/a"} />
              </>
            );
          })()}
      </Card>
    </div>
  );
}
