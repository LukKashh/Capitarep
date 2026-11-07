import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users } from "lucide-react";
import { useAct, useGame, useNow, type CorpView, type GameData } from "@/hooks/use-game";
import { BALANCE, CORP_BUSINESSES, CORP_DEPARTMENTS, CORP_FACILITIES, RANKS } from "@/game/config";
import {
  corpCapacity,
  corpLevelXp,
  corpMods,
  dailyLimit,
  dayIndex,
  facilityCost,
  objectiveSlots,
} from "@/game/corp";
import { listCorporations } from "@/lib/game.functions";
import { date, duration, money, pct } from "@/lib/format";
import {
  Card,
  Confirm,
  Empty,
  Loading,
  PageHeader,
  Pill,
  Progress,
  Row,
  Segmented,
  Stat,
} from "@/components/game/ui";
import { art } from "@/components/game/art";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/corporation")({
  head: () => ({
    meta: [
      { title: "Corporation — Capitalfortune" },
      {
        name: "description",
        content: "Cooperative corporations: treasury, members, facilities and objectives.",
      },
      { property: "og:title", content: "Corporation — Capitalfortune" },
      {
        property: "og:description",
        content: "Cooperative corporations: treasury, members, facilities and objectives.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CorpPage,
});

function CorpPage() {
  const { data } = useGame();
  if (!data) return <Loading />;
  return data.corp ? <InCorp data={data} corp={data.corp} /> : <NoCorp data={data} />;
}

function NoCorp({ data }: { data: GameData }) {
  const s = data.state;
  const now = useNow(data.offset);
  const { run, pending } = useAct();
  const qc = useQueryClient();
  const { data: corps, refetch } = useQuery({
    queryKey: ["corps"],
    queryFn: () => listCorporations(),
  });
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [rec, setRec] = useState<"open" | "application" | "invitation">("open");
  const cooldown = s.corp.cooldownUntil > now;
  const after = () => {
    void refetch();
    void qc.invalidateQueries({ queryKey: ["game"] });
  };
  return (
    <div>
      <div className="mb-4 flex justify-center">
        <img src={art("elite")} alt="Corporation crest" className="h-24 w-32 object-contain" />
      </div>
      <PageHeader
        title="Corporations"
        subtitle="Cooperate with other players. Personal finances stay separate."
      />
      {cooldown && (
        <Card className="mb-3 border-warn/40 text-sm">
          Membership cooldown: {duration(s.corp.cooldownUntil - now)} remaining.
        </Card>
      )}
      {s.corp.pending.length > 0 && (
        <Card className="mb-3 text-sm">
          You have {s.corp.pending.length} pending application(s). You'll join automatically when
          accepted.
        </Card>
      )}
      <Card className="mb-4">
        <div className="text-sm font-semibold">Found a corporation</div>
        <p className="mb-3 text-xs text-muted-foreground">
          Requires Player Level {BALANCE.corp.minLevel} and a {money(BALANCE.corp.fee)} fee. You
          become Founder.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Input
            className="col-span-2 h-11"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
          />
          <Input
            className="h-11"
            placeholder="TAG"
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase())}
            maxLength={5}
          />
        </div>
        <Select value={rec} onValueChange={(v) => setRec(v as typeof rec)}>
          <SelectTrigger className="mt-2 h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open recruitment</SelectItem>
            <SelectItem value="application">Application-based</SelectItem>
            <SelectItem value="invitation">Invitation only</SelectItem>
          </SelectContent>
        </Select>
        <Confirm
          trigger={
            <Button
              className="mt-3 w-full bg-gradient-primary"
              disabled={
                pending || s.level < BALANCE.corp.minLevel || s.cash < BALANCE.corp.fee || cooldown
              }
            >
              {s.level < BALANCE.corp.minLevel
                ? `Unlocks at Level ${BALANCE.corp.minLevel}`
                : `Found · ${money(BALANCE.corp.fee)}`}
            </Button>
          }
          title={`Found ${name || "corporation"}?`}
          description={`${money(BALANCE.corp.fee)} creation fee is deducted from your personal balance.`}
          onConfirm={() =>
            run({ type: "corpCreate", name, tag, recruitment: rec }, "Corporation founded").then(
              after,
            )
          }
        />
      </Card>
      <div className="mb-2 text-sm font-semibold">Join a corporation</div>
      {!corps ? (
        <Loading />
      ) : corps.length === 0 ? (
        <Empty
          icon={<Users className="h-8 w-8" />}
          title="No corporations yet"
          text="Be the first to found one."
        />
      ) : (
        <div className="space-y-2">
          {corps.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    {c.name} <span className="text-xs text-muted-foreground">[{c.tag}]</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Level {c.level} · {c.members} members · {c.recruitment}
                  </div>
                  {c.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                  )}
                </div>
                {c.invited && <Pill tone="gold">Invited</Pill>}
              </div>
              <div className="mt-3">
                {c.invited ? (
                  <Button
                    size="sm"
                    disabled={pending || cooldown}
                    onClick={() =>
                      run({ type: "corpAcceptInvite", corpId: c.id }, "Joined!").then(after)
                    }
                  >
                    Accept invitation
                  </Button>
                ) : c.recruitment === "open" ? (
                  <Button
                    size="sm"
                    disabled={pending || cooldown}
                    onClick={() => run({ type: "corpJoin", corpId: c.id }, "Joined!").then(after)}
                  >
                    Join
                  </Button>
                ) : c.recruitment === "application" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending || cooldown || c.applied}
                    onClick={() =>
                      run({ type: "corpApply", corpId: c.id }, "Application sent").then(after)
                    }
                  >
                    {c.applied ? "Applied" : "Apply"}
                  </Button>
                ) : (
                  <Pill>Invitation only</Pill>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

type Tab =
  "overview" | "objectives" | "members" | "facilities" | "departments" | "history" | "settings";

function InCorp({ data, corp }: { data: GameData; corp: CorpView }) {
  const s = data.state;
  const now = useNow(data.offset);
  const { run, pending } = useAct();
  const [tab, setTab] = useState<Tab>("overview");
  const [amount, setAmount] = useState("");
  const [invite, setInvite] = useState("");
  const [desc, setDesc] = useState(corp.description);
  const [dissolveName, setDissolveName] = useState("");
  const myId = corp.myId;
  const isFounder = corp.founderId === myId;
  const me = corp.members[myId];
  const limit = dailyLimit(corp);
  const today = me && me.contribDay === dayIndex(now) ? me.contribToday : 0;
  const mods = corpMods(corp);
  const members = Object.entries(corp.members).sort(
    (a, b) => RANKS.indexOf(a[1].rank as never) - RANKS.indexOf(b[1].rank as never),
  );
  const shiftReady = now - s.corp.lastShiftAt >= BALANCE.corp.shiftCooldownMin * 60_000;
  const nextReset = (dayIndex(now) + 1) * 86400_000;

  return (
    <div>
      <div className="mb-4 flex justify-center">
        <img src={art("elite")} alt="Corporation crest" className="h-24 w-32 object-contain" />
      </div>
      <PageHeader
        title={corp.name}
        subtitle={`[${corp.tag}] · Level ${corp.level} · ${members.length}/${corpCapacity(corp)} members · You: ${corp.myRank}`}
      />
      <Progress value={corp.xp / corpLevelXp(corp.level)} className="mb-4" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: "overview", label: "Treasury" },
          { id: "objectives", label: "Objectives" },
          { id: "members", label: "Members" },
          { id: "facilities", label: "Facilities" },
          { id: "departments", label: "Departments" },
          { id: "history", label: "History" },
          { id: "settings", label: "Settings" },
        ]}
      />

      {tab === "overview" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Treasury"
              value={money(corp.treasury)}
              tone="primary"
              sub={isFounder ? "Only you can spend" : "Founder-controlled"}
            />
            <Stat label="Your total contribution" value={money(me?.total ?? 0)} />
          </div>
          <Card>
            <div className="text-sm font-semibold">Contribute</div>
            <Row label="Daily limit (Level-based)" value={money(limit)} />
            <Row label="Contributed today" value={money(today)} />
            <Row label="Remaining allowance" value={money(limit - today)} />
            <Row label="Resets in" value={duration(nextReset - now)} />
            <p className="my-2 text-xs text-muted-foreground">
              Contribution XP decreases as you approach the daily limit (100% → 20%). Unused
              allowance doesn't carry over.
            </p>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                className="h-11"
              />
              <Button
                className="h-11"
                disabled={pending || !amount}
                onClick={() =>
                  run({ type: "corpContribute", amount: Number(amount) }, "Contributed").then(() =>
                    setAmount(""),
                  )
                }
              >
                Contribute
              </Button>
            </div>
          </Card>
          <Card>
            <div className="text-sm font-semibold">Construction shift</div>
            <p className="mb-2 text-xs text-muted-foreground">
              Work a shift to advance shift objectives and earn XP. Every{" "}
              {BALANCE.corp.shiftCooldownMin} minutes.
            </p>
            <Button
              variant="secondary"
              className="w-full"
              disabled={pending || !shiftReady}
              onClick={() => run({ type: "corpShift" }, "Shift completed")}
            >
              {shiftReady
                ? "Work a shift"
                : `Ready in ${duration(s.corp.lastShiftAt + BALANCE.corp.shiftCooldownMin * 60_000 - now)}`}
            </Button>
          </Card>
          <Card>
            <div className="mb-1 text-sm font-semibold">Active member bonuses</div>
            {Object.entries(mods).filter(([, v]) => v > 0).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Build facilities to unlock modest bonuses.
              </p>
            ) : (
              Object.entries(mods)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => (
                  <Row
                    key={k}
                    label={k.replace("Pct", "").replace("feeCut", "fee reduction")}
                    value={`+${pct(v)}`}
                    tone="gain"
                  />
                ))
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Capped at {pct(BALANCE.corp.bonusCap, 0)}; applied to base values before personal
              bonuses.
            </p>
          </Card>
        </div>
      )}

      {tab === "objectives" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {objectiveSlots(corp)} objective slot(s). Generated automatically;{" "}
            {corp.objectiveCooldownUntil > now
              ? `next in ${duration(corp.objectiveCooldownUntil - now)}`
              : "slots refill automatically"}
            .
          </p>
          {corp.objectives.length === 0 ? (
            <Empty title="No active objectives" text="New objectives appear after the cooldown." />
          ) : (
            corp.objectives.map((o) => (
              <Card key={o.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{o.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.kind === "funds"
                        ? `Contribute ${money(o.target)}`
                        : `Complete ${o.target} shifts`}{" "}
                      · min {o.minParticipants} distinct members
                    </div>
                  </div>
                  {o.milestone && <Pill tone="gold">Milestone</Pill>}
                </div>
                <Progress value={o.progress / o.target} className="mt-2" />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {o.kind === "funds" ? money(o.progress) : o.progress}/
                    {o.kind === "funds" ? money(o.target) : o.target} · {o.participants.length}{" "}
                    participants
                  </span>
                  <span>{duration(o.expiresAt - now)} left</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Rewards: {o.reward.corpXp} corp XP · {o.reward.memberXp} XP each
                  {o.reward.treasury ? ` · ${money(o.reward.treasury)} treasury` : ""}
                </div>
              </Card>
            ))
          )}
          {corp.completedObjectives.length > 0 && (
            <Card>
              <div className="mb-1 text-sm font-semibold">Recent results</div>
              {corp.completedObjectives.slice(0, 10).map((c, i) => (
                <Row
                  key={i}
                  label={c.title}
                  value={c.success ? "Completed" : "Expired"}
                  tone={c.success ? "gain" : undefined}
                />
              ))}
            </Card>
          )}
        </div>
      )}

      {tab === "members" && (
        <div className="space-y-2">
          {corp.perms?.recruit && (
            <Card>
              <div className="mb-2 text-sm font-semibold">Invite by exact username</div>
              <div className="flex gap-2">
                <Input
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  className="h-11"
                  placeholder="Username"
                />
                <Button
                  className="h-11"
                  disabled={pending || !invite}
                  onClick={() =>
                    run({ type: "corpInvite", username: invite }, "Invitation sent").then(() =>
                      setInvite(""),
                    )
                  }
                >
                  Invite
                </Button>
              </div>
              {Object.entries(corp.applications).length > 0 && (
                <div className="mt-3 text-sm font-semibold">Applications</div>
              )}
              {Object.entries(corp.applications).map(([uid, a]) => (
                <div key={uid} className="mt-2 flex items-center justify-between text-sm">
                  <span>{a.name}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run({ type: "corpDecideApplication", uid, accept: true }, "Accepted")
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run({ type: "corpDecideApplication", uid, accept: false })}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )}
          {members.map(([uid, m]) => (
            <Card key={uid}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    {m.name}
                    {uid === myId && " (you)"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Joined {date(m.joinedAt)} · {money(m.total)} contributed · {m.shifts} shifts
                  </div>
                </div>
                <Pill
                  tone={m.rank === "Founder" ? "gold" : m.rank === "Member" ? "muted" : "primary"}
                >
                  {m.rank}
                </Pill>
              </div>
              {isFounder && uid !== myId && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Select
                    value={m.rank}
                    onValueChange={(v) =>
                      run({ type: "corpSetRank", uid, rank: v as never }, "Rank updated")
                    }
                  >
                    <SelectTrigger className="h-9 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RANKS.filter((r) => r !== "Founder").map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Confirm
                    trigger={
                      <Button size="sm" variant="outline">
                        Make Founder
                      </Button>
                    }
                    title={`Transfer Founder to ${m.name}?`}
                    description="You become President. The new Founder controls the treasury."
                    onConfirm={() =>
                      run({ type: "corpTransferFounder", uid }, "Leadership transferred")
                    }
                  />
                </div>
              )}
              {corp.perms?.kick &&
                uid !== myId &&
                m.rank !== "Founder" &&
                RANKS.indexOf(m.rank as never) > RANKS.indexOf(corp.myRank as never) && (
                  <Confirm
                    trigger={
                      <Button size="sm" variant="ghost" className="mt-1 text-loss">
                        Remove
                      </Button>
                    }
                    title={`Remove ${m.name}?`}
                    description={`They'll have a ${BALANCE.corp.leaveCooldownHours}h cooldown before joining another corporation.`}
                    onConfirm={() => run({ type: "corpKick", uid }, "Member removed")}
                    destructive
                  />
                )}
            </Card>
          ))}
        </div>
      )}

      {tab === "facilities" && (
        <div className="space-y-2">
          {CORP_FACILITIES.map((f) => {
            const lvl = corp.facilities[f.id] ?? 0;
            const cost = facilityCost(f.id, lvl);
            return (
              <Card key={f.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{f.name}</div>
                    <div className="text-xs text-muted-foreground">{f.desc}</div>
                  </div>
                  <Pill>
                    {lvl}/{f.max}
                  </Pill>
                </div>
                {isFounder && (
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    variant="secondary"
                    disabled={pending || lvl >= f.max || corp.treasury < cost}
                    onClick={() => run({ type: "corpFacility", id: f.id }, `${f.name} built`)}
                  >
                    {lvl >= f.max
                      ? "Max level"
                      : `Build level ${lvl + 1} · ${money(cost)} from treasury`}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tab === "departments" && (
        <div className="space-y-2">
          {CORP_DEPARTMENTS.map((d) => {
            const dep = corp.departments[d.id];
            const biz = Object.values(corp.businesses).filter(
              (b) => CORP_BUSINESSES.find((x) => x.id === b.defId)?.dept === d.id,
            );
            const offers = CORP_BUSINESSES.filter((b) => b.dept === d.id);
            const officers = members.filter(([, m]) => m.rank === "Executive Officer");
            return (
              <Card key={d.id}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{d.name}</div>
                  {dep ? <Pill tone="gain">Established</Pill> : <Pill>Not established</Pill>}
                </div>
                {!dep ? (
                  isFounder && (
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      variant="secondary"
                      disabled={pending || corp.treasury < d.cost}
                      onClick={() =>
                        run({ type: "corpDepartment", id: d.id }, "Department established")
                      }
                    >
                      Establish · {money(d.cost)}
                    </Button>
                  )
                ) : (
                  <>
                    <Row
                      label="Officer"
                      value={dep.officer ? (corp.members[dep.officer]?.name ?? "—") : "Unassigned"}
                    />
                    {isFounder && officers.length > 0 && (
                      <Select
                        value={dep.officer ?? "none"}
                        onValueChange={(v) =>
                          run(
                            { type: "corpAssignOfficer", dept: d.id, uid: v === "none" ? null : v },
                            "Officer assigned",
                          )
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {officers.map(([uid, m]) => (
                            <SelectItem key={uid} value={uid}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {biz.map((b) => {
                      const bd = CORP_BUSINESSES.find((x) => x.id === b.defId)!;
                      return (
                        <Row
                          key={b.inst}
                          label={bd.name}
                          value={`${money(bd.revenue - bd.expense)}/h · total ${money(b.revenueTotal)}`}
                          tone="gain"
                        />
                      );
                    })}
                    {isFounder &&
                      offers.map((o) => (
                        <Button
                          key={o.id}
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full justify-between"
                          disabled={pending || corp.treasury < o.price}
                          onClick={() =>
                            run({ type: "corpBuyBusiness", defId: o.id }, `${o.name} acquired`)
                          }
                        >
                          <span>Buy {o.name}</span>
                          <span className="num">{money(o.price)}</span>
                        </Button>
                      ))}
                  </>
                )}
              </Card>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Corporation businesses earn into the treasury and never use your personal company slots.
          </p>
        </div>
      )}

      {tab === "history" && (
        <Card>
          {corp.log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            corp.log.map((l, i) => (
              <Row
                key={i}
                label={
                  <span>
                    {l.text}
                    <span className="block text-[11px]">{date(l.t)}</span>
                  </span>
                }
                value={"amount" in l && l.amount !== undefined ? money(l.amount) : ""}
              />
            ))
          )}
        </Card>
      )}

      {tab === "settings" && (
        <div className="space-y-3">
          {isFounder && (
            <Card className="space-y-2">
              <div className="text-sm font-semibold">Corporation settings</div>
              <Select
                value={corp.recruitment}
                onValueChange={(v) =>
                  run({ type: "corpSettings", recruitment: v as never }, "Recruitment updated")
                }
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="application">Application-based</SelectItem>
                  <SelectItem value="invitation">Invitation only</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                maxLength={280}
                placeholder="Description"
              />
              <Button
                className="w-full"
                disabled={pending}
                onClick={() => run({ type: "corpSettings", description: desc }, "Saved")}
              >
                Save description
              </Button>
            </Card>
          )}
          {!isFounder ? (
            <Confirm
              destructive
              trigger={
                <Button variant="destructive" className="w-full">
                  Leave corporation
                </Button>
              }
              title="Leave corporation?"
              description={`Your bonuses stop immediately and a ${BALANCE.corp.leaveCooldownHours}h cooldown applies. Your contributions stay with the corporation.`}
              onConfirm={() => run({ type: "corpLeave" }, "You left the corporation")}
            />
          ) : (
            <Card className="border-loss/40">
              <div className="text-sm font-semibold text-loss">Dissolve corporation</div>
              <p className="my-2 text-xs text-muted-foreground">
                Irreversible. Type the corporation name to confirm. History is preserved.
              </p>
              <Input
                value={dissolveName}
                onChange={(e) => setDissolveName(e.target.value)}
                placeholder={corp.name}
                className="h-11"
              />
              <Button
                variant="destructive"
                className="mt-2 w-full"
                disabled={pending || dissolveName !== corp.name}
                onClick={() =>
                  run({ type: "corpDissolve", confirm: dissolveName }, "Corporation dissolved")
                }
              >
                Dissolve
              </Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
