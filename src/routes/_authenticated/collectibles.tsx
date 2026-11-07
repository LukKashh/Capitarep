import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, Grid3x3, List } from "lucide-react";
import { useGame, useNow } from "@/hooks/use-game";
import {
  CATEGORIES,
  COLLECTIBLES,
  COLLECTIBLE_BY_ID,
  COLLECTIONS,
  RARITIES,
  currentValue,
  demandLabel,
} from "@/game/collectibles";
import { getCollectibleStock } from "@/lib/game.functions";
import { duration, money, pct } from "@/lib/format";
import { Card, Empty, Loading, PageHeader, Pill, Progress, Segmented } from "@/components/game/ui";
import { CollectibleIcon } from "@/components/game/CollectibleIcon";
import { AssetsTabs } from "@/components/game/AssetsTabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/collectibles")({
  head: () => ({
    meta: [
      { title: "Collectibles — Capitalfortune" },
      { name: "description", content: "Luxury assets, collections and valuations." },
      { property: "og:title", content: "Collectibles — Capitalfortune" },
      { property: "og:description", content: "Luxury assets, collections and valuations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollectiblesPage,
});

type Sort = "price" | "value" | "rarity" | "change" | "demand" | "name";

function CollectiblesPage() {
  const { data } = useGame();
  const now = useNow(data?.offset ?? 0, 30_000);
  const { data: stock } = useQuery({
    queryKey: ["collectible-stock"],
    queryFn: () => getCollectibleStock(),
    staleTime: 30_000,
  });
  const [tab, setTab] = useState<"market" | "inventory" | "collections">("market");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [cat, setCat] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [edition, setEdition] = useState("all");
  const [avail, setAvail] = useState("all");
  const [sort, setSort] = useState<Sort>("price");
  const [q, setQ] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const items = useMemo(() => {
    const arr = COLLECTIBLES.map((it) => {
      const v = currentValue(it, now);
      const prev = currentValue(it, now - 7 * 86400_000);
      const sold = stock?.[it.id] ?? 0;
      const released = !it.releaseAt || it.releaseAt <= now;
      const left = it.limited ? it.limited - sold : Infinity;
      return { it, v, ch: v / prev - 1, left, released, demand: demandLabel(it, now) };
    }).filter(
      (x) =>
        (cat === "all" || x.it.category === cat) &&
        (rarity === "all" || x.it.rarity === rarity) &&
        (edition === "all" || (edition === "limited" ? !!x.it.limited : !x.it.limited)) &&
        (avail === "all" ||
          (avail === "available"
            ? x.released && x.left > 0
            : avail === "upcoming"
              ? !x.released
              : x.left <= 0)) &&
        (!q || x.it.name.toLowerCase().includes(q.toLowerCase())) &&
        (!maxPrice || x.it.price <= Number(maxPrice)),
    );
    const dOrd = { High: 2, Moderate: 1, Low: 0 } as Record<string, number>;
    arr.sort((a, b) =>
      sort === "price"
        ? a.it.price - b.it.price
        : sort === "value"
          ? b.v - a.v
          : sort === "rarity"
            ? RARITIES.indexOf(b.it.rarity) - RARITIES.indexOf(a.it.rarity)
            : sort === "change"
              ? b.ch - a.ch
              : sort === "demand"
                ? dOrd[b.demand]! - dOrd[a.demand]!
                : a.it.name.localeCompare(b.it.name),
    );
    return arr;
  }, [now, stock, cat, rarity, edition, avail, sort, q, maxPrice]);

  if (!data) return <Loading />;
  const s = data.state;
  const inv = Object.values(s.collectibles);
  const owned = new Set(inv.map((o) => o.itemId));

  return (
    <div>
      <AssetsTabs active="col" />
      <PageHeader
        title="Collectibles"
        subtitle="300 items · direct purchases only, no random drops"
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: "market", label: "Marketplace" },
          { id: "inventory", label: `Inventory (${inv.length})` },
          { id: "collections", label: "Collections" },
        ]}
      />

      {tab === "market" && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Input
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="col-span-2 h-10"
            />
            <F
              value={cat}
              onChange={setCat}
              items={[
                ["all", "All categories"],
                ...CATEGORIES.map((c) => [c.id, c.name] as [string, string]),
              ]}
            />
            <F
              value={rarity}
              onChange={setRarity}
              items={[["all", "All rarities"], ...RARITIES.map((r) => [r, r] as [string, string])]}
            />
            <F
              value={edition}
              onChange={setEdition}
              items={[
                ["all", "All editions"],
                ["standard", "Standard"],
                ["limited", "Limited edition"],
              ]}
            />
            <F
              value={avail}
              onChange={setAvail}
              items={[
                ["all", "Any availability"],
                ["available", "Available"],
                ["upcoming", "Upcoming"],
                ["soldout", "Sold out"],
              ]}
            />
            <Input
              placeholder="Max price"
              inputMode="numeric"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
              className="h-10"
            />
            <F
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              items={[
                ["price", "Price ↑"],
                ["value", "Value ↓"],
                ["rarity", "Rarity ↓"],
                ["change", "7d change ↓"],
                ["demand", "Demand ↓"],
                ["name", "A–Z"],
              ]}
            />
          </div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{items.length} items</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Grid"
                onClick={() => setView("grid")}
                className={`rounded p-1.5 ${view === "grid" ? "bg-muted text-foreground" : ""}`}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="List"
                onClick={() => setView("list")}
                className={`rounded p-1.5 ${view === "list" ? "bg-muted text-foreground" : ""}`}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className={view === "grid" ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "space-y-2"}>
            {items.slice(0, 120).map(({ it, v, ch, left, released }) => (
              <Link key={it.id} to="/collectibles/$id" params={{ id: it.id }}>
                <Card className={view === "grid" ? "h-full p-3" : "flex items-center gap-3 p-3"}>
                  <CollectibleIcon
                    category={it.category}
                    rarity={it.rarity}
                    className={view === "grid" ? "mb-2 aspect-square w-full" : "h-12 w-12 shrink-0"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{it.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {it.rarity} · {CATEGORIES.find((c) => c.id === it.category)?.name}
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="num text-sm">{money(it.price)}</span>
                      <span className={`num text-[11px] ${ch >= 0 ? "text-gain" : "text-loss"}`}>
                        {pct(ch, 1, true)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {owned.has(it.id) && (
                        <Pill tone="gain">
                          <Check className="mr-0.5 h-3 w-3" />
                          Owned
                        </Pill>
                      )}
                      {it.limited && (
                        <Pill tone="gold">
                          {!released
                            ? `In ${duration(it.releaseAt! - now)}`
                            : left > 0
                              ? `${left}/${it.limited} left`
                              : "Sold out"}
                        </Pill>
                      )}
                    </div>
                    {view === "list" && (
                      <div className="num text-[11px] text-muted-foreground">
                        Est. value {money(v)}
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          {items.length > 120 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Showing 120 of {items.length} — refine filters to see more.
            </p>
          )}
        </>
      )}

      {tab === "inventory" &&
        (inv.length === 0 ? (
          <Empty
            title="No collectibles yet"
            text="Buy an item from the marketplace — every copy gets its own ownership record."
          />
        ) : (
          <div className="space-y-2">
            {inv.map((o) => {
              const it = COLLECTIBLE_BY_ID[o.itemId]!;
              const v = currentValue(it, now);
              return (
                <Link key={o.inst} to="/collectibles/$id" params={{ id: it.id }}>
                  <Card className="mb-2 flex items-center gap-3 p-3">
                    <CollectibleIcon
                      category={it.category}
                      rarity={it.rarity}
                      className="h-12 w-12 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{it.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Paid {money(o.price)} ·{" "}
                        {now < o.holdUntil
                          ? `hold ${duration(o.holdUntil - now)}`
                          : it.restrictedResale
                            ? "resale restricted"
                            : "sellable"}
                      </div>
                    </div>
                    <div className={`num text-sm ${v >= o.price ? "text-gain" : "text-loss"}`}>
                      {money(v)}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        ))}

      {tab === "collections" && (
        <div className="space-y-2">
          {COLLECTIONS.map((col) => {
            const have = col.items.filter((i) => owned.has(i)).length;
            const done = have === col.items.length;
            return (
              <Card key={col.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{col.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Reward {money(col.reward.cash)}
                      {col.reward.xp ? ` + ${col.reward.xp} XP` : ""} · ongoing +
                      {pct(col.bonus.value)} {col.bonus.key.replace("Pct", "")}
                    </div>
                  </div>
                  {done ? (
                    <Pill tone="gain">Active</Pill>
                  ) : s.collectionsRewarded.includes(col.id) ? (
                    <Pill tone="warn">Inactive</Pill>
                  ) : (
                    <Pill>
                      {have}/{col.items.length}
                    </Pill>
                  )}
                </div>
                <Progress value={have / col.items.length} className="mt-2" />
                <div className="mt-2 flex flex-wrap gap-1">
                  {col.items.map((i) => (
                    <Link key={i} to="/collectibles/$id" params={{ id: i }}>
                      <Pill tone={owned.has(i) ? "gain" : "muted"}>
                        {COLLECTIBLE_BY_ID[i]?.name}
                      </Pill>
                    </Link>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function F({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
