import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Wallet, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { art } from "@/components/game/art";
import { useClicker, useGame, useOptimisticTaps } from "@/hooks/use-game";
import { clickBase, clickCap, clickReq, mult, personalMods } from "@/game/engine";
import { corpMods } from "@/game/corp";
import { BALANCE } from "@/game/config";
import { money } from "@/lib/format";
import { Loading, Pill, Progress } from "@/components/game/ui";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Clicker — Capitalfortune" },
      { name: "description", content: "Tap to earn your fortune." },
      { property: "og:title", content: "Clicker — Capitalfortune" },
      { property: "og:description", content: "Tap to earn your fortune." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data } = useGame();
  const opt = useOptimisticTaps(data);
  const { tap, buffer } = useClicker();
  const [pops, setPops] = useState<{ id: number; x: number; y: number }[]>([]);
  const popId = useRef(0);
  if (!data) return <Loading />;
  const s = data.state;
  const p = personalMods(s);
  const cm = corpMods(data.corp);
  const value = clickBase(s.clicker.level) * mult("clickPct", p, cm);
  const req = clickReq(s.clicker.level);
  const cap = clickCap(s, p);
  const maxed = s.clicker.level >= BALANCE.clicker.hardCap;
  const shownCount = maxed ? 0 : Math.min(req, s.clicker.count + buffer);
  const B = BALANCE.clicker;
  const tokens = Math.max(
    0,
    Math.floor(
      Math.min(
        B.burstCapacity,
        s.clickTokens + ((Date.now() - s.clickTokenAt) / 1000) * B.burstRegenPerSec,
      ) - buffer,
    ),
  );

  return (
    <div className="tapper-scene">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="brand-name text-lg">
          Capital<span>fortune</span>
        </h1>
        <Pill tone="gold">LV {s.level}</Pill>
      </div>
      <div className="py-3">
        <div className="mb-1 flex items-center justify-center gap-2 text-xs uppercase text-muted-foreground">
          <Wallet className="h-4 w-4 text-gold" />
          Current balance
        </div>
        <div className="num text-3xl font-bold">{money(s.cash + opt.cash)}</div>
      </div>
      <img src={art("skyline")} alt="Capitalfortune city skyline" className="tapper-city" />
      <div className="tap-stage">
        {pops.map((pp) => (
          <span
            key={pp.id}
            className="tap-pop num pointer-events-none absolute z-10 text-lg font-bold text-gain"
            style={{ left: pp.x, top: pp.y }}
          >
            +{money(value)}
          </span>
        ))}
        <Button
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
            const rect = e.currentTarget.parentElement?.getBoundingClientRect();
            if (!rect) return;
            const id = ++popId.current;
            setPops((list) => [
              ...list.slice(-12),
              { id, x: e.clientX - rect.left - 16, y: e.clientY - rect.top - 24 },
            ]);
            setTimeout(() => setPops((list) => list.filter((q) => q.id !== id)), 700);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              tap();
            }
          }}
          className="tap-coin select-none touch-manipulation p-0"
          aria-label="Tap to earn"
        >
          $
        </Button>
      </div>
      <div className="mb-5">
        <span className="num text-lg font-bold text-gain">+{money(value)}</span>
        <span className="ml-1 text-xs text-muted-foreground">per tap</span>
      </div>
      <div className="border-t border-border pt-4 text-left">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Clicker</span>
          <span className="text-primary-glow">
            Level {s.clicker.level} <span className="text-muted-foreground">/ {cap}</span>
          </span>
        </div>
        <Progress value={maxed ? 1 : shownCount / req} className="mt-2" />
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>
            {maxed ? "MAX LEVEL" : `${shownCount.toLocaleString()} / ${req.toLocaleString()} taps`}
          </span>
          <span>{BALANCE.maxClicksPerSecond} taps/sec</span>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-gold">
            <Zap className="h-4 w-4" />
            Burst tank
          </span>
          <span className="num text-muted-foreground">
            {tokens} / {B.burstCapacity}
          </span>
        </div>
        <Progress value={tokens / B.burstCapacity} className="mt-2 h-1.5" />
      </div>
    </div>
  );
}
