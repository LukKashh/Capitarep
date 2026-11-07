import { ACHIEVEMENTS, repeatTarget, type StatKey } from "./achievements";
import {
  BALANCE,
  CASINO,
  COMPANY_BY_ID,
  EMPTY_MODS,
  PROPERTY_BY_ID,
  PROPERTY_UPGRADES,
  RESEARCH,
  RESEARCH_BY_ID,
  type CompanyDef,
  type GlobalMods,
} from "./config";
import { applyCasino, casinoOf, type CasinoAction } from "./casino";
import {
  COLLECTIBLE_BY_ID,
  COLLECTIONS,
  HOLD_HOURS,
  RESALE_PCT,
  currentValue,
} from "./collectibles";
import {
  cryptoLiquidity,
  cryptoPriceAtTick,
  cryptoTick,
  listCrypto,
  listStocks,
  stockLiquidity,
  stockPriceAtTick,
  stockProfitable,
  stockTick,
  type CryptoDef,
  type StockDef,
} from "./market";
import { clamp, hashStr, wave } from "./rng";
import {
  GameError,
  type LedgerEntry,
  type OfflineReport,
  type Order,
  type OwnedCompany,
  type PlayerState,
} from "./types";

export type Ctx = {
  s: PlayerState;
  now: number;
  ledger: LedgerEntry[];
  stock: { item: string; qty: number; max: number }[];
  corpMods: GlobalMods;
  casinoSeed?: string;
};

const STAT_KEYS: StatKey[] = [
  "clicks",
  "lifetimeEarned",
  "companiesBought",
  "companiesSold",
  "branches",
  "upgrades",
  "hires",
  "stockTrades",
  "cryptoTrades",
  "dividends",
  "propertiesBought",
  "rentEarned",
  "collectiblesBought",
  "collectionsDone",
  "researchDone",
  "level",
  "netWorth",
  "corpContributed",
  "maintenance",
  "clickerLevel",
];

export function newPlayer(now: number, username: string): PlayerState {
  return {
    v: 1,
    username,
    createdAt: now,
    cash: 0,
    reservedCash: 0,
    xp: 0,
    level: 1,
    levelRewarded: 1,
    clickCapBonus: 0,
    clicker: { level: 1, count: 0 },
    clickTokens: 150,
    clickTokenAt: now,
    lastTick: now,
    companies: {},
    soldCompanies: [],
    capacity: { slots: BALANCE.capacity.initial, level: 0, upgrading: null },
    research: { built: false, slots: 1, active: [], done: [], rp: 0, rpTotal: 0 },
    stocks: { holdings: {}, lastEvalTick: stockTick(now), lastDivDay: Math.floor(now / 86400_000) },
    crypto: { holdings: {}, lastEvalTick: cryptoTick(now) },
    orders: [],
    properties: {},
    soldProperties: [],
    collectibles: {},
    collectibleSales: [],
    collectionsRewarded: [],
    achievements: {},
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<StatKey, number>,
    history: { hourly: [{ t: now, nw: 0, cash: 0 }], daily: [{ t: now, nw: 0, cash: 0 }] },
    notifications: [],
    lastOffline: null,
    corp: { id: null, pending: [], cooldownUntil: 0, lastShiftAt: 0, joinedAt: 0 },
    profile: {
      title: "Aspiring Tycoon",
      bio: "",
      avatar: "briefcase",
      theme: "violet",
      featured: null,
    },
    seq: 0,
  };
}

// ------------------------------------------------------------ helpers
const uid = (c: Ctx, p: string) => `${p}${++c.s.seq}`;
function notify(c: Ctx, kind: PlayerState["notifications"][number]["kind"], text: string) {
  c.s.notifications.unshift({ id: uid(c, "n"), t: c.now, kind, text });
  c.s.notifications = c.s.notifications.slice(0, 40);
}
function credit(
  c: Ctx,
  amount: number,
  type: string,
  source: string,
  entity?: string,
  earned = true,
) {
  if (amount <= 0) return;
  c.s.cash += amount;
  if (earned) c.s.stats.lifetimeEarned += amount;
  c.ledger.push({ type, source, destination: "player:cash", amount: r2(amount), entity });
}
function debit(c: Ctx, amount: number, type: string, destination: string, entity?: string) {
  if (amount < 0) throw new GameError("Invalid amount");
  if (c.s.cash + 1e-9 < amount) throw new GameError("Insufficient funds");
  c.s.cash -= amount;
  c.ledger.push({ type, source: "player:cash", destination, amount: r2(amount), entity });
}
const r2 = (v: number) => Math.round(v * 100) / 100;

const XP_TABLE = [
  200, 350, 750, 1000, 1250, 1500, 1750, 2000, 2500, 2750, 3000, 3350, 3700, 4000, 4500, 5000, 5750,
  6450, 7000, 7700, 8400, 9100, 9800, 10500, 11200, 12200, 13200, 14200, 15200, 16200, 17700, 19200,
  20700, 22200, 23700, 25900, 28100, 30300, 32500, 34700, 37450, 40200, 42950, 45700, 48450, 51700,
  54950, 58200, 61450, 64700, 68700, 72700, 76700, 80700, 84700, 90200, 95700, 101200, 106700,
  112200, 118950, 125700, 132450, 139200, 145950, 153450, 160950, 168450, 175950, 183450, 192200,
  200950, 209700, 218450, 227200, 237450, 247700, 257950, 268200, 278450, 290950, 303450, 315950,
  328450, 340950, 358450, 375950, 393450, 410950, 428450, 450950, 473450, 495950, 518450, 540950,
  565950, 590950, 615950, 640950,
];

export function xpForLevel(level: number) {
  if (level <= 0) return 200;
  if (level <= XP_TABLE.length) return XP_TABLE[level - 1]!;
  const last = XP_TABLE[XP_TABLE.length - 1]!;
  return last + (level - XP_TABLE.length) * 25000;
}

export function cumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += xpForLevel(l);
  }
  return total;
}

export function levelReward(level: number) {
  const P = BALANCE.player;
  return Math.round(P.levelRewardBase * Math.pow(level / P.levelRewardDiv, P.levelRewardExp));
}
export function clickReq(level: number) {
  const C = BALANCE.clicker;
  if (level >= C.hardCap) return Infinity;
  if (level <= C.earlyReqs.length) return C.earlyReqs[level - 1];
  return C.reqBase + C.reqStep * (level - 8);
}
/** Normalized exponential: exactly baseValue at L1 and maxValue at hardCap. */
export function clickBase(level: number) {
  const C = BALANCE.clicker;
  const L = clamp(level, 1, C.hardCap);
  const t = (L - 1) / (C.hardCap - 1);
  const k = C.valueCurve;
  const v = C.baseValue + ((C.maxValue - C.baseValue) * (Math.exp(k * t) - 1)) / (Math.exp(k) - 1);
  return Math.min(C.maxValue, v);
}
export function clickCap(s: PlayerState, mods: GlobalMods) {
  return Math.min(
    BALANCE.clicker.hardCap,
    BALANCE.clicker.initialCap + s.clickCapBonus + Math.round(mods.clickCap),
  );
}

export function personalMods(s: PlayerState): GlobalMods {
  const m: GlobalMods = { ...EMPTY_MODS };
  for (const id of s.research.done) {
    const r = RESEARCH_BY_ID[id];
    if (!r) continue;
    for (const [k, v] of Object.entries(r.effect)) m[k as keyof GlobalMods] += v as number;
  }
  // Luxury benefits: highest per bonus category only
  const best: Partial<Record<keyof GlobalMods, number>> = {};
  const owned = new Set<string>();
  for (const o of Object.values(s.collectibles)) {
    owned.add(o.itemId);
    const b = COLLECTIBLE_BY_ID[o.itemId]?.bonus;
    if (b && (best[b.key] ?? 0) < b.value) best[b.key] = b.value;
  }
  for (const [k, v] of Object.entries(best)) m[k as keyof GlobalMods] += v as number;
  for (const col of COLLECTIONS)
    if (col.items.every((i) => owned.has(i))) m[col.bonus.key] += col.bonus.value;
  m.feeCut = Math.min(0.6, m.feeCut);
  return m;
}
/** corp modifier applied to base first, then personal. */
export const mult = (key: keyof GlobalMods, p: GlobalMods, corp: GlobalMods) =>
  (1 + corp[key]) * (1 + p[key]);

export function gainXp(c: Ctx, amount: number, mods?: GlobalMods) {
  const p = mods ?? personalMods(c.s);
  const xp = Math.round(amount * mult("xpPct", p, c.corpMods) * 100) / 100;
  if (xp <= 0) return;
  c.s.xp += xp;
  while (c.s.xp >= xpForLevel(c.s.level)) {
    c.s.xp -= xpForLevel(c.s.level);
    c.s.level += 1;
    notify(c, "level", `Reached Player Level ${c.s.level}!`);
  }
  // one-time level rewards (never double-granted)
  while (c.s.levelRewarded < c.s.level) {
    c.s.levelRewarded += 1;
    const L = c.s.levelRewarded;
    credit(c, levelReward(L), "level_reward", "game:rewards", `level:${L}`);
    if (L % BALANCE.clicker.capRewardEvery === 0) {
      c.s.clickCapBonus += BALANCE.clicker.capPerReward;
      notify(c, "info", `Clicker cap increased by ${BALANCE.clicker.capPerReward}`);
    }
  }
  c.s.stats.level = c.s.level;
}

export const UNLOCKS = {
  stocks: 2,
  realEstate: 3,
  crypto: 4,
  research: BALANCE.research.minLevel,
  corporation: BALANCE.corp.minLevel,
};
function requireLevel(c: Ctx, lvl: number, what: string) {
  if (c.s.level < lvl) throw new GameError(`${what} unlocks at Player Level ${lvl}`);
}

// ------------------------------------------------------------ companies
const SHORTAGE: Record<string, [mode: "prop" | "floor", v: number]> = {
  lemon: ["prop", 0],
  vending: ["prop", 1],
  cafe: ["floor", 0.3],
  carwash: ["floor", 0.5],
  studio: ["floor", 0.4],
  bakery: ["prop", 0],
  logistics: ["prop", 0],
  hotel: ["prop", 0],
  factory: ["floor", 0.25],
  bank: ["floor", 0.2],
  energy: ["floor", 0.5],
  studio_film: ["floor", 0.3],
};
export const staffCount = (o: OwnedCompany) => Object.values(o.staff).reduce((a, b) => a + b, 0);
export function staffCapacity(o: OwnedCompany, d: CompanyDef) {
  return (
    d.staffCapacity +
    o.capLevel * d.capacityUpgrade.add +
    (d.branch ? o.branches * d.branch.staff : 0)
  );
}
function upgradeSum(
  o: OwnedCompany,
  d: CompanyDef,
  key: "revenuePct" | "expensePct" | "offlineHours" | "staffEff" | "rpPerHour",
) {
  let t = 0;
  for (const u of d.upgrades) t += (o.upgrades[u.id] ?? 0) * (u.effect[key] ?? 0);
  return t;
}
export function staffNeed(o: OwnedCompany, d: CompanyDef) {
  return Math.max(
    0,
    d.minStaff + (d.branch ? o.branches * d.branch.staff : 0) - upgradeSum(o, d, "staffEff"),
  );
}
export function companyEcon(o: OwnedCompany, p: GlobalMods, corp: GlobalMods, t: number) {
  const d = COMPANY_BY_ID[o.defId]!;
  const staff = staffCount(o);
  const need = staffNeed(o, d);
  let factor = 1;
  if (need > 0 && staff < need) {
    const [mode, v] = SHORTAGE[d.id] ?? ["prop", 0];
    factor = mode === "prop" ? Math.max(v === 1 ? 1 : 0, staff / need) : v;
  }
  const amp = d.id === "hotel" ? 0.15 : 0.06;
  const market = 1 + wave(hashStr(d.id), t / 3600_000) * amp;
  const gross =
    d.revenue +
    (d.branch ? o.branches * d.branch.revenue : 0) +
    Math.max(0, staff - need) * d.revenuePerEmployee;
  let revenue =
    gross * (1 + upgradeSum(o, d, "revenuePct")) * mult("businessPct", p, corp) * factor * market;
  const expCut = clamp(upgradeSum(o, d, "expensePct"), 0, 0.7);
  let fixed = (d.fixedExpense + (d.branch ? o.branches * d.branch.expense : 0)) * (1 - expCut);
  let salaries = d.roles.reduce((a, r) => a + (o.staff[r.role] ?? 0) * r.salary, 0);
  if (o.suspended) {
    revenue = 0;
    fixed *= 0.15;
    salaries *= 0.5;
  }
  const breakdown: Record<string, number> = {};
  for (const [k, share] of Object.entries(d.expenseBreakdown)) breakdown[k] = fixed * share;
  breakdown["Salaries"] = salaries;
  const expenses = fixed + salaries;
  const net = revenue - expenses;
  let status: "Profitable" | "Break-even" | "Unprofitable" | "Distressed" | "Suspended" =
    "Profitable";
  if (o.suspended) status = "Suspended";
  else if (o.liabilities > d.liabilities + 1 && net < 0) status = "Distressed";
  else if (Math.abs(net) < revenue * 0.02) status = "Break-even";
  else if (net < 0) status = "Unprofitable";
  return { revenue, expenses, net, breakdown, staff, need, factor, status };
}
export function companyValuation(o: OwnedCompany) {
  return o.price + o.upgradeValue;
}
export function companySaleQuote(o: OwnedCompany, now: number) {
  const d = COMPANY_BY_ID[o.defId]!;
  const termination = d.roles.reduce((a, r) => a + (o.staff[r.role] ?? 0) * r.salary * 8, 0);
  const obligations = o.liabilities + termination;
  let reserves = o.reserves;
  let uncollected = o.uncollected;
  let rem = obligations;
  const fromRes = Math.min(reserves, rem);
  reserves -= fromRes;
  rem -= fromRes;
  const fromUnc = Math.min(uncollected, rem);
  uncollected -= fromUnc;
  rem -= fromUnc;
  const valuation = companyValuation(o) + reserves + uncollected;
  const payout = valuation * BALANCE.companyResalePct;
  const eligibleAt = o.boughtAt + BALANCE.companyMinHoldHours * 3600_000;
  return {
    termination,
    liabilities: o.liabilities,
    obligations,
    injectionNeeded: rem,
    reserves: o.reserves,
    uncollected: o.uncollected,
    valuation,
    payout,
    eligibleAt,
    eligible: now >= eligibleAt,
  };
}

function simulateCompanies(
  c: Ctx,
  dtMs: number,
  offline: boolean,
  report: OfflineReport | null,
  p: GlobalMods,
) {
  const autoIncome = 0;
  let rpGen = 0;
  for (const o of Object.values(c.s.companies)) {
    const d = COMPANY_BY_ID[o.defId]!;
    let hours = dtMs / 3600_000;
    let note = "";
    if (offline) {
      const maxH = d.offlineEligible
        ? d.offlineMaxHours +
          upgradeSum(o, d, "offlineHours") +
          p.offlineHours +
          c.corpMods.offlineHours
        : BALANCE.offline.idleThresholdSec / 3600;
      if (hours > maxH)
        note = d.offlineEligible
          ? `Capped at ${maxH.toFixed(1)}h`
          : "Not eligible for offline income";
      hours = Math.min(hours, maxH);
    }
    if (hours <= 0) continue;
    const e = companyEcon(o, p, c.corpMods, c.now);
    rpGen += upgradeSum(o, d, "rpPerHour") * hours;
    const rev = e.revenue * hours;
    const exp = e.expenses * hours;
    o.revenueTotal += rev;
    o.expenseTotal += exp;
    const last = o.history[o.history.length - 1];
    const hourKey = Math.floor(c.now / 3600_000) * 3600_000;
    if (last && last.t === hourKey) {
      last.rev += rev;
      last.exp += exp;
    } else {
      o.history.push({ t: hourKey, rev, exp });
      o.history = o.history.slice(-72);
    }
    let net = rev - exp;
    if (net >= 0) {
      // pay down liabilities first (from profits)
      const pay = Math.min(o.liabilities, net * 0.25);
      o.liabilities -= pay;
      net -= pay;
      // All business income goes to the temporary business wallet (manual transfer).
      o.uncollected += net;
    } else {
      let loss = -net;
      const r = Math.min(o.reserves, loss);
      o.reserves -= r;
      loss -= r;
      const u = Math.min(o.uncollected, loss);
      o.uncollected -= u;
      loss -= u;
      if (loss > 0) o.liabilities += loss;
      if (!o.suspended && o.liabilities > d.liabilities + d.fixedExpense * 24) {
        o.suspended = true;
        o.autoSuspended = true;
        notify(
          c,
          "warn",
          `${d.name} suspended: unpaid expenses exceeded safe limit. Inject capital to recover.`,
        );
      }
    }
    if (report)
      report.lines.push({
        name: d.name,
        hours,
        amount: net,
        eligible: d.offlineEligible,
        note: note || "Added to business wallet",
      });
  }
  if (autoIncome > 0) credit(c, autoIncome, "company_income", "companies", "auto-deposit");
  return { autoIncome, rpGen };
}

// ------------------------------------------------------------ properties
export function propertyOccupancy(pr: PlayerState["properties"][string], t: number) {
  const d = PROPERTY_BY_ID[pr.defId]!;
  const demand = d.demand * (1 + wave(hashStr(d.category + d.location), t / 3600_000 / 6) * 0.12);
  let occ = 0.72 + wave(hashStr(pr.inst), t / 3600_000 / 4) * 0.1 + (pr.condition - 60) / 400;
  for (const u of PROPERTY_UPGRADES) occ += (pr.upgrades[u.id] ?? 0) * u.occupancy;
  return { occupancy: clamp(occ, 0.05, 1), demand };
}
export function propertyEcon(
  pr: PlayerState["properties"][string],
  p: GlobalMods,
  corp: GlobalMods,
  t: number,
) {
  const d = PROPERTY_BY_ID[pr.defId]!;
  const { occupancy, demand } = propertyOccupancy(pr, t);
  let rentPct = 0;
  let expPct = 0;
  for (const u of PROPERTY_UPGRADES) {
    rentPct += (pr.upgrades[u.id] ?? 0) * u.rentPct;
    expPct += (pr.upgrades[u.id] ?? 0) * u.expensePct;
  }
  const condFactor = pr.condition < 20 ? 0.6 : pr.condition < 40 ? 0.85 : 1;
  const gross = d.rent * occupancy * demand * (1 + rentPct) * condFactor * mult("rentPct", p, corp);
  const expenses = d.expense * (1 - clamp(expPct, 0, 0.6));
  return { gross, expenses, net: gross - expenses, occupancy, demand };
}
export const conditionLabel = (v: number) =>
  v >= 85 ? "Excellent" : v >= 65 ? "Good" : v >= 40 ? "Average" : v >= 20 ? "Poor" : "Critical";
export const propertyValue = (pr: PlayerState["properties"][string]) => pr.price + pr.upgradeValue;

// ------------------------------------------------------------ markets
let stockCache: { at: number; list: StockDef[]; map: Record<string, StockDef> } | null = null;
let cryptoCache: { at: number; list: CryptoDef[]; map: Record<string, CryptoDef> } | null = null;
export function stocksNow(now: number) {
  if (!stockCache || Math.abs(stockCache.at - now) > 60_000) {
    const list = listStocks(now);
    stockCache = { at: now, list, map: Object.fromEntries(list.map((s) => [s.ticker, s])) };
  }
  return stockCache;
}
export function cryptoNow(now: number) {
  if (!cryptoCache || Math.abs(cryptoCache.at - now) > 60_000) {
    const list = listCrypto(now);
    cryptoCache = { at: now, list, map: Object.fromEntries(list.map((s) => [s.symbol, s])) };
  }
  return cryptoCache;
}
export function feePct(market: "stock" | "crypto", p: GlobalMods, corp: GlobalMods) {
  const base = market === "stock" ? BALANCE.stockFeePct : BALANCE.cryptoFeePct;
  return base * (1 - clamp(corp.feeCut, 0, 0.3)) * (1 - clamp(p.feeCut, 0, 0.6));
}
function holdingsOf(c: Ctx, m: "stock" | "crypto") {
  return m === "stock" ? c.s.stocks.holdings : c.s.crypto.holdings;
}
function fillOrder(c: Ctx, o: Order, qty: number, price: number, fee: number) {
  const h = holdingsOf(c, o.market);
  const cost = qty * price;
  const feeAmt = cost * fee;
  const ent = `${o.market}:${o.sym}`;
  if (o.side === "buy") {
    if (o.kind === "market") {
      debit(c, cost + feeAmt, `${o.market}_buy`, `exchange:${o.market}`, ent);
    } else {
      // consume reservation
      const resv = Math.min(o.reservedCash, qty * (o.limit ?? price) * (1 + fee));
      o.reservedCash -= resv;
      c.s.reservedCash -= resv;
      c.s.cash += resv - (cost + feeAmt);
      c.ledger.push({
        type: `${o.market}_buy`,
        source: "player:reserved",
        destination: `exchange:${o.market}`,
        amount: r2(cost + feeAmt),
        entity: ent,
      });
    }
    const hh = (h[o.sym] ??= { qty: 0, reserved: 0, cost: 0 });
    hh.qty += qty;
    hh.cost += cost + feeAmt;
  } else {
    const hh = h[o.sym]!;
    const avg = hh.qty > 0 ? hh.cost / hh.qty : 0;
    hh.qty -= qty;
    hh.cost -= avg * qty;
    if (o.kind !== "market") hh.reserved = Math.max(0, hh.reserved - qty);
    if (hh.qty <= 1e-9) delete h[o.sym];
    c.s.cash += cost - feeAmt;
    c.ledger.push({
      type: `${o.market}_sell`,
      source: `exchange:${o.market}`,
      destination: "player:cash",
      amount: r2(cost - feeAmt),
      entity: ent,
      meta: { fee: r2(feeAmt) },
    });
  }
  o.avgPrice = (o.avgPrice * o.filled + price * qty) / (o.filled + qty);
  o.filled += qty;
  o.fees += feeAmt;
  o.updatedAt = c.now;
  o.status = o.filled + 1e-9 >= o.qty ? "Executed" : "Partially Filled";
  if (o.market === "stock") c.s.stats.stockTrades += 1;
  else c.s.stats.cryptoTrades += 1;
  if (o.status === "Executed" && o.side === "buy" && o.kind !== "market" && o.reservedCash > 0) {
    c.s.reservedCash -= o.reservedCash;
    c.s.cash += o.reservedCash;
    o.reservedCash = 0;
  }
}
function releaseOrder(c: Ctx, o: Order, status: "Cancelled" | "Expired") {
  if (o.side === "buy") {
    c.s.reservedCash -= o.reservedCash;
    c.s.cash += o.reservedCash;
    o.reservedCash = 0;
  } else {
    const h = holdingsOf(c, o.market)[o.sym];
    if (h) h.reserved = Math.max(0, h.reserved - (o.qty - o.filled));
  }
  o.status = status;
  o.updatedAt = c.now;
}
const isOpen = (o: Order) =>
  o.status === "Open" || o.status === "Partially Filled" || o.status === "Triggered";

function evaluateOrders(c: Ctx, p: GlobalMods) {
  for (const m of ["stock", "crypto"] as const) {
    const nowTick = m === "stock" ? stockTick(c.now) : cryptoTick(c.now);
    const state = m === "stock" ? c.s.stocks : c.s.crypto;
    const open = c.s.orders.filter((o) => o.market === m && isOpen(o) && o.kind !== "market");
    const from = Math.max(state.lastEvalTick + 1, nowTick - BALANCE.maxTicksPerEval);
    const fee = feePct(m, p, c.corpMods);
    if (open.length) {
      for (let k = from; k <= nowTick; k++) {
        const tt = k * (m === "stock" ? BALANCE.stockTickMin : BALANCE.cryptoTickMin) * 60_000;
        for (const o of open) {
          if (!isOpen(o)) continue;
          if (tt >= o.expiresAt) {
            releaseOrder(c, o, "Expired");
            continue;
          }
          if (tt < o.createdAt) continue;
          const def = m === "stock" ? stocksNow(c.now).map[o.sym] : cryptoNow(c.now).map[o.sym];
          if (!def) continue;
          const price =
            m === "stock"
              ? stockPriceAtTick(def as StockDef, k)
              : cryptoPriceAtTick(def as CryptoDef, k);
          const liq =
            m === "stock"
              ? stockLiquidity(def as StockDef, k)
              : cryptoLiquidity(def as CryptoDef, k);
          let ok = false;
          if (o.kind === "limit") ok = o.side === "buy" ? price <= o.limit! : price >= o.limit!;
          if (o.kind === "stop") {
            if (o.status === "Open" && price <= o.trigger!) o.status = "Triggered";
            ok = o.status !== "Open";
          }
          if (o.kind === "tp") {
            if (o.status === "Open" && price >= o.trigger!) o.status = "Triggered";
            ok = o.status !== "Open";
          }
          if (!ok) continue;
          const q = Math.min(o.qty - o.filled, m === "stock" ? Math.floor(liq) : liq);
          if (q <= 0) continue;
          fillOrder(c, o, q, price, fee);
          notify(
            c,
            "info",
            `${o.side === "buy" ? "Bought" : "Sold"} ${fmtQ(q)} ${o.sym} @ ${price.toFixed(2)} (${o.kind})`,
          );
        }
      }
    }
    state.lastEvalTick = nowTick;
  }
  // dividends
  const today = Math.floor(c.now / 86400_000);
  const startDay = Math.max(c.s.stocks.lastDivDay + 1, today - 30);
  let divs = 0;
  for (let d = startDay; d <= today; d++) {
    for (const [sym, h] of Object.entries(c.s.stocks.holdings)) {
      const def = stocksNow(c.now).map[sym];
      if (!def || def.dividendYield <= 0 || !stockProfitable(def, d)) continue;
      const price = stockPriceAtTick(def, stockTick(d * 86400_000));
      divs += (h.qty * price * def.dividendYield) / 365;
    }
  }
  c.s.stocks.lastDivDay = today;
  if (divs > 0) {
    credit(c, divs, "dividend", "exchange:stock", "dividends");
    c.s.stats.dividends += divs;
  }
  c.s.orders = c.s.orders
    .filter((o) => isOpen(o) || c.now - o.updatedAt < 14 * 86400_000)
    .slice(0, 200);
}
const fmtQ = (q: number) =>
  q >= 1 ? q.toLocaleString("en-US", { maximumFractionDigits: 2 }) : q.toPrecision(3);

// ------------------------------------------------------------ net worth
export function netWorth(s: PlayerState, now: number) {
  const liquid = s.cash + s.reservedCash + (s.casino?.chips ?? 0) * CASINO.chipValue;
  let business = 0;
  let liabilities = 0;
  for (const o of Object.values(s.companies)) {
    business += companyValuation(o) + o.reserves + o.uncollected;
    liabilities += o.liabilities;
  }
  let stocks = 0;
  for (const [k, h] of Object.entries(s.stocks.holdings)) {
    const d = stocksNow(now).map[k];
    if (d) stocks += h.qty * stockPriceAtTick(d, stockTick(now));
  }
  let crypto = 0;
  for (const [k, h] of Object.entries(s.crypto.holdings)) {
    const d = cryptoNow(now).map[k];
    if (d) crypto += h.qty * cryptoPriceAtTick(d, cryptoTick(now));
  }
  let property = 0;
  for (const pr of Object.values(s.properties)) property += propertyValue(pr);
  let collectibles = 0;
  for (const o of Object.values(s.collectibles)) {
    const d = COLLECTIBLE_BY_ID[o.itemId];
    if (d) collectibles += currentValue(d, now);
  }
  const assets = business + stocks + crypto + property + collectibles;
  return {
    liquid,
    business,
    stocks,
    crypto,
    property,
    collectibles,
    assets,
    liabilities,
    total: liquid + assets - liabilities,
  };
}

// ------------------------------------------------------------ achievements
function statValue(s: PlayerState, k: StatKey) {
  return s.stats[k] ?? 0;
}
export function checkAchievements(c: Ctx) {
  c.s.stats.clickerLevel = c.s.clicker.level;
  c.s.stats.netWorth = Math.max(c.s.stats.netWorth, netWorth(c.s, c.now).total);
  // collections one-time rewards
  const owned = new Set(Object.values(c.s.collectibles).map((o) => o.itemId));
  for (const col of COLLECTIONS) {
    if (c.s.collectionsRewarded.includes(col.id)) continue;
    if (col.items.every((i) => owned.has(i))) {
      c.s.collectionsRewarded.push(col.id);
      c.s.stats.collectionsDone += 1;
      credit(c, col.reward.cash, "collection_reward", "game:rewards", col.id);
      gainXp(c, col.reward.xp);
      notify(c, "major", `Collection complete: ${col.name}!`);
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      const rec = c.s.achievements[a.id];
      const v = statValue(c.s, a.stat);
      if (a.repeatable) {
        const cycle = rec?.cycle ?? 0;
        if (v >= repeatTarget(a, cycle)) {
          c.s.achievements[a.id] = { at: c.now, cycle: cycle + 1 };
          grant(c, a.reward, a.id + "#" + cycle);
          notify(c, "achievement", `${a.name} (cycle ${cycle + 1})`);
          changed = true;
        }
        continue;
      }
      if (rec) continue;
      if (a.minLevel && c.s.level < a.minLevel) continue;
      if (v >= a.target) {
        c.s.achievements[a.id] = { at: c.now };
        const mult = BALANCE.achievementTierMult[a.tier] ?? 1;
        void mult;
        grant(c, a.reward, a.id);
        notify(
          c,
          a.tier === "Master" || a.tier === "Expert" ? "major" : "achievement",
          `Achievement unlocked: ${a.name}`,
        );
        changed = true;
      }
    }
    if (!changed) break;
  }
}
function grant(c: Ctx, r: { cash: number; xp: number; rp: number }, id: string) {
  credit(c, r.cash, "achievement_reward", "game:rewards", id);
  if (r.rp) {
    c.s.research.rp += r.rp;
    c.s.research.rpTotal += r.rp;
  }
  gainXp(c, r.xp);
}

// ------------------------------------------------------------ tick
export function tick(c: Ctx) {
  const s = c.s;
  const dt = Math.max(0, c.now - s.lastTick);
  if (dt < 1000) return;
  const p = personalMods(s);
  const offline = dt > BALANCE.offline.idleThresholdSec * 1000;
  const report: OfflineReport | null = offline
    ? {
        awaySec: dt / 1000,
        lines: [],
        rent: 0,
        rp: 0,
        total: 0,
        bonusPct: p.businessPct + c.corpMods.businessPct,
        at: c.now,
      }
    : null;
  const cashBefore = s.cash;

  if (s.capacity.upgrading && s.capacity.upgrading.endsAt <= c.now) {
    s.capacity.upgrading = null;
    s.capacity.slots += 1;
    s.capacity.level += 1;
    notify(c, "info", `Business Management upgrade complete: ${s.capacity.slots} company slots.`);
  }
  // research completion
  for (const a of [...s.research.active]) {
    if (a.endsAt <= c.now) {
      s.research.active = s.research.active.filter((x) => x !== a);
      if (!s.research.done.includes(a.id)) {
        s.research.done.push(a.id);
        s.stats.researchDone += 1;
        notify(c, "major", `Research complete: ${RESEARCH_BY_ID[a.id]?.name}`);
        gainXp(c, 100, p);
      }
    }
  }
  const { rpGen } = simulateCompanies(c, dt, offline, report, p);
  const hours = dt / 3600_000;
  const rp =
    ((s.research.built ? BALANCE.research.rpPerHour * hours : 0) + rpGen) *
    mult("rpPct", p, c.corpMods);
  if (rp > 0) {
    s.research.rp += rp;
    s.research.rpTotal += rp;
    if (report) report.rp = rp;
  }

  // rent (capped at 24h while away)
  const rentHours = Math.min(hours, 24);
  let rent = 0;
  for (const pr of Object.values(s.properties)) {
    const e = propertyEcon(pr, p, c.corpMods, c.now);
    const amt = e.net * rentHours;
    pr.rentTotal += amt;
    rent += amt;
    // Rent accrues in the temporary rent wallet; losses drain it first, then cash.
    const w = (pr.uncollected ?? 0) + amt;
    if (w >= 0) pr.uncollected = w;
    else {
      pr.uncollected = 0;
      s.cash = Math.max(0, s.cash + w);
      c.ledger.push({
        type: "property_expense",
        source: "player:cash",
        destination: "properties",
        amount: r2(-w),
      });
    }
    pr.condition = Math.max(0, pr.condition - (BALANCE.propertyDecayPerDay * hours) / 24);
  }
  if (report) report.rent = rent;

  evaluateOrders(c, p);
  s.lastTick = c.now;

  if (report) {
    report.total = s.cash - cashBefore;
    if (report.lines.length || report.rent || report.rp) s.lastOffline = report;
  }
  snapshot(c);
  checkAchievements(c);
}

function snapshot(c: Ctx) {
  const h = c.s.history;
  const last = h.hourly[h.hourly.length - 1];
  if (!last || c.now - last.t >= BALANCE.netWorthSnapshotMin * 60_000) {
    const nw = netWorth(c.s, c.now).total;
    h.hourly.push({ t: c.now, nw, cash: c.s.cash });
    h.hourly = h.hourly.slice(-24 * 30);
    const ld = h.daily[h.daily.length - 1];
    if (!ld || c.now - ld.t >= 86400_000) {
      h.daily.push({ t: c.now, nw, cash: c.s.cash });
      h.daily = h.daily.slice(-800);
    }
  }
}

// ------------------------------------------------------------ actions
export type Action =
  | { type: "click"; count: number }
  | {
      type: "setProfile";
      username?: string;
      title?: string;
      bio?: string;
      avatar?: string;
      theme?: string;
      featured?: string | null;
    }
  | { type: "buyCompany"; defId: string }
  | { type: "sellCompany"; inst: string; confirm: "SELL" }
  | { type: "collect"; inst?: string }
  | { type: "collectRent"; inst?: string }
  | { type: "hire"; inst: string; role: string; count: number; pkg?: number }
  | { type: "fire"; inst: string; role: string; count: number }
  | { type: "companyUpgrade"; inst: string; upgradeId: string }
  | { type: "staffCapacity"; inst: string }
  | { type: "branch"; inst: string }
  | { type: "inject"; inst: string; amount: number }
  | { type: "suspend"; inst: string; on: boolean }
  | { type: "capacityUpgrade" }
  | { type: "buildResearch" }
  | { type: "researchSlot" }
  | { type: "startResearch"; id: string }
  | {
      type: "order";
      market: "stock" | "crypto";
      sym: string;
      side: "buy" | "sell";
      kind: Order["kind"];
      qty: number;
      limit?: number;
      trigger?: number;
    }
  | { type: "cancelOrder"; id: string }
  | { type: "buyProperty"; defId: string }
  | { type: "sellProperty"; inst: string }
  | { type: "maintain"; inst: string }
  | { type: "propertyUpgrade"; inst: string; upgradeId: string }
  | { type: "buyCollectible"; itemId: string; soldCount: number }
  | { type: "sellCollectible"; inst: string }
  | { type: "dismissOffline" }
  | { type: "buyChips"; chips: number }
  | { type: "sellChips"; chips: number }
  | CasinoAction
  | { type: "noop" };

export function capacityUpgradeCost(level: number) {
  return Math.round(BALANCE.capacity.baseCost * Math.pow(BALANCE.capacity.costGrowth, level));
}
export function capacityUpgradeHours(level: number) {
  return BALANCE.capacity.baseHours * Math.pow(BALANCE.capacity.hoursGrowth, level);
}
export const upgradeCost = (base: number, growth: number, lvl: number) =>
  Math.round(base * Math.pow(growth, lvl));
export const branchCost = (d: CompanyDef, n: number) =>
  d.branch ? Math.round(d.branch.cost * Math.pow(d.branch.growth, n)) : 0;
export const researchDuration = (hours: number, p: GlobalMods) =>
  hours * 3600_000 * (1 - clamp(p.researchSpeed, 0, 0.5));

function getCompany(c: Ctx, inst: string) {
  const o = c.s.companies[inst];
  if (!o) throw new GameError("Company not found");
  return { o, d: COMPANY_BY_ID[o.defId]! };
}

export function apply(c: Ctx, a: Action) {
  const s = c.s;
  const p = personalMods(s);
  switch (a.type) {
    case "noop":
    case "dismissOffline":
      if (a.type === "dismissOffline") s.lastOffline = null;
      break;
    case "click": {
      const elapsed = (c.now - s.clickTokenAt) / 1000;
      const B = BALANCE.clicker;
      s.clickTokens = clamp(
        (s.clickTokens || 0) + Math.max(0, elapsed) * B.burstRegenPerSec,
        0,
        B.burstCapacity,
      );
      s.clickTokenAt = c.now;
      const n = Math.min(
        Math.floor(s.clickTokens),
        Math.max(0, Math.floor(a.count)),
        B.burstCapacity,
      );
      s.clickTokens = Math.max(0, s.clickTokens - n);
      const cap = clickCap(s, p);
      let earned = 0;
      for (let i = 0; i < n; i++) {
        earned += clickBase(s.clicker.level) * mult("clickPct", p, c.corpMods); // completing click paid at old value
        if (s.clicker.level >= BALANCE.clicker.hardCap) {
          s.clicker.count = 0;
          continue;
        }
        s.clicker.count += 1;
        if (s.clicker.count >= clickReq(s.clicker.level)) {
          if (s.clicker.level < cap) {
            s.clicker.level += 1;
            s.clicker.count = 0;
            notify(c, "level", `Clicker Level ${s.clicker.level}`);
          } else s.clicker.count = clickReq(s.clicker.level);
        }
      }
      s.stats.clicks += n;
      // Clicks are high-frequency, low-value: no ledger row (keeps DB writes small).
      if (earned > 0) {
        s.cash += earned;
        s.stats.lifetimeEarned += earned;
      }
      let clickXp = 0;
      for (let i = 0; i < n; i++) {
        clickXp += 0.25 + Math.random() * 0.75;
      }
      gainXp(c, clickXp, p);
      break;
    }
    case "setProfile": {
      if (a.username !== undefined) {
        const u = a.username.trim();
        if (!/^[A-Za-z0-9_]{3,20}$/.test(u))
          throw new GameError("Username must be 3–20 letters, numbers or _");
        s.username = u;
      }
      if (a.title !== undefined) s.profile.title = a.title.slice(0, 40);
      if (a.bio !== undefined) s.profile.bio = a.bio.slice(0, 280);
      if (a.avatar !== undefined) s.profile.avatar = a.avatar.slice(0, 20);
      if (a.theme !== undefined) s.profile.theme = a.theme.slice(0, 20);
      if (a.featured !== undefined) {
        if (a.featured && !s.collectibles[a.featured]) throw new GameError("Not owned");
        s.profile.featured = a.featured;
      }
      break;
    }
    case "buyCompany": {
      const d = COMPANY_BY_ID[a.defId];
      if (!d) throw new GameError("Unknown company");
      if (s.capacity.upgrading)
        throw new GameError("Cannot buy companies while a capacity upgrade is in progress");
      if (Object.keys(s.companies).length >= s.capacity.slots)
        throw new GameError("No free company slots — upgrade Business Management");
      debit(c, d.price, "company_purchase", "market:companies", d.id);
      const inst = uid(c, "c");
      const staff: Record<string, number> = {};
      let left = d.startStaff;
      d.roles.forEach((r, i) => {
        const n = i === d.roles.length - 1 ? left : Math.ceil(d.startStaff * 0.8);
        staff[r.role] = Math.min(left, n);
        left -= staff[r.role]!;
      });
      s.companies[inst] = {
        inst,
        defId: d.id,
        boughtAt: c.now,
        price: d.price,
        staff,
        capLevel: 0,
        branches: 0,
        upgrades: {},
        upgradeValue: 0,
        reserves: d.reserves,
        liabilities: d.liabilities,
        uncollected: 0,
        suspended: false,
        autoSuspended: false,
        revenueTotal: 0,
        expenseTotal: 0,
        history: [],
      };
      s.stats.companiesBought += 1;
      gainXp(c, 15, p);
      notify(c, "info", `Acquired ${d.name}`);
      break;
    }
    case "sellCompany": {
      const { o, d } = getCompany(c, a.inst);
      if (a.confirm !== "SELL") throw new GameError("Sale not confirmed");
      const q = companySaleQuote(o, c.now);
      if (!q.eligible) throw new GameError("Minimum ownership period (6h) not reached");
      if (q.injectionNeeded > 0)
        debit(c, q.injectionNeeded, "company_settlement", `company:${o.inst}`, d.id);
      c.s.cash += q.payout;
      c.ledger.push({
        type: "company_sale",
        source: "market:companies",
        destination: "player:cash",
        amount: r2(q.payout),
        entity: d.id,
        meta: { valuation: q.valuation },
      });
      s.soldCompanies.unshift({ name: d.name, soldAt: c.now, payout: q.payout });
      delete s.companies[a.inst];
      s.stats.companiesSold += 1;
      notify(c, "info", `Sold ${d.name} for $${Math.round(q.payout).toLocaleString()}`);
      break;
    }
    case "collect": {
      let total = 0;
      for (const o of Object.values(s.companies)) {
        if (a.inst && o.inst !== a.inst) continue;
        total += o.uncollected;
        o.uncollected = 0;
      }
      if (total <= 0) throw new GameError("Nothing to collect");
      credit(c, total, "company_collect", "companies:uncollected", a.inst ?? "all", false);
      s.stats.lifetimeEarned += total;
      break;
    }
    case "collectRent": {
      let total = 0;
      for (const pr of Object.values(s.properties)) {
        if (a.inst && pr.inst !== a.inst) continue;
        total += pr.uncollected ?? 0;
        pr.uncollected = 0;
      }
      if (total <= 0) throw new GameError("Nothing to collect");
      credit(c, total, "rent_collect", "properties:uncollected", a.inst ?? "all", false);
      s.stats.rentEarned += total;
      s.stats.lifetimeEarned += total;
      break;
    }
    case "hire": {
      const { o, d } = getCompany(c, a.inst);
      const role = d.roles.find((r) => r.role === a.role);
      if (!role) throw new GameError("Unknown role");
      let count = Math.floor(a.count);
      let discount = 0;
      if (a.pkg !== undefined) {
        const pk = d.packages[a.pkg];
        if (!pk) throw new GameError("Unknown package");
        count = pk.count;
        discount = pk.discount;
      }
      if (count < 1) throw new GameError("Invalid count");
      if (staffCount(o) + count > staffCapacity(o, d))
        throw new GameError("Not enough employee capacity");
      debit(c, role.recruit * count * (1 - discount), "recruitment", `company:${o.inst}`, d.id);
      o.staff[role.role] = (o.staff[role.role] ?? 0) + count;
      s.stats.hires += count;
      break;
    }
    case "fire": {
      const { o, d } = getCompany(c, a.inst);
      const role = d.roles.find((r) => r.role === a.role);
      const have = o.staff[a.role] ?? 0;
      const n = Math.min(have, Math.floor(a.count));
      if (!role || n < 1) throw new GameError("Nobody to let go");
      const cost = n * role.salary * 8;
      const fromRes = Math.min(o.reserves, cost);
      o.reserves -= fromRes;
      if (cost - fromRes > 0) debit(c, cost - fromRes, "termination", `company:${o.inst}`, d.id);
      o.staff[a.role] = have - n;
      break;
    }
    case "companyUpgrade": {
      const { o, d } = getCompany(c, a.inst);
      const u = d.upgrades.find((x) => x.id === a.upgradeId);
      if (!u) throw new GameError("Unknown upgrade");
      const lvl = o.upgrades[u.id] ?? 0;
      if (lvl >= u.max) throw new GameError("Already at max level");
      if (u.research && !s.research.done.includes(u.research))
        throw new GameError(`Requires research: ${RESEARCH_BY_ID[u.research]?.name}`);
      const cost = upgradeCost(u.cost, u.growth, lvl);
      debit(c, cost, "company_upgrade", `company:${o.inst}`, `${d.id}:${u.id}`);
      o.upgrades[u.id] = lvl + 1;
      o.upgradeValue += cost;
      s.stats.upgrades += 1;
      gainXp(c, 5, p);
      break;
    }
    case "staffCapacity": {
      const { o, d } = getCompany(c, a.inst);
      if (o.capLevel >= d.capacityUpgrade.max) throw new GameError("Employee capacity at maximum");
      const cost = upgradeCost(d.capacityUpgrade.cost, d.capacityUpgrade.growth, o.capLevel);
      debit(c, cost, "company_upgrade", `company:${o.inst}`, `${d.id}:capacity`);
      o.capLevel += 1;
      o.upgradeValue += cost;
      s.stats.upgrades += 1;
      break;
    }
    case "branch": {
      const { o, d } = getCompany(c, a.inst);
      if (!d.branch) throw new GameError("This company cannot open branches");
      if (o.branches >= d.branch.max) throw new GameError("Maximum branches reached");
      const cost = branchCost(d, o.branches);
      debit(c, cost, "branch_purchase", `company:${o.inst}`, d.id);
      o.branches += 1;
      o.upgradeValue += cost;
      s.stats.branches += 1;
      gainXp(c, 30, p);
      break;
    }
    case "inject": {
      const { o, d } = getCompany(c, a.inst);
      const amt = Math.floor(a.amount);
      if (amt <= 0) throw new GameError("Invalid amount");
      debit(c, amt, "capital_injection", `company:${o.inst}`, d.id); // transfer, not revenue
      let rem = amt;
      const pay = Math.min(o.liabilities, rem);
      o.liabilities -= pay;
      rem -= pay;
      o.reserves += rem;
      if (o.autoSuspended && o.liabilities <= d.liabilities) {
        o.suspended = false;
        o.autoSuspended = false;
        notify(c, "info", `${d.name} resumed operations`);
      }
      break;
    }
    case "suspend": {
      const { o } = getCompany(c, a.inst);
      o.suspended = a.on;
      if (!a.on) o.autoSuspended = false;
      break;
    }
    case "capacityUpgrade": {
      if (s.capacity.upgrading) throw new GameError("A capacity upgrade is already running");
      const cost = capacityUpgradeCost(s.capacity.level);
      debit(c, cost, "capacity_upgrade", "game:business_management");
      s.capacity.upgrading = {
        endsAt: c.now + capacityUpgradeHours(s.capacity.level) * 3600_000,
        cost,
      };
      break;
    }
    case "buildResearch": {
      requireLevel(c, UNLOCKS.research, "Research Department");
      if (s.research.built) throw new GameError("Already built");
      debit(c, BALANCE.research.buildCost, "research_build", "game:research");
      s.research.built = true;
      gainXp(c, 100, p);
      break;
    }
    case "researchSlot": {
      if (!s.research.built) throw new GameError("Build the Research Department first");
      const cost = BALANCE.research.slotCosts[s.research.slots - 1];
      if (cost === undefined) throw new GameError("Maximum research slots");
      debit(c, cost, "research_upgrade", "game:research");
      s.research.slots += 1;
      break;
    }
    case "startResearch": {
      if (!s.research.built) throw new GameError("Build the Research Department first");
      const r = RESEARCH_BY_ID[a.id];
      if (!r) throw new GameError("Unknown project");
      if (s.research.done.includes(r.id) || s.research.active.some((x) => x.id === r.id))
        throw new GameError("Already researched or in progress");
      if (s.research.active.length >= s.research.slots)
        throw new GameError("No free research slot");
      if (!r.prereq.every((x) => s.research.done.includes(x)))
        throw new GameError("Prerequisites not met");
      if (s.research.rp < r.rp) throw new GameError("Not enough RP");
      debit(c, r.cost, "research_project", "game:research", r.id);
      s.research.rp -= r.rp;
      c.ledger.push({
        type: "rp_spend",
        source: "player:rp",
        destination: "game:research",
        amount: r.rp,
        entity: r.id,
      });
      s.research.active.push({ id: r.id, endsAt: c.now + researchDuration(r.hours, p) });
      break;
    }
    case "order": {
      requireLevel(
        c,
        a.market === "stock" ? UNLOCKS.stocks : UNLOCKS.crypto,
        a.market === "stock" ? "Stock market" : "Crypto exchange",
      );
      const def = a.market === "stock" ? stocksNow(c.now).map[a.sym] : cryptoNow(c.now).map[a.sym];
      if (!def) throw new GameError("Unknown asset");
      const qty = a.market === "stock" ? Math.floor(a.qty) : Math.round(a.qty * 1e6) / 1e6;
      if (!(qty > 0)) throw new GameError("Invalid quantity");
      if (a.market === "stock" && (a.kind === "stop" || a.kind === "tp"))
        throw new GameError("Stop-loss / take-profit are crypto-only");
      if ((a.kind === "stop" || a.kind === "tp") && a.side !== "sell")
        throw new GameError("Stop-loss and take-profit are sell orders");
      const fee = feePct(a.market, p, c.corpMods);
      const tk = a.market === "stock" ? stockTick(c.now) : cryptoTick(c.now);
      const price =
        a.market === "stock"
          ? stockPriceAtTick(def as StockDef, tk)
          : cryptoPriceAtTick(def as CryptoDef, tk);
      const h = holdingsOf(c, a.market)[a.sym];
      if (a.side === "sell" && (!h || h.qty - h.reserved + 1e-9 < qty))
        throw new GameError("You don't own enough");
      const o: Order = {
        id: uid(c, "o"),
        market: a.market,
        sym: a.sym,
        side: a.side,
        kind: a.kind,
        qty,
        filled: 0,
        status: "Open",
        createdAt: c.now,
        updatedAt: c.now,
        expiresAt: c.now + BALANCE.orderExpiryDays * 86400_000,
        reservedCash: 0,
        fees: 0,
        avgPrice: 0,
      };
      if (a.kind === "market") {
        const liq =
          a.market === "stock"
            ? stockLiquidity(def as StockDef, tk)
            : cryptoLiquidity(def as CryptoDef, tk);
        const q = Math.min(qty, a.market === "stock" ? Math.floor(liq) : liq);
        if (q <= 0) throw new GameError("No liquidity right now");
        fillOrder(c, o, q, price, fee);
        if (o.filled < o.qty) o.status = "Partially Filled";
        // remainder of a market order is cancelled (no fee)
        if (o.status === "Partially Filled") o.status = "Cancelled";
        if (o.filled >= o.qty) o.status = "Executed";
        gainXp(c, 5, p);
      } else {
        if (a.kind === "limit") {
          if (!(a.limit && a.limit > 0)) throw new GameError("Set a limit price");
          o.limit = a.limit;
        } else {
          if (!(a.trigger && a.trigger > 0)) throw new GameError("Set a trigger price");
          o.trigger = a.trigger;
        }
        if (a.side === "buy") {
          const resv = qty * o.limit! * (1 + fee);
          debit(c, resv, "order_reserve", "player:reserved", `${a.market}:${a.sym}`);
          s.reservedCash += resv;
          o.reservedCash = resv;
        } else h!.reserved += qty;
      }
      s.orders.unshift(o);
      break;
    }
    case "cancelOrder": {
      const o = s.orders.find((x) => x.id === a.id);
      if (!o || !isOpen(o)) throw new GameError("Order not open");
      releaseOrder(c, o, "Cancelled");
      break;
    }
    case "buyProperty": {
      requireLevel(c, UNLOCKS.realEstate, "Real estate");
      const d = PROPERTY_BY_ID[a.defId];
      if (!d) throw new GameError("Unknown property");
      if (Object.values(s.properties).some((x) => x.defId === d.id))
        throw new GameError("You already own this property");
      debit(c, d.price, "property_purchase", "market:property", d.id);
      const inst = uid(c, "p");
      s.properties[inst] = {
        inst,
        defId: d.id,
        boughtAt: c.now,
        price: d.price,
        condition: 100,
        upgrades: {},
        upgradeValue: 0,
        rentTotal: 0,
      };
      s.stats.propertiesBought += 1;
      gainXp(c, 30, p);
      break;
    }
    case "buyChips":
    case "sellChips": {
      const n = Math.floor(a.chips);
      if (!(n >= 1)) throw new GameError("Enter at least 1 chip");
      const cs = casinoOf(s);
      if (a.type === "buyChips") {
        debit(c, n * CASINO.chipValue, "chips_buy", "casino:chips");
        cs.chips = r2(cs.chips + n);
      } else {
        if (cs.chips + 1e-9 < n) throw new GameError("Not enough chips");
        cs.chips = r2(cs.chips - n);
        credit(c, n * CASINO.chipValue, "chips_sell", "casino:chips", undefined, false);
      }
      break;
    }
    case "casinoRoulette":
    case "casinoKeno":
    case "casinoBlackjack":
    case "casinoMines":
    case "casinoHilo":
      if (!c.casinoSeed) throw new GameError("Casino unavailable");
      applyCasino(s, a, c.casinoSeed, c.now);
      break;
    case "sellProperty": {
      const pr = s.properties[a.inst];
      if (!pr) throw new GameError("Not found");
      const payout = propertyValue(pr) * BALANCE.propertyResalePct;
      c.s.cash += payout;
      if ((pr.uncollected ?? 0) > 0) {
        credit(c, pr.uncollected!, "rent_collect", "properties:uncollected", pr.inst, false);
        s.stats.rentEarned += pr.uncollected!;
        s.stats.lifetimeEarned += pr.uncollected!;
      }
      c.ledger.push({
        type: "property_sale",
        source: "market:property",
        destination: "player:cash",
        amount: r2(payout),
        entity: pr.defId,
      });
      s.soldProperties.unshift({ name: PROPERTY_BY_ID[pr.defId]!.name, soldAt: c.now, payout });
      delete s.properties[a.inst];
      break;
    }
    case "maintain": {
      const pr = s.properties[a.inst];
      if (!pr) throw new GameError("Not found");
      if (pr.condition >= 99) throw new GameError("Already in excellent condition");
      const cost = Math.round(pr.price * 0.02 * ((100 - pr.condition) / 100) + 50);
      debit(c, cost, "maintenance", "properties", pr.defId);
      pr.condition = 100;
      s.stats.maintenance += 1;
      break;
    }
    case "propertyUpgrade": {
      const pr = s.properties[a.inst];
      if (!pr) throw new GameError("Not found");
      const d = PROPERTY_BY_ID[pr.defId]!;
      const u = PROPERTY_UPGRADES.find((x) => x.id === a.upgradeId);
      if (!u || !u.categories.includes(d.category))
        throw new GameError("Upgrade not available for this property");
      const lvl = pr.upgrades[u.id] ?? 0;
      if (lvl >= u.max) throw new GameError("Max level");
      if (u.research && !s.research.done.includes(u.research))
        throw new GameError("Requires research");
      const cost = Math.round(d.price * u.costPct * Math.pow(1.5, lvl));
      debit(c, cost, "property_upgrade", "properties", `${d.id}:${u.id}`);
      pr.upgrades[u.id] = lvl + 1;
      pr.upgradeValue += cost;
      break;
    }
    case "buyCollectible": {
      const d = COLLECTIBLE_BY_ID[a.itemId];
      if (!d) throw new GameError("Unknown item");
      if (d.releaseAt && d.releaseAt > c.now) throw new GameError("Not yet released");
      if (d.limited) c.stock.push({ item: d.id, qty: 1, max: d.limited });
      debit(c, d.price, "collectible_purchase", "market:collectibles", d.id);
      const inst = uid(c, "i");
      s.collectibles[inst] = {
        inst,
        itemId: d.id,
        boughtAt: c.now,
        price: d.price,
        holdUntil: c.now + HOLD_HOURS[d.rarity] * 3600_000,
      };
      s.stats.collectiblesBought += 1;
      gainXp(c, 10, p);
      break;
    }
    case "sellCollectible": {
      const o = s.collectibles[a.inst];
      if (!o) throw new GameError("Not found");
      const d = COLLECTIBLE_BY_ID[o.itemId]!;
      if (d.restrictedResale) throw new GameError("This special edition has resale restrictions");
      if (c.now < o.holdUntil) throw new GameError("Holding period not finished");
      const value = currentValue(d, c.now);
      const payout = value * RESALE_PCT[d.rarity];
      c.s.cash += payout;
      c.ledger.push({
        type: "collectible_sale",
        source: "market:collectibles",
        destination: "player:cash",
        amount: r2(payout),
        entity: d.id,
      });
      s.collectibleSales.unshift({ itemId: d.id, soldAt: c.now, price: o.price, payout });
      s.collectibleSales = s.collectibleSales.slice(0, 100);
      if (s.profile.featured === a.inst) s.profile.featured = null;
      delete s.collectibles[a.inst];
      break;
    }
  }
  if (!Number.isFinite(s.cash) || s.cash < -1e-6) throw new GameError("Insufficient funds");
  checkAchievements(c);
}

export { RESEARCH };
