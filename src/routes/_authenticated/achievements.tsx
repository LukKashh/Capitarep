import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { rankArt } from "@/components/game/art";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { ACHIEVEMENTS, repeatTarget } from "@/game/achievements";
import { money, num } from "@/lib/format";
import { Card, Loading, PageHeader, Pill, Progress } from "@/components/game/ui";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — Capitalfortune" },
      { name: "description", content: "Track your milestones and rewards." },
      { property: "og:title", content: "Achievements — Capitalfortune" },
      { property: "og:description", content: "Track your milestones and rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AchievementsPage,
});

const CATS = ["All", ...new Set(ACHIEVEMENTS.map((a) => a.category))];

function AchievementsPage() {
  const { data } = useGame();
  const [cat, setCat] = useState("All");
  const [filter, setFilter] = useState<"all" | "done" | "todo">("all");
  if (!data) return <Loading />;
  const s = data.state;
  const done = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
  const list = ACHIEVEMENTS.filter(
    (a) =>
      (cat === "All" || a.category === cat) &&
      (filter === "all" || (filter === "done" ? !!s.achievements[a.id] : !s.achievements[a.id])),
  );
  return (
    <div>
      <PageHeader title="Achievements" subtitle={`${done} of ${ACHIEVEMENTS.length} unlocked`} />
      <Progress value={done / ACHIEVEMENTS.length} className="mb-4" />
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {CATS.map((c) => (
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
      <div className="mb-3 flex gap-1.5">
        {(["all", "done", "todo"] as const).map((f) => (
          <Button
            variant="ghost"
            size="sm"
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs ${filter === f ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
          >
            {f === "all" ? "All" : f === "done" ? "Unlocked" : "In progress"}
          </Button>
        ))}
      </div>
      <div className="space-y-2">
        {list.map((a) => {
          const rec = s.achievements[a.id];
          const v = s.stats[a.stat] ?? 0;
          const target = a.repeatable ? repeatTarget(a, rec?.cycle ?? 0) : a.target;
          const hidden = a.secret && !rec;
          const levelLocked = a.minLevel && s.level < a.minLevel && !rec;
          return (
            <Card key={a.id} className={rec && !a.repeatable ? "border-gain/30" : ""}>
              <div className="flex items-start justify-between gap-2">
                <img
                  src={rankArt(a.tier)}
                  alt=""
                  className="h-14 w-14 shrink-0 object-contain"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{hidden ? "Secret achievement" : a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {hidden
                      ? "Keep playing to discover it."
                      : levelLocked
                        ? `Visible from Player Level ${a.minLevel}`
                        : `${a.sub} · reach ${num(target)} ${a.stat.replace(/([A-Z])/g, " $1").toLowerCase()}`}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Pill
                    tone={a.tier === "Master" ? "gold" : a.tier === "Expert" ? "primary" : "muted"}
                  >
                    {a.tier}
                  </Pill>
                  {a.repeatable && <Pill>Cycle {rec?.cycle ?? 0}</Pill>}
                </div>
              </div>
              {!hidden && !levelLocked && (!rec || a.repeatable) && (
                <Progress value={v / target} className="mt-2" />
              )}
              {levelLocked && <Lock className="mt-2 h-4 w-4 text-muted-foreground" />}
              {!hidden && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Reward: {money(a.reward.cash)}
                  {a.reward.xp > 0 ? ` · ${a.reward.xp} XP` : ""}
                  {a.reward.rp ? ` · ${a.reward.rp} RP` : ""}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
