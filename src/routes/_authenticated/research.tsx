import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical, Lock } from "lucide-react";
import { useAct, useGame, useNow } from "@/hooks/use-game";
import { BALANCE, RESEARCH, RESEARCH_BY_ID } from "@/game/config";
import { mult, personalMods, researchDuration, UNLOCKS } from "@/game/engine";
import { corpMods } from "@/game/corp";
import { duration, money } from "@/lib/format";
import {
  Card,
  Confirm,
  Empty,
  Loading,
  PageHeader,
  Pill,
  Progress,
  Stat,
} from "@/components/game/ui";
import { art } from "@/components/game/art";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({
    meta: [
      { title: "Research & Development — Capitalfortune" },
      { name: "description", content: "Central research department and projects." },
      { property: "og:title", content: "Research & Development — Capitalfortune" },
      { property: "og:description", content: "Central research department and projects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResearchPage,
});

function ResearchPage() {
  const { data } = useGame();
  const now = useNow(data?.offset ?? 0);
  const { run, pending } = useAct();
  if (!data) return <Loading />;
  const s = data.state;
  const p = personalMods(s);
  const r = s.research;
  const slotCost = BALANCE.research.slotCosts[r.slots - 1];
  const rpRate = BALANCE.research.rpPerHour * mult("rpPct", p, corpMods(data.corp));

  if (!r.built)
    return (
      <div>
        <PageHeader title="Research & Development" />
        <img
          src={art("research")}
          alt="Research and development laboratory"
          className="game-art mb-4 h-44 w-full"
        />
        <Empty
          icon={<FlaskConical className="h-8 w-8" />}
          title="Build your Research Department"
          text={`A permanent one-time construction. Requires Player Level ${UNLOCKS.research} and ${money(BALANCE.research.buildCost)}. Generates ${BALANCE.research.rpPerHour} RP/hour, even while you're away.`}
          action={
            <Confirm
              trigger={
                <Button
                  disabled={
                    pending || s.level < UNLOCKS.research || s.cash < BALANCE.research.buildCost
                  }
                >
                  {s.level < UNLOCKS.research
                    ? `Unlocks at Level ${UNLOCKS.research}`
                    : `Build · ${money(BALANCE.research.buildCost)}`}
                </Button>
              }
              title="Build Research Department?"
              description="Permanent, one-time construction."
              onConfirm={() => run({ type: "buildResearch" }, "Research Department built")}
            />
          }
        />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Research & Development"
        subtitle="Projects can't be cancelled or refunded once started"
      />
      <img
        src={art("research")}
        alt="Research and development laboratory"
        className="game-art mb-4 h-40 w-full"
      />
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Research points" value={Math.floor(r.rp).toLocaleString()} tone="primary" />
        <Stat label="RP / hour" value={rpRate.toFixed(0)} />
        <Stat label="Slots" value={`${r.active.length}/${r.slots}`} />
      </div>
      {slotCost !== undefined && (
        <Button
          variant="secondary"
          className="mb-4 w-full"
          disabled={pending || s.cash < slotCost}
          onClick={() => run({ type: "researchSlot" }, "Research slot added")}
        >
          Add research slot · {money(slotCost)}
        </Button>
      )}
      {r.active.length > 0 && (
        <div className="mb-4 space-y-2">
          {r.active.map((a) => {
            const d = RESEARCH_BY_ID[a.id]!;
            const total = researchDuration(d.hours, p);
            return (
              <Card key={a.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{d.name}</span>
                  <span className="num">{duration(a.endsAt - now)}</span>
                </div>
                <Progress className="mt-2" value={1 - (a.endsAt - now) / total} />
              </Card>
            );
          })}
        </div>
      )}
      <div className="space-y-2">
        {RESEARCH.map((d) => {
          const done = r.done.includes(d.id);
          const active = r.active.some((x) => x.id === d.id);
          const prereqOk = d.prereq.every((x) => r.done.includes(x));
          return (
            <Card key={d.id} className={done ? "opacity-70" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.desc}</div>
                </div>
                {done ? (
                  <Pill tone="gain">Complete</Pill>
                ) : active ? (
                  <Pill tone="primary">Running</Pill>
                ) : !prereqOk ? (
                  <Pill>
                    <Lock className="mr-1 h-3 w-3" />
                    Locked
                  </Pill>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Pill>{money(d.cost)}</Pill>
                <Pill>{d.rp} RP</Pill>
                <Pill>{duration(researchDuration(d.hours, p))}</Pill>
              </div>
              {d.prereq.length > 0 && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Requires: {d.prereq.map((x) => RESEARCH_BY_ID[x]?.name).join(", ")}
                </div>
              )}
              {!done && !active && (
                <Confirm
                  trigger={
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      disabled={
                        pending ||
                        !prereqOk ||
                        r.rp < d.rp ||
                        s.cash < d.cost ||
                        r.active.length >= r.slots
                      }
                    >
                      Start research
                    </Button>
                  }
                  title={`Start ${d.name}?`}
                  description={`${money(d.cost)} and ${d.rp} RP are deducted now. It cannot be cancelled, paused or refunded.`}
                  onConfirm={() => run({ type: "startResearch", id: d.id }, "Research started")}
                />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
