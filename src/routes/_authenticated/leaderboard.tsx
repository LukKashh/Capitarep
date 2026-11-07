import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { getLeaderboard, getCorporationLeaderboard } from "@/lib/game.functions";
import { money } from "@/lib/format";
import { Card, Loading } from "@/components/game/ui";
import { Button } from "@/components/ui/button";

import { cumulativeXpForLevel } from "@/game/engine";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Online Leaderboards — Capitalfortune" },
      {
        name: "description",
        content: "Top registered Capitalfortune Tycoons and Corporations ranked in real-time.",
      },
    ],
  }),
  component: LeaderboardPage,
});

type Category = "players" | "corporations";
type PlayerCriterion = "networth" | "experience";
type CorpCriterion = "activity" | "experience" | "valuation";

function LeaderboardPage() {
  const [category, setCategory] = useState<Category>("players");
  const [playerCriterion, setPlayerCriterion] = useState<PlayerCriterion>("networth");
  const [corpCriterion, setCorpCriterion] = useState<CorpCriterion>("activity");

  const { data: playersLeaderboard, isLoading: isLoadingPlayers } = useQuery({
    queryKey: ["leaderboard-players"],
    queryFn: () => getLeaderboard(),
    refetchInterval: 30_000,
  });

  const { data: corpsLeaderboard, isLoading: isLoadingCorps } = useQuery({
    queryKey: ["leaderboard-corps"],
    queryFn: () => getCorporationLeaderboard(),
    refetchInterval: 30_000,
  });

  const sortedPlayers = useMemo(() => {
    if (!playersLeaderboard) return [];
    return [...playersLeaderboard].slice(0, 10);
  }, [playersLeaderboard]);

  const sortedCorps = useMemo(() => {
    if (!corpsLeaderboard) return [];
    const list = [...corpsLeaderboard];
    if (corpCriterion === "activity") {
      list.sort((a, b) => b.activity - a.activity);
    } else if (corpCriterion === "experience") {
      list.sort((a, b) => b.xp - a.xp);
    } else if (corpCriterion === "valuation") {
      list.sort((a, b) => b.valuation - a.valuation);
    }
    return list.slice(0, 10);
  }, [corpsLeaderboard, corpCriterion]);

  const isLoading = category === "players" ? isLoadingPlayers : isLoadingCorps;

  return (
    <div className="mx-auto flex h-[calc(100vh-140px)] max-w-2xl flex-col justify-between overflow-hidden pb-2 pt-1">
      {/* 1. Screen Header */}
      <h1 className="shrink-0 text-center font-sora text-base font-bold tracking-wider text-foreground uppercase">
        ONLINE LEADERBOARDS
      </h1>

      {/* 2. Categories Toggle */}
      <div className="grid shrink-0 grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1">
        <Button
          variant={category === "players" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCategory("players")}
          className="h-7 text-[11px] font-semibold tracking-wide uppercase transition-all"
        >
          Players
        </Button>
        <Button
          variant={category === "corporations" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCategory("corporations")}
          className="h-7 text-[11px] font-semibold tracking-wide uppercase transition-all"
        >
          Corporations
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loading />
        </div>
      ) : category === "players" ? (
        /* 2.1 Players — User Rankings */
        <div className="flex flex-1 flex-col justify-between space-y-1.5 overflow-hidden">
          <div className="shrink-0 text-center">
            <h2 className="font-sora text-xs font-bold tracking-wide text-foreground uppercase">
              USER RANKINGS
            </h2>
          </div>

          {/* Criteria selection bar */}
          <div className="grid shrink-0 grid-cols-2 gap-1 rounded-md border border-border bg-card p-0.5">
            <Button
              variant={playerCriterion === "networth" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPlayerCriterion("networth")}
              className="h-6 text-[11px] font-medium"
            >
              Networth
            </Button>
            <Button
              variant={playerCriterion === "experience" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPlayerCriterion("experience")}
              className="h-6 text-[11px] font-medium"
            >
              Experience
            </Button>
          </div>

          {/* Single Frame Display Window (No Scroll) */}
          <Card className="flex flex-1 flex-col divide-y divide-border/40 overflow-hidden text-xs">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 bg-muted/40 px-3 py-1.5 font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="col-span-2 text-center">Ranking</div>
              <div className="col-span-6">Player Username</div>
              <div className="col-span-4 text-right">
                {playerCriterion === "networth" ? "Networth" : "Total XP"}
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-around divide-y divide-border/30">
              {sortedPlayers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No player data available.
                </div>
              ) : (
                sortedPlayers.map((entry, idx) => {
                  const rank = idx + 1;
                  const val =
                    playerCriterion === "networth"
                      ? money(entry.netWorth)
                      : `${cumulativeXpForLevel(entry.level).toLocaleString()} XP`;

                  return (
                    <div
                      key={entry.userId}
                      className="grid grid-cols-12 items-center gap-2 px-3 py-1 transition-colors hover:bg-muted/30"
                    >
                      <div className="col-span-2 text-center font-mono font-bold text-foreground">
                        #{rank}
                      </div>
                      <div className="col-span-6 font-semibold text-foreground truncate flex items-center gap-1.5">
                        <span className="truncate">{entry.username}</span>
                        {entry.corpTag && (
                          <span className="rounded bg-primary/20 px-1 py-0.2 text-[9px] text-primary shrink-0">
                            [{entry.corpTag}]
                          </span>
                        )}
                      </div>
                      <div className="col-span-4 text-right font-mono font-medium text-gain">
                        {val}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      ) : (
        /* 2.2 Corporations — Corporation Rankings */
        <div className="flex flex-1 flex-col justify-between space-y-1.5 overflow-hidden">
          <div className="shrink-0 text-center">
            <h2 className="font-sora text-xs font-bold tracking-wide text-foreground uppercase">
              CORPORATION RANKINGS
            </h2>
          </div>

          {/* Criteria selection bar */}
          <div className="grid shrink-0 grid-cols-3 gap-1 rounded-md border border-border bg-card p-0.5">
            <Button
              variant={corpCriterion === "activity" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCorpCriterion("activity")}
              className="h-6 text-[11px] font-medium"
            >
              Activity
            </Button>
            <Button
              variant={corpCriterion === "experience" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCorpCriterion("experience")}
              className="h-6 text-[11px] font-medium"
            >
              Experience
            </Button>
            <Button
              variant={corpCriterion === "valuation" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCorpCriterion("valuation")}
              className="h-6 text-[11px] font-medium"
            >
              Valuation
            </Button>
          </div>

          {/* Single Frame Display Window (No Scroll) */}
          <Card className="flex flex-1 flex-col divide-y divide-border/40 overflow-hidden text-xs">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 bg-muted/40 px-3 py-1.5 font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="col-span-2 text-center">Ranking</div>
              <div className="col-span-6">Corporation Name</div>
              <div className="col-span-4 text-right">
                {corpCriterion === "activity"
                  ? "Activity Points"
                  : corpCriterion === "experience"
                    ? "Total XP"
                    : "Current Valuation"}
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-around divide-y divide-border/30">
              {sortedCorps.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No corporation data available.
                </div>
              ) : (
                sortedCorps.map((entry, idx) => {
                  const rank = idx + 1;
                  const val =
                    corpCriterion === "activity"
                      ? `${entry.activity.toLocaleString()} pts`
                      : corpCriterion === "experience"
                        ? `${entry.xp.toLocaleString()} XP`
                        : money(entry.valuation);

                  return (
                    <div
                      key={entry.id}
                      className="grid grid-cols-12 items-center gap-2 px-3 py-1 transition-colors hover:bg-muted/30"
                    >
                      <div className="col-span-2 text-center font-mono font-bold text-foreground">
                        #{rank}
                      </div>
                      <div className="col-span-6 font-semibold text-foreground truncate flex items-center gap-1.5">
                        <span className="truncate">{entry.name}</span>
                        <span className="rounded bg-primary/20 px-1 py-0.2 text-[9px] text-primary shrink-0">
                          [{entry.tag}]
                        </span>
                      </div>
                      <div className="col-span-4 text-right font-mono font-medium text-gain">
                        {val}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
