import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bomb, Coins, Gem } from "lucide-react";
import { useAct, useGame } from "@/hooks/use-game";
import { CASINO } from "@/game/config";
import {
  handValue,
  hiloOdds,
  hiloStepMult,
  minesMultiplier,
  RED,
  type Card as PCard,
  type CasinoState,
  type RouletteBet,
} from "@/game/casino";
import { money } from "@/lib/format";
import { Card, Loading, PageHeader, Pill } from "@/components/game/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/casino")({
  head: () => ({
    meta: [
      { title: "Casino — Capitalfortune" },
      {
        name: "description",
        content: "Play Roulette, Blackjack, Mines, Keno and Hi-Lo with casino chips.",
      },
      { property: "og:title", content: "Casino — Capitalfortune" },
      {
        property: "og:description",
        content: "Play Roulette, Blackjack, Mines, Keno and Hi-Lo with casino chips.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CasinoPage,
});

const GAMES = ["Roulette", "Blackjack", "Mines", "Keno", "Hi-Lo"] as const;
type G = (typeof GAMES)[number];
const chipsFmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const EMPTY: CasinoState = {
  chips: 0,
  round: 0,
  active: null,
  last: null,
  stats: { wagered: 0, won: 0, rounds: 0, biggestWin: 0 },
};

function CasinoPage() {
  const { data } = useGame();
  const [game, setGame] = useState<G>("Roulette");
  if (!data) return <Loading />;
  const cs = data.state.casino ?? EMPTY;
  const activeGame = cs.active
    ? ({ blackjack: "Blackjack", mines: "Mines", hilo: "Hi-Lo" } as const)[cs.active.game]
    : null;
  const g = activeGame ?? game;
  return (
    <div>
      <PageHeader title="Casino" subtitle="1 chip = $100 · exchange both ways, no fee" />
      <Exchange cash={data.state.cash} chips={cs.chips} />
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {GAMES.map((x) => (
          <Button
            key={x}
            size="sm"
            variant={g === x ? "default" : "outline"}
            disabled={!!activeGame && activeGame !== x}
            onClick={() => setGame(x)}
            className={cn("shrink-0", g === x && "bg-gradient-primary")}
          >
            {x}
          </Button>
        ))}
      </div>
      {g === "Roulette" && <Roulette cs={cs} />}
      {g === "Blackjack" && <Blackjack cs={cs} />}
      {g === "Mines" && <Mines cs={cs} />}
      {g === "Keno" && <Keno cs={cs} />}
      {g === "Hi-Lo" && <Hilo cs={cs} />}
      <Card className="mt-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-muted-foreground">Rounds</div>
            <div className="num font-semibold">{cs.stats.rounds}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Wagered</div>
            <div className="num font-semibold">{chipsFmt(cs.stats.wagered)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Net</div>
            <div
              className={cn(
                "num font-semibold",
                cs.stats.won - cs.stats.wagered >= 0 ? "text-gain" : "text-loss",
              )}
            >
              {chipsFmt(cs.stats.won - cs.stats.wagered)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Exchange({ cash, chips }: { cash: number; chips: number }) {
  const { run, pending } = useAct();
  const [n, setN] = useState("10");
  const v = Math.floor(Number(n) || 0);
  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase text-muted-foreground">Your chips</div>
          <div className="num flex items-center gap-1.5 text-2xl font-bold text-gold">
            <Coins className="h-5 w-5" />
            {chipsFmt(chips)}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          Worth
          <div className="num text-sm font-semibold text-foreground">
            {money(chips * CASINO.chipValue)}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          value={n}
          onChange={(e) => setN(e.target.value.replace(/[^\d]/g, ""))}
          className="h-10"
          aria-label="Chips to exchange"
        />
        <Button
          variant="outline"
          className="h-10"
          onClick={() => setN(String(Math.floor(cash / CASINO.chipValue)))}
        >
          Max
        </Button>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {chipsFmt(v)} chips = {money(v * CASINO.chipValue)}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          disabled={pending || v < 1 || cash < v * CASINO.chipValue}
          onClick={() => run({ type: "buyChips", chips: v }, `Bought ${v} chips`)}
          className="bg-gradient-primary"
        >
          Buy chips
        </Button>
        <Button
          variant="outline"
          disabled={pending || v < 1 || chips < v}
          onClick={() => run({ type: "sellChips", chips: v }, `Cashed out ${v} chips`)}
        >
          Cash out
        </Button>
      </div>
    </Card>
  );
}

function BetInput({
  bet,
  setBet,
  chips,
  disabled,
}: {
  bet: string;
  setBet: (v: string) => void;
  chips: number;
  disabled?: boolean;
}) {
  const b = Number(bet) || 0;
  return (
    <div className="flex gap-1.5">
      <Input
        inputMode="decimal"
        value={bet}
        disabled={disabled}
        onChange={(e) => setBet(e.target.value.replace(/[^\d.]/g, ""))}
        className="h-10"
        aria-label="Bet in chips"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-10"
        disabled={disabled}
        onClick={() => setBet(String(Math.max(1, Math.floor(b / 2))))}
      >
        ½
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-10"
        disabled={disabled}
        onClick={() => setBet(String(Math.min(chips, Math.max(1, b * 2))))}
      >
        2×
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-10"
        disabled={disabled}
        onClick={() => setBet(String(Math.floor(Math.min(chips, CASINO.maxBet))))}
      >
        Max
      </Button>
    </div>
  );
}

function LastResult({ cs, game }: { cs: CasinoState; game: string }) {
  const l = cs.last;
  if (!l || l.game !== game) return null;
  const net = l.payout - l.bet;
  return (
    <div
      className={cn(
        "mt-3 rounded-lg border p-3 text-center text-sm font-semibold",
        net > 0 ? "border-gain text-gain" : net === 0 ? "border-border" : "border-loss text-loss",
      )}
    >
      {net > 0
        ? `You won ${chipsFmt(l.payout)} chips (+${chipsFmt(net)})`
        : net === 0
          ? `Push — ${chipsFmt(l.bet)} chips returned`
          : `You lost ${chipsFmt(l.bet)} chips`}
    </div>
  );
}

function PlayingCard({ c, hidden }: { c?: PCard; hidden?: boolean }) {
  if (!c || hidden)
    return (
      <div className="flex h-16 w-11 items-center justify-center rounded-md border border-primary-glow bg-gradient-primary text-primary-foreground">
        ?
      </div>
    );
  const r = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][c.r];
  const s = ["♠", "♥", "♦", "♣"][c.s];
  return (
    <div
      className={cn(
        "flex h-16 w-11 flex-col items-center justify-center rounded-md border border-border bg-card text-sm font-bold",
        c.s === 1 || c.s === 2 ? "text-loss" : "text-foreground",
      )}
    >
      <span>{r}</span>
      <span>{s}</span>
    </div>
  );
}

// ---------------------------------------------------------------- Roulette
function Roulette({ cs }: { cs: CasinoState }) {
  const { run, pending } = useAct();
  const [bet, setBet] = useState("1");
  const [bets, setBets] = useState<RouletteBet[]>([]);
  const amt = Number(bet) || 0;
  const total = bets.reduce((t, b) => t + b.amount, 0);
  const add = (kind: RouletteBet["kind"], value?: number) =>
    amt >= 1 &&
    setBets((x) => {
      const i = x.findIndex((b) => b.kind === kind && b.value === value);
      if (i >= 0) return x.map((b, j) => (j === i ? { ...b, amount: b.amount + amt } : b));
      return [...x, value === undefined ? { kind, amount: amt } : { kind, value, amount: amt }];
    });
  const on = (kind: string, value?: number) =>
    bets.find((b) => b.kind === kind && b.value === value)?.amount;
  const n = cs.last?.game === "roulette" ? (cs.last.detail.number as number) : null;
  const cell = (k: RouletteBet["kind"], label: string, v?: number, cls?: string) => (
    <button
      key={label}
      onClick={() => add(k, v)}
      className={cn("relative rounded-md border border-border py-2 text-xs font-semibold", cls)}
    >
      {label}
      {on(k, v) && (
        <span className="absolute -right-1 -top-1 rounded-full bg-gold px-1 text-[9px] text-background">
          {chipsFmt(on(k, v)!)}
        </span>
      )}
    </button>
  );
  return (
    <Card>
      <div className="mb-3 flex items-center justify-center">
        <div
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-full border-4 border-gold text-3xl font-bold shadow-glow",
            n === null
              ? "bg-muted"
              : n === 0
                ? "bg-gain"
                : RED.has(n)
                  ? "bg-loss"
                  : "bg-background",
          )}
        >
          {n ?? "–"}
        </div>
      </div>
      <div className="mb-2 text-xs text-muted-foreground">Chip per tap</div>
      <BetInput bet={bet} setBet={setBet} chips={cs.chips} />
      <div className="mt-3 grid grid-cols-[2rem_1fr] gap-1">
        {cell("straight", "0", 0, "bg-gain/30 row-span-1")}
        <div className="grid grid-cols-12 gap-0.5">
          {Array.from({ length: 36 }, (_, i) => i + 1).map((x) => (
            <button
              key={x}
              onClick={() => add("straight", x)}
              className={cn(
                "relative rounded-sm py-1.5 text-[10px] font-bold",
                RED.has(x) ? "bg-loss/70" : "bg-muted",
              )}
            >
              {x}
              {on("straight", x) && (
                <span className="absolute -right-0.5 -top-1 h-2 w-2 rounded-full bg-gold" />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {[1, 2, 3].map((d) => cell("dozen", `${d === 1 ? "1st" : d === 2 ? "2nd" : "3rd"} 12`, d))}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1">
        {[1, 2, 3].map((d) => cell("column", `Col ${d}`, d))}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1">
        {cell("low", "1–18")}
        {cell("even", "Even")}
        {cell("red", "Red", undefined, "bg-loss/40")}
        {cell("black", "Black", undefined, "bg-muted")}
        {cell("odd", "Odd")}
        {cell("high", "19–36")}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Total bet: <b className="num text-foreground">{chipsFmt(total)}</b>
        </span>
        <span>Straight 35:1 · Dozen/Col 2:1 · Others 1:1</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={!bets.length} onClick={() => setBets([])}>
          Clear
        </Button>
        <Button
          className="bg-gradient-primary"
          disabled={pending || !bets.length || total > cs.chips}
          onClick={() => run({ type: "casinoRoulette", bets })}
        >
          Spin
        </Button>
      </div>
      <LastResult cs={cs} game="roulette" />
    </Card>
  );
}

// ---------------------------------------------------------------- Blackjack
function Blackjack({ cs }: { cs: CasinoState }) {
  const { run, pending } = useAct();
  const [bet, setBet] = useState("10");
  const st = cs.active?.game === "blackjack" ? cs.active : null;
  const last =
    !st && cs.last?.game === "blackjack"
      ? (cs.last.detail as {
          player: PCard[];
          dealer: PCard[];
          outcome: string;
          pv: number;
          dv: number;
        })
      : null;
  const player = st?.player ?? last?.player ?? [];
  const dealer = st ? st.dealer : (last?.dealer ?? []);
  return (
    <Card>
      <div className="mb-1 text-xs text-muted-foreground">
        Dealer {dealer.length ? `· ${handValue(dealer).total}` : ""}
      </div>
      <div className="mb-4 flex min-h-16 gap-1.5">
        {dealer.map((c, i) => (
          <PlayingCard key={i} c={c} />
        ))}
        {st && <PlayingCard hidden />}
      </div>
      <div className="mb-1 text-xs text-muted-foreground">
        You {player.length ? `· ${handValue(player).total}` : ""}
      </div>
      <div className="mb-4 flex min-h-16 gap-1.5">
        {player.map((c, i) => (
          <PlayingCard key={i} c={c} />
        ))}
      </div>
      {last && (
        <div className="mb-2 text-center text-sm font-bold uppercase text-gold">{last.outcome}</div>
      )}
      {st ? (
        <div className="grid grid-cols-3 gap-2">
          <Button disabled={pending} onClick={() => run({ type: "casinoBlackjack", move: "hit" })}>
            Hit
          </Button>
          <Button
            disabled={pending}
            variant="outline"
            onClick={() => run({ type: "casinoBlackjack", move: "stand" })}
          >
            Stand
          </Button>
          <Button
            disabled={pending || st.player.length !== 2 || cs.chips < st.bet}
            variant="outline"
            onClick={() => run({ type: "casinoBlackjack", move: "double" })}
          >
            Double
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <BetInput bet={bet} setBet={setBet} chips={cs.chips} />
          <Button
            className="w-full bg-gradient-primary"
            disabled={pending || !(Number(bet) >= 1) || Number(bet) > cs.chips}
            onClick={() => run({ type: "casinoBlackjack", move: "start", bet: Number(bet) })}
          >
            Deal
          </Button>
          <div className="text-center text-[11px] text-muted-foreground">
            Blackjack pays 3:2 · Dealer stands on 17
          </div>
        </div>
      )}
      <LastResult cs={cs} game="blackjack" />
    </Card>
  );
}

// ---------------------------------------------------------------- Mines
function Mines({ cs }: { cs: CasinoState }) {
  const { run, pending } = useAct();
  const [bet, setBet] = useState("10");
  const [mines, setMines] = useState(3);
  const st = cs.active?.game === "mines" ? cs.active : null;
  const last =
    !st && cs.last?.game === "mines"
      ? (cs.last.detail as { mines: number[]; revealed: number[]; boom: boolean; hit?: number })
      : null;
  const revealed = st?.revealed ?? last?.revealed ?? [];
  const m = st?.mines ?? mines;
  const cur = minesMultiplier(m, revealed.length);
  const next = minesMultiplier(m, revealed.length + 1);
  return (
    <Card>
      <div className="mb-3 grid grid-cols-5 gap-1.5">
        {Array.from({ length: 25 }, (_, i) => {
          const isMine = last?.mines.includes(i);
          const open = revealed.includes(i);
          return (
            <button
              key={i}
              disabled={!st || open || pending}
              onClick={() => run({ type: "casinoMines", move: "reveal", tile: i })}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border border-border bg-muted transition",
                open && "border-gain bg-gain/20",
                isMine && "border-loss bg-loss/25",
                last?.hit === i && "bg-loss/60",
                st && !open && "active:scale-95",
              )}
            >
              {open ? (
                <Gem className="h-5 w-5 text-gain" />
              ) : isMine ? (
                <Bomb className="h-5 w-5 text-loss" />
              ) : null}
            </button>
          );
        })}
      </div>
      {st ? (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>
              Current <b className="num text-gold">{cur.toFixed(2)}×</b> = {chipsFmt(st.bet * cur)}{" "}
              chips
            </span>
            <span className="text-muted-foreground">Next {next.toFixed(2)}×</span>
          </div>
          <Button
            className="w-full bg-gradient-primary"
            disabled={pending || !st.revealed.length}
            onClick={() => run({ type: "casinoMines", move: "cashout" })}
          >
            Cash out {chipsFmt(st.bet * cur)}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <BetInput bet={bet} setBet={setBet} chips={cs.chips} />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Mines</span>
            <input
              type="range"
              min={1}
              max={24}
              value={mines}
              onChange={(e) => setMines(Number(e.target.value))}
              className="flex-1 accent-[hsl(var(--primary))]"
              aria-label="Number of mines"
            />
            <Pill tone="gold">{mines}</Pill>
          </div>
          <Button
            className="w-full bg-gradient-primary"
            disabled={pending || !(Number(bet) >= 1) || Number(bet) > cs.chips}
            onClick={() => run({ type: "casinoMines", move: "start", bet: Number(bet), mines })}
          >
            Start · first gem {minesMultiplier(mines, 1).toFixed(2)}×
          </Button>
        </div>
      )}
      <LastResult cs={cs} game="mines" />
    </Card>
  );
}

// ---------------------------------------------------------------- Keno
function Keno({ cs }: { cs: CasinoState }) {
  const { run, pending } = useAct();
  const [bet, setBet] = useState("10");
  const [picks, setPicks] = useState<number[]>([]);
  const last =
    cs.last?.game === "keno"
      ? (cs.last.detail as { draw: number[]; picks: number[]; hits: number })
      : null;
  const toggle = (n: number) =>
    setPicks((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length < 10 ? [...p, n] : p));
  const table = CASINO.kenoPay[picks.length] ?? [];
  return (
    <Card>
      <div className="mb-3 grid grid-cols-10 gap-0.5">
        {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
          const sel = picks.includes(n);
          const drawn = last?.draw.includes(n);
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              className={cn(
                "aspect-square rounded-sm text-[10px] font-semibold",
                sel ? "bg-gradient-primary text-primary-foreground" : "bg-muted",
                drawn && !sel && "ring-1 ring-gold text-gold",
                drawn && sel && "ring-2 ring-gain",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      {picks.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
          {table.map(
            (m, h) =>
              m > 0 && (
                <span
                  key={h}
                  className={cn(
                    "rounded border border-border px-1.5 py-0.5",
                    last &&
                      last.hits === h &&
                      last.picks.length === picks.length &&
                      "border-gold text-gold",
                  )}
                >
                  {h} hit{h === 1 ? "" : "s"}: {m}×
                </span>
              ),
          )}
        </div>
      )}
      <div className="space-y-2">
        <BetInput bet={bet} setBet={setBet} chips={cs.chips} />
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setPicks(
                picks.length
                  ? []
                  : Array.from({ length: 80 }, (_, i) => i + 1)
                      .sort(() => Math.random() - 0.5)
                      .slice(0, 10),
              )
            }
          >
            {picks.length ? "Clear" : "Quick pick"}
          </Button>
          <Button
            className="bg-gradient-primary"
            disabled={pending || !picks.length || !(Number(bet) >= 1) || Number(bet) > cs.chips}
            onClick={() => run({ type: "casinoKeno", bet: Number(bet), picks })}
          >
            Draw ({picks.length}/10)
          </Button>
        </div>
      </div>
      {last && (
        <div className="mt-2 text-center text-xs text-muted-foreground">
          {last.hits} of {last.picks.length} hit
        </div>
      )}
      <LastResult cs={cs} game="keno" />
    </Card>
  );
}

// ---------------------------------------------------------------- Hi-Lo
function Hilo({ cs }: { cs: CasinoState }) {
  const { run, pending } = useAct();
  const [bet, setBet] = useState("10");
  const st = cs.active?.game === "hilo" ? cs.active : null;
  const last = !st && cs.last?.game === "hilo" ? (cs.last.detail as { history: PCard[] }) : null;
  const history = st?.history ?? last?.history ?? [];
  const odds = st ? hiloOdds(st.card.r) : null;
  return (
    <Card>
      <div className="mb-3 flex min-h-16 gap-1.5 overflow-x-auto pb-1">
        {history.map((c, i) => (
          <PlayingCard key={i} c={c} />
        ))}
      </div>
      {st && odds ? (
        <div className="space-y-2">
          <div className="text-center text-xs">
            Multiplier <b className="num text-gold">{st.mult.toFixed(2)}×</b> ·{" "}
            {chipsFmt(st.bet * st.mult)} chips
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={pending || odds.higher <= 0}
              onClick={() => run({ type: "casinoHilo", move: "higher" })}
            >
              Higher or same · {hiloStepMult(odds.higher).toFixed(2)}×
            </Button>
            <Button disabled={pending} onClick={() => run({ type: "casinoHilo", move: "lower" })}>
              Lower or same · {hiloStepMult(odds.lower).toFixed(2)}×
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={pending || st.mult <= 1}
            onClick={() => run({ type: "casinoHilo", move: "cashout" })}
          >
            Cash out {chipsFmt(st.bet * st.mult)}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <BetInput bet={bet} setBet={setBet} chips={cs.chips} />
          <Button
            className="w-full bg-gradient-primary"
            disabled={pending || !(Number(bet) >= 1) || Number(bet) > cs.chips}
            onClick={() => run({ type: "casinoHilo", move: "start", bet: Number(bet) })}
          >
            Draw first card
          </Button>
        </div>
      )}
      <LastResult cs={cs} game="hilo" />
    </Card>
  );
}
