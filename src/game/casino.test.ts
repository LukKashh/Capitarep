import { describe, expect, it } from "vitest";
import { apply, newPlayer, type Ctx } from "./engine";
import { CASINO, EMPTY_MODS, PROPERTIES, PROPERTY_NET_BOOST } from "./config";
import { minesMultiplier } from "./casino";

const T0 = 1_700_000_000_000;
const ctx = (cash = 0): Ctx => {
  const s = newPlayer(T0, "t");
  s.cash = cash;
  return {
    s,
    now: T0,
    ledger: [],
    stock: [],
    corpMods: EMPTY_MODS,
    casinoSeed: "0123456789abcdef0123456789abcdef",
  } as Ctx;
};

describe("casino", () => {
  it("1 chip = $100, exchanged both ways with no fee", () => {
    const c = ctx(1000);
    apply(c, { type: "buyChips", chips: 10 });
    expect(c.ledger.find((l) => l.type === "chips_buy")!.amount).toBe(1000);
    expect(c.s.casino!.chips).toBe(10);
    apply(c, { type: "sellChips", chips: 10 });
    expect(c.ledger.find((l) => l.type === "chips_sell")!.amount).toBe(1000);
    expect(c.s.casino!.chips).toBe(0);
    expect(CASINO.chipValue).toBe(100);
  });
  it("cannot bet more chips than owned", () => {
    const c = ctx(100);
    apply(c, { type: "buyChips", chips: 1 });
    expect(() => apply(c, { type: "casinoKeno", bet: 2, picks: [1] })).toThrow();
  });
  it("roulette deducts the stake and pays a deterministic result", () => {
    const c = ctx(10_000);
    apply(c, { type: "buyChips", chips: 100 });
    apply(c, { type: "casinoRoulette", bets: [{ kind: "red", amount: 10 }] });
    const last = c.s.casino!.last!;
    expect([0, 20]).toContain(last.payout);
    expect(c.s.casino!.chips).toBe(90 + last.payout);
  });
  it("mines multiplier grows with each safe tile", () => {
    expect(minesMultiplier(3, 1)).toBeCloseTo((25 / 22) * 0.97, 6);
    expect(minesMultiplier(3, 2)).toBeGreaterThan(minesMultiplier(3, 1));
  });
});

describe("property returns", () => {
  it("default net return doubled from previous 1.5x boost (3x base)", () => {
    expect(PROPERTY_NET_BOOST).toBe(6);
    const studio = PROPERTIES.find((p) => p.id === "p_studio")!;
    expect(studio.rent - studio.expense).toBeCloseTo((22 - 5) * 6, 2);
  });
});
