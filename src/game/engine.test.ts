import { describe, expect, it } from "vitest";
import { apply, companySaleQuote, newPlayer, tick, xpForLevel, type Ctx } from "./engine";
import { EMPTY_MODS, BALANCE } from "./config";
import { contributionXp } from "./corp";
import { COLLECTIBLES } from "./collectibles";
import { ACHIEVEMENTS } from "./achievements";

const T0 = Date.UTC(2026, 10, 6, 12);
const sumLedger = (c: Ctx, type: string) =>
  c.ledger.filter((l) => l.type === type).reduce((a, l) => a + l.amount, 0);
const rewards = (c: Ctx) =>
  ["achievement_reward", "level_reward", "collection_reward"].reduce(
    (a, t) => a + sumLedger(c, t),
    0,
  );
const ctx = (now = T0): Ctx => ({
  s: newPlayer(now, "tester"),
  now,
  ledger: [],
  stock: [],
  corpMods: { ...EMPTY_MODS },
});

describe("game rules", () => {
  it("new players start with $0, level 1, no assets", () => {
    const c = ctx();
    expect(c.s.cash).toBe(0);
    expect(c.s.level).toBe(1);
    expect(Object.keys(c.s.companies)).toHaveLength(0);
    expect(c.s.capacity.slots).toBe(3);
  });

  it("first click earns $0.50", () => {
    const c = ctx();
    apply(c, { type: "click", count: 1 });
    expect(c.s.cash).toBeCloseTo(0.5);
    expect(c.ledger.length).toBe(0);
  });

  it("completing click is paid at the old value, then counter resets", () => {
    const c = ctx();
    apply(c, { type: "click", count: 150 });
    apply({ ...c, now: c.now + 10_000 } as Ctx, { type: "click", count: 100 });
    expect(c.s.cash - rewards(c)).toBeCloseTo(125);
    expect(c.s.clicker.level).toBe(2);
    expect(c.s.clicker.count).toBe(0);
  });

  it("player level XP curve matches custom table", () => {
    expect(xpForLevel(1)).toBe(200);
    expect(xpForLevel(2)).toBe(350);
    expect(xpForLevel(49)).toBe(61450);
  });

  it("company resale pays 80% of valuation after 6 hours only", () => {
    const c = ctx();
    c.s.cash = 1_000;
    apply(c, { type: "buyCompany", defId: "lemon" });
    const o = Object.values(c.s.companies)[0]!;
    o.reserves = 0;
    o.staff = {};
    expect(companySaleQuote(o, T0 + 3600_000).eligible).toBe(false);
    const q = companySaleQuote(o, T0 + 6 * 3600_000);
    expect(q.eligible).toBe(true);
    expect(q.payout).toBeCloseTo(800);
  });

  it("cannot buy a company while a capacity upgrade runs", () => {
    const c = ctx();
    c.s.cash = 1e6;
    apply(c, { type: "capacityUpgrade" });
    expect(() => apply(c, { type: "buyCompany", defId: "lemon" })).toThrow();
  });

  it("each completed capacity upgrade adds exactly 1 slot", () => {
    const c = ctx();
    c.s.cash = 1e6;
    apply(c, { type: "capacityUpgrade" });
    const c2: Ctx = { ...c, now: c.s.capacity.upgrading!.endsAt + 1000 };
    tick(c2);
    expect(c2.s.capacity.slots).toBe(4);
  });

  it("property resale pays 75% including upgrades ($130k value → $97.5k)", () => {
    const c = ctx();
    c.s.level = 5;
    c.s.levelRewarded = 5;
    c.s.properties["x"] = {
      inst: "x",
      defId: "p_condo",
      boughtAt: T0,
      price: 100_000,
      condition: 100,
      upgrades: {},
      upgradeValue: 30_000,
      rentTotal: 0,
    };
    apply(c, { type: "sellProperty", inst: "x" });
    expect(sumLedger(c, "property_sale")).toBeCloseTo(97_500);
  });

  it("corporation contribution XP uses diminishing bands", () => {
    const limit = 10_000;
    expect(contributionXp(limit, 0, 2_000)).toBeCloseTo(2_000 * BALANCE.corp.xpPerDollar * 1);
    expect(contributionXp(limit, 8_000, 2_000)).toBeCloseTo(2_000 * BALANCE.corp.xpPerDollar * 0.2);
  });

  it("catalogue sizes match the spec", () => {
    expect(COLLECTIBLES.length).toBe(300);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(150);
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(300);
  });

  it("limit buy reserves funds and cancellation releases them without fee", () => {
    const c = ctx();
    c.s.level = 5;
    c.s.cash = 10_000;
    apply(c, {
      type: "order",
      market: "stock",
      sym: "NOVA",
      side: "buy",
      kind: "limit",
      qty: 10,
      limit: 1,
    });
    expect(c.s.reservedCash).toBeGreaterThan(0);
    const id = c.s.orders[0]!.id;
    apply(c, { type: "cancelOrder", id });
    expect(c.s.reservedCash).toBeCloseTo(0);
    expect(c.s.cash - rewards(c)).toBeCloseTo(10_000);
  });
});

import { applyCorp, dailyLimit } from "./corp";
describe("corporations", () => {
  const setup = () => {
    const c = ctx();
    c.s.level = 10;
    c.s.levelRewarded = 10;
    c.s.cash = 20_000_000;
    const r = applyCorp(
      c,
      "u1",
      { type: "corpCreate", name: "Acme Holdings", tag: "ACME", recruitment: "open" },
      null,
      { newId: "corp1" },
    );
    return { c, corp: r.corp! };
  };
  it("founding charges the configured fee and makes the creator Founder", () => {
    const { c, corp } = setup();
    expect(c.s.cash).toBe(20_000_000 - BALANCE.corp.fee);
    expect(corp.members["u1"]!.rank).toBe("Founder");
    expect(c.s.corp.id).toBe("corp1");
  });
  it("contributions cannot exceed the daily limit", () => {
    const { c, corp } = setup();
    const limit = dailyLimit(corp);
    applyCorp(c, "u1", { type: "corpContribute", amount: limit }, corp, {});
    expect(corp.treasury).toBe(limit);
    expect(() => applyCorp(c, "u1", { type: "corpContribute", amount: 1 }, corp, {})).toThrow();
  });
  it("only the Founder can spend treasury on facilities", () => {
    const { c, corp } = setup();
    corp.treasury = 1e7;
    corp.members["u2"] = {
      name: "B",
      rank: "President",
      joinedAt: T0,
      contribDay: 0,
      contribToday: 0,
      total: 0,
      shifts: 0,
      dept: null,
    };
    const c2 = ctx();
    c2.s.corp.id = "corp1";
    expect(() => applyCorp(c2, "u2", { type: "corpFacility", id: "f_train" }, corp, {})).toThrow();
    applyCorp(c, "u1", { type: "corpFacility", id: "f_train" }, corp, {});
    expect(corp.facilities["f_train"]).toBe(1);
  });
});

import { clickBase, clickReq, levelReward, clickCap } from "./engine";
describe("progression spec", () => {
  it("level-up cash = round(25 × (L/2)^1.7)", () => {
    expect([2, 3, 4, 5, 10, 20].map(levelReward)).toEqual([25, 50, 81, 119, 386, 1253]);
  });
  it("tap payout is $0.50 at L1 and $1,000 at L50", () => {
    expect(clickBase(1)).toBeCloseTo(0.5);
    expect(clickBase(50)).toBeCloseTo(1000);
    expect(clickBase(99)).toBeCloseTo(1000);
  });
  it("clicker tap requirements follow the custom sequence", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(clickReq)).toEqual([250, 500, 750, 1000, 1500, 2000, 3500]);
    expect(clickReq(8)).toBe(5000);
    expect(clickReq(10)).toBe(10000);
    expect(clickReq(49)).toBe(107500);
    expect(clickReq(50)).toBe(Infinity);
  });
  it("clicker cap never exceeds 50", () => {
    const c = ctx();
    c.s.clickCapBonus = 999;
    expect(clickCap(c.s, { ...c.corpMods, clickCap: 50 } as never)).toBe(50);
  });
  it("burst tank caps accepted taps at 150 and 0.25 XP each", () => {
    const c = ctx();
    apply(c, { type: "click", count: 1000 });
    expect(c.s.stats.clicks).toBe(150);
    expect(c.s.clickTokens).toBe(0);
  });

  it("rent accrues to the property wallet at exactly the hourly net rate, then transfers to cash", () => {
    const c = ctx();
    c.s.properties["w"] = {
      inst: "w",
      defId: "p_studio",
      boughtAt: T0,
      price: 40_000,
      condition: 100,
      upgrades: {},
      upgradeValue: 0,
      rentTotal: 0,
    };
    const c2: Ctx = { ...c, now: c.s.lastTick + 3600_000 };
    tick(c2);
    expect(sumLedger(c2, "rent")).toBe(0);
    const cashBefore = c2.s.cash;
    expect(c2.s.properties["w"].uncollected).toBeCloseTo(c2.s.properties["w"].rentTotal, 6);
    expect(c2.s.properties["w"].uncollected!).toBeGreaterThan(0);
    const w = c2.s.properties["w"].uncollected!;
    apply(c2, { type: "collectRent" });
    expect(c2.s.cash).toBeCloseTo(cashBefore + w, 6);
    expect(c2.s.properties["w"].uncollected).toBe(0);
  });

  it("adds 20 new property listings (34 total)", async () => {
    const { PROPERTIES } = await import("./config");
    expect(PROPERTIES.length).toBe(34);
  });

  it("each property listing can be owned at most once", () => {
    const c = ctx();
    c.s.level = 100;
    c.s.cash = 1e6;
    apply(c, { type: "buyProperty", defId: "p_studio" });
    expect(() => apply(c, { type: "buyProperty", defId: "p_studio" })).toThrow();
    expect(Object.values(c.s.properties).filter((x) => x.defId === "p_studio")).toHaveLength(1);
  });
});
