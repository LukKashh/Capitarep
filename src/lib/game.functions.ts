import { db, handleFirestoreError, OperationType, getCurrentUser } from "@/lib/firebase";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  runTransaction,
} from "firebase/firestore";
import { apply, newPlayer, tick, gainXp, netWorth, type Action, type Ctx } from "@/game/engine";
import {
  applyCorp,
  corpMods,
  corpTick,
  reconcileMembership,
  facilityCost,
  type CorpAction,
} from "@/game/corp";
import {
  RANK_PERMS,
  CORP_FACILITIES,
  CORP_DEPARTMENTS,
  CORP_BUSINESSES,
  type Rank,
} from "@/game/config";
import { GameError, type CorpState, type PlayerState } from "@/game/types";

type AnyAction = Action | CorpAction;
const CORP_TYPES = new Set([
  "corpCreate",
  "corpJoin",
  "corpApply",
  "corpAcceptInvite",
  "corpDecideApplication",
  "corpInvite",
  "corpLeave",
  "corpKick",
  "corpSetRank",
  "corpTransferFounder",
  "corpContribute",
  "corpShift",
  "corpFacility",
  "corpDepartment",
  "corpAssignOfficer",
  "corpBuyBusiness",
  "corpSettings",
  "corpDissolve",
]);

async function loadCorp(id: string) {
  const ref = doc(db, "corporations", id);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    const st = data.state as CorpState;
    if (data.dissolved) st.dissolved = true;
    return { state: st, version: (data.version as number) ?? 0 };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `corporations/${id}`);
  }
}

function corpView(c: CorpState | null, uid: string) {
  if (!c) return null;
  const me = c.members[uid];
  const perms = me ? RANK_PERMS[me.rank as Rank] : null;
  return {
    ...c,
    log: perms?.viewTreasury ? c.log : c.log.map((l) => ({ t: l.t, text: l.text })),
    myRank: me?.rank ?? null,
    myId: uid,
    perms,
  };
}

/** Secret per-round casino seed: HMAC(server key, user:round). */
async function casinoSeed(uid: string, round: number) {
  const secret = process.env.CASINO_SECRET || "capitalfortune-firebase-prov-sec";
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`casino:${uid}:${round}`)),
  );
  return Array.from(sig.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function run(
  uid: string,
  _email: string | undefined,
  action: AnyAction | null,
  _key: string,
) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    const now = Date.now(); // server time is authoritative
    const playerRef = doc(db, "player_states", uid);
    let row: { state: PlayerState; version: number } | null = null;
    try {
      const snap = await getDoc(playerRef);
      if (snap.exists()) {
        const d = snap.data();
        row = { state: d.state as PlayerState, version: (d.version as number) ?? 0 };
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `player_states/${uid}`);
    }

    const state: PlayerState = row ? row.state : newPlayer(now, "");
    const version = row ? row.version : 0;

    let own = state.corp.id ? await loadCorp(state.corp.id) : null;
    reconcileMembership(state, uid, own?.state ?? null, now);
    if (!state.corp.id) own = null;

    // accepted applications
    if (!state.corp.id && state.corp.pending.length) {
      for (const pid of state.corp.pending) {
        const pc = await loadCorp(pid);
        if (pc && !pc.state.dissolved && pc.state.members[uid]) {
          state.corp.id = pid;
          state.corp.joinedAt = now;
          own = pc;
          break;
        }
      }
      state.corp.pending = state.corp.id ? [] : state.corp.pending;
    }

    const ctx: Ctx = {
      s: state,
      now,
      ledger: [],
      stock: [],
      corpMods: corpMods(own?.state ?? null),
    };
    if (action && action.type.startsWith("casino")) {
      ctx.casinoSeed = await casinoSeed(uid, state.casino?.round ?? 0);
    }
    let corpOut: { id: string; version: number; state: CorpState; dissolve: boolean } | null = null;
    if (own) {
      corpTick(own.state, now);
      const pend = own.state.pendingXp[uid];
      if (pend) {
        gainXp(ctx, pend);
        delete own.state.pendingXp[uid];
      }
      corpOut = { id: own.state.id, version: own.version, state: own.state, dissolve: false };
    }

    try {
      tick(ctx);
      if (action && CORP_TYPES.has(action.type)) {
        const a = action as CorpAction;
        let target: { state: CorpState; version: number } | null = own;
        const extra: {
          newId?: string;
          inviteeId?: string;
          inviteeName?: string;
          inviteeFree?: boolean;
        } = {};
        if (a.type === "corpJoin" || a.type === "corpApply" || a.type === "corpAcceptInvite") {
          target = await loadCorp(a.corpId);
          if (!target || target.state.dissolved) throw new GameError("Corporation not found");
        }
        if (a.type === "corpCreate") {
          target = null;
          extra.newId = crypto.randomUUID();
        }
        if (a.type === "corpInvite") {
          const lower = a.username.trim().toLowerCase();
          const uSnap = await getDoc(doc(db, "usernames", lower));
          if (uSnap.exists()) {
            const uData = uSnap.data();
            extra.inviteeId = uData.userId;
            extra.inviteeName = a.username.trim();
          }
        }
        if (a.type === "corpDecideApplication") {
          const apSnap = await getDoc(doc(db, "player_states", a.uid));
          if (apSnap.exists()) {
            const apData = apSnap.data();
            const apState = apData.state as PlayerState;
            extra.inviteeFree = !apState.corp.id;
          }
        }
        const res = applyCorp(ctx, uid, a, target?.state ?? null, extra);
        if (res.corp) {
          corpOut = {
            id: res.corp.id,
            version: res.isNew ? 0 : target!.version,
            state: res.corp,
            dissolve: !!res.dissolve,
          };
        }
        ctx.corpMods = corpMods(state.corp.id && corpOut && !res.dissolve ? corpOut.state : null);
      } else if (action) {
        apply(ctx, action as Action);
      }
    } catch (e) {
      if (e instanceof GameError) return { ok: false as const, error: e.message };
      throw e;
    }

    // Atomic transaction commit to Firestore
    try {
      await runTransaction(db, async (tx) => {
        const curSnap = await tx.get(playerRef);
        if (curSnap.exists()) {
          const curVer = (curSnap.data().version as number) ?? 0;
          if (curVer !== version) {
            throw new Error("conflict: concurrent state change");
          }
        }

        if (state.username) {
          const lower = state.username.trim().toLowerCase();
          const uRef = doc(db, "usernames", lower);
          const uSnap = await tx.get(uRef);
          if (uSnap.exists() && uSnap.data().userId !== uid) {
            throw new Error("player_username_unique: That username is taken");
          }
          tx.set(uRef, { username: lower, userId: uid, createdAt: now });
        }

        const calculatedNw = Math.max(0, Math.round(netWorth(state, now).total));
        tx.set(playerRef, {
          userId: uid,
          username: state.username || "Player",
          level: state.level || 1,
          netWorth: calculatedNw,
          liquid: state.cash + state.reservedCash,
          title: state.profile?.title || "Aspiring Tycoon",
          avatar: state.profile?.avatar || "briefcase",
          corpTag: own?.state
            ? own.state.tag
            : corpOut && !corpOut.dissolve
              ? corpOut.state.tag
              : null,
          version: version + 1,
          state: state as unknown as Record<string, unknown>,
          updatedAt: now,
        });

        if (corpOut) {
          const corpRef = doc(db, "corporations", corpOut.id);
          tx.set(corpRef, {
            id: corpOut.id,
            name: corpOut.state.name,
            tag: corpOut.state.tag,
            founderId: corpOut.state.founderId,
            version: corpOut.version + 1,
            state: corpOut.state as unknown as Record<string, unknown>,
            dissolved: corpOut.dissolve,
            updatedAt: now,
          });
        }

        for (const l of ctx.ledger) {
          const entryId = crypto.randomUUID();
          tx.set(doc(db, "ledger", entryId), {
            id: entryId,
            type: l.type,
            source: l.source,
            destination: l.destination,
            amount: l.amount,
            entity: l.entity || "",
            createdAt: now,
          });
        }

        for (const s of ctx.stock) {
          const stockRef = doc(db, "collectible_stock", s.id);
          const stockSnap = await tx.get(stockRef);
          const curSold = stockSnap.exists() ? ((stockSnap.data().sold as number) ?? 0) : 0;
          if (s.limit && curSold + s.qty > s.limit) {
            throw new Error("sold_out: This limited edition is sold out");
          }
          tx.set(stockRef, { itemId: s.id, sold: curSold + s.qty, updatedAt: now });
        }
      });

      const finalCorp =
        state.corp.id && corpOut && !corpOut.dissolve && corpOut.id === state.corp.id
          ? corpOut.state
          : null;
      return { ok: true as const, now, state, corp: corpView(finalCorp, uid) };
    } catch (txErr: unknown) {
      lastErr = txErr;
      const msg = txErr instanceof Error ? txErr.message : String(txErr);
      if (msg.includes("conflict")) continue;
      if (msg.includes("sold_out"))
        return { ok: false as const, error: "This limited edition is sold out" };
      if (msg.includes("player_username_unique"))
        return { ok: false as const, error: "That username is taken" };
      handleFirestoreError(txErr, OperationType.WRITE, `player_states/${uid}`);
    }
  }
  throw new Error(`Busy, please retry (${String((lastErr as Error)?.message ?? "")})`);
}

export async function getGame() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in to continue");
  const r = await run(user.uid, user.email || undefined, null, `tick-${crypto.randomUUID()}`);
  return JSON.parse(JSON.stringify(r)) as typeof r;
}

export async function gameAction(input: { data: { key: string; action: AnyAction } }) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in to continue");
  if (!input || !input.data || typeof input.data.key !== "string") throw new Error("Bad key");
  if (!input.data.action || typeof input.data.action.type !== "string")
    throw new Error("Bad action");
  const r = await run(user.uid, user.email || undefined, input.data.action, `a-${input.data.key}`);
  return JSON.parse(JSON.stringify(r)) as typeof r;
}

export async function listCorporations() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in to continue");
  try {
    const snaps = await getDocs(collection(db, "corporations"));
    return snaps.docs
      .map((d) => {
        const dData = d.data();
        if (dData.dissolved) return null;
        const c = dData.state as CorpState;
        if (!c) return null;
        return {
          id: d.id,
          name: c.name,
          tag: c.tag,
          level: c.level,
          members: Object.keys(c.members || {}).length,
          recruitment: c.recruitment,
          description: c.description,
          invited: !!c.invites?.[user.uid],
          applied: !!c.applications?.[user.uid],
        };
      })
      .filter(Boolean);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "corporations");
  }
}

export async function getLedger() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in to continue");
  try {
    const q = query(collection(db, "ledger"), orderBy("createdAt", "desc"), limit(100));
    const snaps = await getDocs(q);
    return snaps.docs.map((d) => d.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "ledger");
  }
}

export async function getCollectibleStock() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in to continue");
  try {
    const snaps = await getDocs(collection(db, "collectible_stock"));
    const map: Record<string, number> = {};
    snaps.docs.forEach((d) => {
      const dData = d.data();
      if (dData.itemId) map[dData.itemId] = Number(dData.sold) || 0;
    });
    return map;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "collectible_stock");
  }
}

export type LeaderboardEntry = {
  userId: string;
  username: string;
  level: number;
  netWorth: number;
  liquid: number;
  title: string;
  avatar: string;
  corpTag: string | null;
  companiesCount: number;
  propertiesCount: number;
  achievementsCount: number;
  updatedAt: number;
  createdAt: number;
};

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in to continue");
  try {
    const snaps = await getDocs(collection(db, "player_states"));
    const now = Date.now();
    const list: LeaderboardEntry[] = [];
    snaps.docs.forEach((d) => {
      const data = d.data();
      const st = data.state as PlayerState | undefined;
      const nw =
        typeof data.netWorth === "number" ? data.netWorth : st ? netWorth(st, now).total : 0;
      const name = data.username || st?.username || "Anonymous Tycoon";
      list.push({
        userId: d.id,
        username: name,
        level: Number(data.level || st?.level || 1),
        netWorth: Math.max(0, Math.round(nw)),
        liquid: Number(data.liquid || (st ? st.cash + st.reservedCash : 0)),
        title: data.title || st?.profile?.title || "Aspiring Tycoon",
        avatar: data.avatar || st?.profile?.avatar || "briefcase",
        corpTag: data.corpTag || (st?.corp?.id ? "CORP" : null),
        companiesCount: st ? Object.keys(st.companies || {}).length : 0,
        propertiesCount: st ? Object.keys(st.properties || {}).length : 0,
        achievementsCount: st ? Object.keys(st.achievements || {}).length : 0,
        updatedAt: Number(data.updatedAt || st?.lastTick || now),
        createdAt: Number(st?.createdAt || now),
      });
    });
    // Sort by total net worth descending
    list.sort((a, b) => b.netWorth - a.netWorth);
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "player_states");
  }
}

export type CorpLeaderboardEntry = {
  id: string;
  name: string;
  tag: string;
  level: number;
  xp: number;
  activity: number;
  valuation: number;
  treasury: number;
  membersCount: number;
};

export async function getCorporationLeaderboard(): Promise<CorpLeaderboardEntry[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in to continue");
  try {
    const snaps = await getDocs(collection(db, "corporations"));
    const list: CorpLeaderboardEntry[] = [];
    snaps.docs.forEach((d) => {
      const data = d.data();
      if (data.dissolved) return;
      const c = data.state as CorpState | undefined;
      if (!c) return;

      let upgradeSpend = 0;
      for (const [facId, lvl] of Object.entries(c.facilities || {})) {
        for (let i = 0; i < lvl; i++) {
          upgradeSpend += facilityCost(facId, i);
        }
      }
      for (const depId of Object.keys(c.departments || {})) {
        const dDef = CORP_DEPARTMENTS.find((x) => x.id === depId);
        if (dDef) upgradeSpend += dDef.cost;
      }
      for (const b of Object.values(c.businesses || {})) {
        const bDef = CORP_BUSINESSES.find((x) => x.id === b.defId);
        if (bDef) upgradeSpend += bDef.price;
      }

      let businessValuation = 0;
      for (const b of Object.values(c.businesses || {})) {
        const bDef = CORP_BUSINESSES.find((x) => x.id === b.defId);
        if (bDef) businessValuation += bDef.price;
      }
      const holdingsBalance = (c.treasury || 0) + businessValuation;
      const valuation = upgradeSpend + holdingsBalance;

      let totalShifts = 0;
      let totalContrib = 0;
      for (const m of Object.values(c.members || {})) {
        totalShifts += m.shifts || 0;
        totalContrib += m.total || 0;
      }
      const activity =
        totalShifts * 10 +
        Math.floor(totalContrib / 1000) +
        (c.completedObjectives?.length || 0) * 50;

      list.push({
        id: d.id,
        name: c.name || "Corporation",
        tag: c.tag || "CORP",
        level: c.level || 1,
        xp: c.xp || 0,
        activity,
        valuation,
        treasury: c.treasury || 0,
        membersCount: Object.keys(c.members || {}).length,
      });
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "corporations");
    return [];
  }
}
