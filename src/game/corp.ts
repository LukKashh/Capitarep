import {
  BALANCE,
  CORP_BUSINESSES,
  CORP_DEPARTMENTS,
  CORP_FACILITIES,
  EMPTY_MODS,
  RANKS,
  RANK_PERMS,
  type GlobalMods,
  type Rank,
} from "./config";
import { gainXp, type Ctx } from "./engine";
import { hashStr, mulberry } from "./rng";
import { GameError, type CorpObjective, type CorpState, type PlayerState } from "./types";

export const dayIndex = (t: number) => Math.floor(t / 86400_000); // server-defined daily reset: 00:00 UTC

export function corpCapacity(c: CorpState) {
  return BALANCE.corp.baseCapacity + (c.facilities["f_hq"] ?? 0) * 5;
}
export function corpLevelXp(level: number) {
  return Math.round(BALANCE.corp.levelXp * Math.pow(BALANCE.corp.levelXpGrowth, level - 1));
}
export function dailyLimit(c: CorpState) {
  return Math.round(
    BALANCE.corp.baseDailyLimit * Math.pow(BALANCE.corp.dailyLimitGrowth, c.level - 1),
  );
}
export function facilityCost(id: string, lvl: number) {
  const f = CORP_FACILITIES.find((x) => x.id === id)!;
  return Math.round(f.cost * Math.pow(f.growth, lvl));
}
export function corpMods(c: CorpState | null): GlobalMods {
  const m: GlobalMods = { ...EMPTY_MODS };
  if (!c) return m;
  for (const f of CORP_FACILITIES) {
    if (f.id === "f_hq") continue;
    m[f.bonus] = Math.min(
      BALANCE.corp.bonusCap,
      m[f.bonus] + (c.facilities[f.id] ?? 0) * f.perLevel,
    );
  }
  return m;
}
export function objectiveSlots(c: CorpState) {
  return 1 + Math.floor(c.level / 2);
}

function addCorpXp(c: CorpState, xp: number) {
  c.xp += xp;
  while (c.xp >= corpLevelXp(c.level)) {
    c.xp -= corpLevelXp(c.level);
    c.level += 1;
    log(c, 0, `Corporation reached level ${c.level}`);
  }
}
function log(c: CorpState, now: number, text: string, amount?: number) {
  c.log.unshift({ t: now || Date.now(), text, ...(amount !== undefined ? { amount } : {}) });
  c.log = c.log.slice(0, 100);
}

const MILESTONES: Omit<CorpObjective, "id" | "progress" | "participants" | "expiresAt">[] = [
  {
    kind: "funds",
    title: "Founding Capital",
    target: 20_000,
    minParticipants: 1,
    reward: { corpXp: 400, treasury: 0, memberXp: 150 },
    milestone: true,
  },
  {
    kind: "shifts",
    title: "Build the First Office",
    target: 6,
    minParticipants: 2,
    reward: { corpXp: 500, treasury: 5_000, memberXp: 200 },
    milestone: true,
  },
  {
    kind: "funds",
    title: "Expansion Fund",
    target: 150_000,
    minParticipants: 3,
    reward: { corpXp: 1_200, treasury: 0, memberXp: 400 },
    milestone: true,
  },
];

function genObjective(c: CorpState, now: number): CorpObjective {
  c.objectiveSeq += 1;
  const base = {
    participants: [] as string[],
    progress: 0,
    expiresAt: now + BALANCE.corp.objectiveHours * 3600_000,
  };
  if (c.milestoneIdx < MILESTONES.length && !c.objectives.some((o) => o.milestone)) {
    const m = MILESTONES[c.milestoneIdx++]!;
    return { ...m, ...base, id: `obj${c.objectiveSeq}` };
  }
  const r = mulberry(hashStr(c.id + c.objectiveSeq));
  const members = Object.keys(c.members).length;
  const minP = Math.min(members, Math.max(1, Math.floor(c.level / 2) + (r() < 0.5 ? 1 : 0)));
  const usedKinds = new Set(c.objectives.map((o) => o.kind));
  let kind: CorpObjective["kind"] = r() < 0.5 ? "funds" : "shifts";
  if (usedKinds.has(kind) && !usedKinds.has(kind === "funds" ? "shifts" : "funds"))
    kind = kind === "funds" ? "shifts" : "funds";
  const diff = 1 + r() * 2;
  if (kind === "funds") {
    const target = Math.round(dailyLimit(c) * Math.max(1, minP) * 0.5 * diff);
    return {
      ...base,
      id: `obj${c.objectiveSeq}`,
      kind,
      title: ["Capital Drive", "Treasury Boost", "Investment Round"][Math.floor(r() * 3)]!,
      target,
      minParticipants: minP,
      reward: {
        corpXp: Math.round(300 * diff * c.level),
        treasury: 0,
        memberXp: Math.round(100 * diff * c.level),
      },
      milestone: false,
    };
  }
  const target = Math.round((3 + c.level) * diff);
  return {
    ...base,
    id: `obj${c.objectiveSeq}`,
    kind,
    title: ["Construction Sprint", "Production Push", "Logistics Drill"][Math.floor(r() * 3)]!,
    target,
    minParticipants: minP,
    reward: {
      corpXp: Math.round(350 * diff * c.level),
      treasury: Math.round(2_000 * diff * c.level),
      memberXp: Math.round(120 * diff * c.level),
    },
    milestone: false,
  };
}

/** Lazy corporation simulation: business income, objective expiry & auto-fill. */
export function corpTick(c: CorpState, now: number) {
  const hours = Math.max(0, (now - c.lastTick) / 3600_000);
  if (hours > 0) {
    let income = 0;
    for (const b of Object.values(c.businesses)) {
      const d = CORP_BUSINESSES.find((x) => x.id === b.defId);
      if (!d || !c.departments[d.dept]) continue;
      const officer = c.departments[d.dept]!.officer ? 1.1 : 1;
      const net = (d.revenue * officer - d.expense) * Math.min(hours, 24);
      b.revenueTotal += net;
      income += net;
    }
    if (income > 0) {
      c.treasury += income;
      if (income > 1) log(c, now, `Corporation businesses earned`, Math.round(income));
    }
    c.lastTick = now;
  }
  for (const o of [...c.objectives]) {
    if (o.expiresAt <= now) {
      c.objectives = c.objectives.filter((x) => x !== o);
      c.completedObjectives.unshift({ title: o.title, at: now, success: false });
      if (o.milestone) c.milestoneIdx -= 1; // milestones return later
      c.objectiveCooldownUntil = now + BALANCE.corp.objectiveCooldownMin * 60_000;
    }
  }
  if (now >= c.objectiveCooldownUntil) {
    while (c.objectives.length < objectiveSlots(c)) c.objectives.push(genObjective(c, now));
  }
  c.completedObjectives = c.completedObjectives.slice(0, 50);
}

function progressObjectives(
  c: CorpState,
  uid: string,
  kind: CorpObjective["kind"],
  amount: number,
  now: number,
) {
  for (const o of [...c.objectives]) {
    if (o.kind !== kind) continue;
    o.progress = Math.min(o.target, o.progress + amount);
    if (!o.participants.includes(uid)) o.participants.push(uid);
    if (o.progress >= o.target && o.participants.length >= o.minParticipants) {
      c.objectives = c.objectives.filter((x) => x !== o);
      addCorpXp(c, o.reward.corpXp);
      c.treasury += o.reward.treasury;
      for (const p of o.participants) c.pendingXp[p] = (c.pendingXp[p] ?? 0) + o.reward.memberXp;
      c.completedObjectives.unshift({ title: o.title, at: now, success: true });
      log(c, now, `Objective completed: ${o.title}`, o.reward.treasury || undefined);
      c.objectiveCooldownUntil = now + BALANCE.corp.objectiveCooldownMin * 60_000;
    }
  }
}

export function contributionXp(limit: number, already: number, amount: number) {
  const bands = BALANCE.corp.xpBands;
  let xp = 0;
  let pos = already;
  let rem = amount;
  while (rem > 0 && pos < limit) {
    const band = Math.min(bands.length - 1, Math.floor((pos / limit) * bands.length));
    const bandEnd = ((band + 1) / bands.length) * limit;
    const take = Math.min(rem, bandEnd - pos);
    xp += take * BALANCE.corp.xpPerDollar * bands[band]!;
    pos += take;
    rem -= take;
  }
  return xp;
}

export function newCorp(
  id: string,
  founderId: string,
  founderName: string,
  name: string,
  tag: string,
  recruitment: CorpState["recruitment"],
  now: number,
): CorpState {
  const c: CorpState = {
    id,
    name,
    tag,
    founderId,
    description: "",
    recruitment,
    createdAt: now,
    level: 1,
    xp: 0,
    treasury: 0,
    members: {
      [founderId]: {
        name: founderName,
        rank: "Founder",
        joinedAt: now,
        contribDay: dayIndex(now),
        contribToday: 0,
        total: 0,
        shifts: 0,
        dept: null,
      },
    },
    removed: {},
    applications: {},
    invites: {},
    facilities: {},
    departments: {},
    businesses: {},
    objectives: [],
    objectiveCooldownUntil: 0,
    objectiveSeq: 0,
    milestoneIdx: 0,
    completedObjectives: [],
    lastTick: now,
    log: [],
    pendingXp: {},
  };
  log(c, now, `${founderName} founded ${name}`);
  corpTick(c, now);
  return c;
}

/** Bring player membership in line with the corporation record (kicks, dissolution, accepted applications). */
export function reconcileMembership(
  s: PlayerState,
  uid: string,
  corp: CorpState | null,
  now: number,
) {
  if (s.corp.id && (!corp || corp.dissolved || !corp.members[uid])) {
    const removedAt = corp?.removed[uid];
    s.corp.id = null;
    if (removedAt && !corp?.dissolved)
      s.corp.cooldownUntil = removedAt + BALANCE.corp.leaveCooldownHours * 3600_000;
    s.notifications.unshift({
      id: `n${++s.seq}`,
      t: now,
      kind: "warn",
      text: corp?.dissolved
        ? "Your corporation was dissolved."
        : "You are no longer a member of your corporation.",
    });
  }
}

export type CorpAction =
  | { type: "corpCreate"; name: string; tag: string; recruitment: CorpState["recruitment"] }
  | { type: "corpJoin"; corpId: string }
  | { type: "corpApply"; corpId: string }
  | { type: "corpAcceptInvite"; corpId: string }
  | { type: "corpDecideApplication"; uid: string; accept: boolean }
  | { type: "corpInvite"; username: string }
  | { type: "corpLeave" }
  | { type: "corpKick"; uid: string }
  | { type: "corpSetRank"; uid: string; rank: Rank }
  | { type: "corpTransferFounder"; uid: string }
  | { type: "corpContribute"; amount: number }
  | { type: "corpShift" }
  | { type: "corpFacility"; id: string }
  | { type: "corpDepartment"; id: string }
  | { type: "corpAssignOfficer"; dept: string; uid: string | null }
  | { type: "corpBuyBusiness"; defId: string }
  | { type: "corpSettings"; recruitment?: CorpState["recruitment"]; description?: string }
  | { type: "corpDissolve"; confirm: string };

export type CorpResult = { corp: CorpState | null; dissolve?: boolean; isNew?: boolean };

function member(c: CorpState, uid: string) {
  const m = c.members[uid];
  if (!m) throw new GameError("Not a member");
  return m;
}
function founderOnly(c: CorpState, uid: string) {
  if (c.founderId !== uid) throw new GameError("Only the Founder can do this");
}
function canRecruit(c: CorpState, uid: string) {
  if (!RANK_PERMS[member(c, uid).rank as Rank]?.recruit)
    throw new GameError("Your rank cannot manage recruitment");
}

/** Corp actions. `target` is the corporation being acted on (may differ from player's own for join/apply). `extra.inviteeId` is resolved server-side. */
export function applyCorp(
  ctx: Ctx,
  uid: string,
  a: CorpAction,
  target: CorpState | null,
  extra: { newId?: string; inviteeId?: string; inviteeName?: string; inviteeFree?: boolean },
): CorpResult {
  const s = ctx.s;
  const now = ctx.now;
  if (target) corpTick(target, now);
  switch (a.type) {
    case "corpCreate": {
      if (s.level < BALANCE.corp.minLevel)
        throw new GameError(`Corporations unlock at Player Level ${BALANCE.corp.minLevel}`);
      if (s.corp.id) throw new GameError("You are already in a corporation");
      const name = a.name.trim();
      const tag = a.tag.trim().toUpperCase();
      if (name.length < 3 || name.length > 30) throw new GameError("Name must be 3–30 characters");
      if (!/^[A-Z0-9]{2,5}$/.test(tag)) throw new GameError("Tag must be 2–5 letters/numbers");
      if (!s.username) throw new GameError("Set a username first");
      ctx.s.cash -= BALANCE.corp.fee;
      if (ctx.s.cash < 0) throw new GameError("Insufficient funds");
      ctx.ledger.push({
        type: "corp_creation_fee",
        source: "player:cash",
        destination: "game:corporations",
        amount: BALANCE.corp.fee,
      });
      const c = newCorp(extra.newId!, uid, s.username, name, tag, a.recruitment, now);
      s.corp = { ...s.corp, id: c.id, pending: [], joinedAt: now };
      return { corp: c, isNew: true };
    }
    case "corpJoin":
    case "corpApply":
    case "corpAcceptInvite": {
      if (!target) throw new GameError("Corporation not found");
      if (s.corp.id) throw new GameError("Leave your current corporation first");
      if (s.corp.cooldownUntil > now) throw new GameError("Membership cooldown is still active");
      if (s.level < 2) throw new GameError("Reach Player Level 2 to join a corporation");
      if (!s.username) throw new GameError("Set a username first");
      if (Object.keys(target.members).length >= corpCapacity(target))
        throw new GameError("Corporation is full");
      if (a.type === "corpApply") {
        if (target.recruitment !== "application")
          throw new GameError("This corporation does not take applications");
        target.applications[uid] = { name: s.username, at: now };
        if (!s.corp.pending.includes(target.id)) s.corp.pending.push(target.id);
        return { corp: target };
      }
      if (a.type === "corpJoin" && target.recruitment !== "open")
        throw new GameError("This corporation is not open");
      if (a.type === "corpAcceptInvite" && !target.invites[uid])
        throw new GameError("No invitation");
      delete target.invites[uid];
      delete target.applications[uid];
      delete target.removed[uid];
      target.members[uid] = {
        name: s.username,
        rank: "Member",
        joinedAt: now,
        contribDay: dayIndex(now),
        contribToday: 0,
        total: 0,
        shifts: 0,
        dept: null,
      };
      s.corp = { ...s.corp, id: target.id, pending: [], joinedAt: now };
      log(target, now, `${s.username} joined`);
      return { corp: target };
    }
    default:
      break;
  }
  const c = target;
  if (!c || s.corp.id !== c.id) throw new GameError("You are not in this corporation");
  const me = member(c, uid);
  switch (a.type) {
    case "corpDecideApplication": {
      canRecruit(c, uid);
      const app = c.applications[a.uid];
      if (!app) throw new GameError("Application not found");
      delete c.applications[a.uid];
      if (a.accept) {
        if (!extra.inviteeFree)
          throw new GameError("Player has already joined another corporation");
        if (Object.keys(c.members).length >= corpCapacity(c))
          throw new GameError("Corporation is full");
        c.members[a.uid] = {
          name: app.name,
          rank: "Member",
          joinedAt: now,
          contribDay: dayIndex(now),
          contribToday: 0,
          total: 0,
          shifts: 0,
          dept: null,
        };
        log(c, now, `${app.name} was accepted`);
      }
      return { corp: c };
    }
    case "corpInvite": {
      canRecruit(c, uid);
      if (!extra.inviteeId) throw new GameError("No player with that username");
      if (c.members[extra.inviteeId]) throw new GameError("Already a member");
      c.invites[extra.inviteeId] = { name: extra.inviteeName ?? a.username, at: now };
      return { corp: c };
    }
    case "corpLeave": {
      if (c.founderId === uid) throw new GameError("Founders must transfer leadership or dissolve");
      delete c.members[uid];
      for (const d of Object.values(c.departments)) if (d.officer === uid) d.officer = null;
      log(c, now, `${me.name} left`);
      s.corp = {
        ...s.corp,
        id: null,
        cooldownUntil: now + BALANCE.corp.leaveCooldownHours * 3600_000,
      };
      return { corp: c };
    }
    case "corpKick": {
      if (!RANK_PERMS[me.rank as Rank]?.kick)
        throw new GameError("Your rank cannot remove members");
      const t = c.members[a.uid];
      if (!t || a.uid === c.founderId || a.uid === uid)
        throw new GameError("Cannot remove this member");
      if (RANKS.indexOf(t.rank as Rank) <= RANKS.indexOf(me.rank as Rank))
        throw new GameError("Cannot remove equal or higher rank");
      delete c.members[a.uid];
      c.removed[a.uid] = now;
      for (const d of Object.values(c.departments)) if (d.officer === a.uid) d.officer = null;
      log(c, now, `${t.name} was removed`);
      return { corp: c };
    }
    case "corpSetRank": {
      founderOnly(c, uid);
      const t = c.members[a.uid];
      if (!t || a.uid === uid) throw new GameError("Invalid member");
      if (a.rank === "Founder" || !RANKS.includes(a.rank))
        throw new GameError("Use transfer for Founder");
      t.rank = a.rank;
      if (a.rank !== "Executive Officer")
        for (const d of Object.values(c.departments)) if (d.officer === a.uid) d.officer = null;
      log(c, now, `${t.name} is now ${a.rank}`);
      return { corp: c };
    }
    case "corpTransferFounder": {
      founderOnly(c, uid);
      const t = c.members[a.uid];
      if (!t || a.uid === uid) throw new GameError("Invalid member");
      t.rank = "Founder";
      me.rank = "President";
      c.founderId = a.uid;
      log(c, now, `${t.name} succeeded as Founder`);
      return { corp: c };
    }
    case "corpContribute": {
      const amt = Math.floor(a.amount);
      if (amt <= 0) throw new GameError("Invalid amount");
      const day = dayIndex(now);
      if (me.contribDay !== day) {
        me.contribDay = day;
        me.contribToday = 0;
      }
      const limit = dailyLimit(c);
      if (me.contribToday + amt > limit)
        throw new GameError(
          `Daily limit: $${(limit - me.contribToday).toLocaleString()} remaining`,
        );
      if (s.cash < amt) throw new GameError("Insufficient funds");
      s.cash -= amt;
      ctx.ledger.push({
        type: "corp_contribution",
        source: "player:cash",
        destination: `corp:${c.id}`,
        amount: amt,
        corp_id: c.id,
      });
      const xp = contributionXp(limit, me.contribToday, amt);
      me.contribToday += amt;
      me.total += amt;
      c.treasury += amt;
      s.stats.corpContributed += amt;
      addCorpXp(c, Math.round(xp));
      gainXp(ctx, Math.round(xp));
      log(c, now, `${me.name} contributed`, amt);
      progressObjectives(c, uid, "funds", amt, now);
      return { corp: c };
    }
    case "corpShift": {
      if (now - s.corp.lastShiftAt < BALANCE.corp.shiftCooldownMin * 60_000)
        throw new GameError("You need a break before your next shift");
      s.corp.lastShiftAt = now;
      me.shifts += 1;
      addCorpXp(c, 25);
      gainXp(ctx, 20);
      progressObjectives(c, uid, "shifts", 1, now);
      return { corp: c };
    }
    case "corpFacility": {
      founderOnly(c, uid);
      const f = CORP_FACILITIES.find((x) => x.id === a.id);
      if (!f) throw new GameError("Unknown facility");
      const lvl = c.facilities[f.id] ?? 0;
      if (lvl >= f.max) throw new GameError("Max level");
      const cost = facilityCost(f.id, lvl);
      if (c.treasury < cost) throw new GameError("Treasury too low");
      c.treasury -= cost;
      c.facilities[f.id] = lvl + 1;
      addCorpXp(c, 200);
      ctx.ledger.push({
        type: "corp_facility",
        source: `corp:${c.id}`,
        destination: "game:construction",
        amount: cost,
        corp_id: c.id,
        entity: f.id,
      });
      log(c, now, `Built ${f.name} level ${lvl + 1}`, -cost);
      return { corp: c };
    }
    case "corpDepartment": {
      founderOnly(c, uid);
      const d = CORP_DEPARTMENTS.find((x) => x.id === a.id);
      if (!d || c.departments[d.id]) throw new GameError("Unavailable");
      if (c.treasury < d.cost) throw new GameError("Treasury too low");
      c.treasury -= d.cost;
      c.departments[d.id] = { officer: null, at: now };
      ctx.ledger.push({
        type: "corp_department",
        source: `corp:${c.id}`,
        destination: "game:construction",
        amount: d.cost,
        corp_id: c.id,
        entity: d.id,
      });
      log(c, now, `Established ${d.name}`, -d.cost);
      return { corp: c };
    }
    case "corpAssignOfficer": {
      founderOnly(c, uid);
      const dep = c.departments[a.dept];
      if (!dep) throw new GameError("Department not established");
      if (a.uid && c.members[a.uid]?.rank !== "Executive Officer")
        throw new GameError("Only Executive Officers can be assigned");
      dep.officer = a.uid;
      return { corp: c };
    }
    case "corpBuyBusiness": {
      founderOnly(c, uid);
      const d = CORP_BUSINESSES.find((x) => x.id === a.defId);
      if (!d) throw new GameError("Unknown business");
      if (!c.departments[d.dept]) throw new GameError("Establish the department first");
      if (c.treasury < d.price) throw new GameError("Treasury too low");
      c.treasury -= d.price;
      const inst = `cb${now}`;
      c.businesses[inst] = { inst, defId: d.id, boughtAt: now, revenueTotal: 0 };
      ctx.ledger.push({
        type: "corp_business_purchase",
        source: `corp:${c.id}`,
        destination: "market:corp_business",
        amount: d.price,
        corp_id: c.id,
        entity: d.id,
      });
      log(c, now, `Acquired ${d.name}`, -d.price);
      return { corp: c };
    }
    case "corpSettings": {
      founderOnly(c, uid);
      if (a.recruitment) c.recruitment = a.recruitment;
      if (a.description !== undefined) c.description = a.description.slice(0, 280);
      return { corp: c };
    }
    case "corpDissolve": {
      founderOnly(c, uid);
      if (a.confirm !== c.name) throw new GameError("Type the corporation name to confirm");
      c.dissolved = true;
      log(c, now, "Corporation dissolved");
      s.corp = { ...s.corp, id: null, cooldownUntil: 0 };
      return { corp: c, dissolve: true };
    }
    default:
      throw new GameError("Unknown action");
  }
}
