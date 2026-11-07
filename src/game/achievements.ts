import { BALANCE } from "./config";

export const TIERS = ["Beginner", "Intermediate", "Advanced", "Expert", "Master"] as const;
export type StatKey =
  | "clicks"
  | "lifetimeEarned"
  | "companiesBought"
  | "companiesSold"
  | "branches"
  | "upgrades"
  | "hires"
  | "stockTrades"
  | "cryptoTrades"
  | "dividends"
  | "propertiesBought"
  | "rentEarned"
  | "collectiblesBought"
  | "collectionsDone"
  | "researchDone"
  | "level"
  | "netWorth"
  | "corpContributed"
  | "maintenance"
  | "clickerLevel";

export type AchievementDef = {
  id: string;
  name: string;
  category: string;
  sub: string;
  tier: (typeof TIERS)[number];
  stat: StatKey;
  target: number;
  reward: { cash: number; xp: number; rp: number };
  secret?: boolean;
  minLevel?: number;
  repeatable?: { growth: number };
};

const T: {
  stat: StatKey;
  cat: string;
  sub: string;
  title: string;
  unit: string;
  thresholds: number[];
  base: number;
}[] = [
  {
    stat: "clicks",
    cat: "Player Progression",
    sub: "Clicker",
    title: "Tapper",
    unit: "clicks",
    thresholds: [1e3, 2500, 5e3, 1e4, 25e3, 5e4, 1e5, 25e4, 5e5, 1e6, 25e5, 5e6, 1e7],
    base: 20,
  },
  {
    stat: "lifetimeEarned",
    cat: "Wealth & Net Worth",
    sub: "Earnings",
    title: "Earner",
    unit: "earned",
    thresholds: [100, 1e3, 1e4, 5e4, 1e5, 5e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11],
    base: 50,
  },
  {
    stat: "netWorth",
    cat: "Wealth & Net Worth",
    sub: "Net worth",
    title: "Net Worth",
    unit: "net worth",
    thresholds: [1e3, 1e4, 1e5, 1e6, 1e7, 5e7, 1e8, 1e9, 1e10, 1e11, 1e12],
    base: 100,
  },
  {
    stat: "companiesBought",
    cat: "Business Empire",
    sub: "Acquisitions",
    title: "Acquirer",
    unit: "companies bought",
    thresholds: [1, 2, 3, 5, 8, 12, 20, 30, 50, 75],
    base: 200,
  },
  {
    stat: "companiesSold",
    cat: "Business Empire",
    sub: "Exits",
    title: "Dealmaker",
    unit: "companies sold",
    thresholds: [1, 3, 5, 10, 20, 40],
    base: 300,
  },
  {
    stat: "branches",
    cat: "Business Empire",
    sub: "Branches",
    title: "Expansionist",
    unit: "branches opened",
    thresholds: [1, 3, 5, 10, 20, 35, 50, 80, 120, 200],
    base: 150,
  },
  {
    stat: "upgrades",
    cat: "Business Empire",
    sub: "Upgrades",
    title: "Optimizer",
    unit: "upgrades",
    thresholds: [1, 5, 10, 25, 50, 100, 150, 250, 400, 600],
    base: 120,
  },
  {
    stat: "hires",
    cat: "Business Empire",
    sub: "Workforce",
    title: "Employer",
    unit: "hires",
    thresholds: [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    base: 100,
  },
  {
    stat: "stockTrades",
    cat: "Investments",
    sub: "Stocks",
    title: "Stock Trader",
    unit: "stock trades",
    thresholds: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
    base: 120,
  },
  {
    stat: "cryptoTrades",
    cat: "Investments",
    sub: "Crypto",
    title: "Crypto Trader",
    unit: "crypto trades",
    thresholds: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
    base: 120,
  },
  {
    stat: "dividends",
    cat: "Investments",
    sub: "Dividends",
    title: "Dividend Collector",
    unit: "in dividends",
    thresholds: [1, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9],
    base: 150,
  },
  {
    stat: "propertiesBought",
    cat: "Real Estate",
    sub: "Acquisitions",
    title: "Landlord",
    unit: "properties bought",
    thresholds: [1, 2, 3, 5, 8, 12, 20, 30, 50],
    base: 200,
  },
  {
    stat: "rentEarned",
    cat: "Real Estate",
    sub: "Rental income",
    title: "Rent Collector",
    unit: "rent earned",
    thresholds: [100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9],
    base: 150,
  },
  {
    stat: "maintenance",
    cat: "Real Estate",
    sub: "Maintenance",
    title: "Caretaker",
    unit: "maintenance jobs",
    thresholds: [1, 5, 10, 25, 50, 100, 250],
    base: 100,
  },
  {
    stat: "collectiblesBought",
    cat: "Collectibles & Luxury Assets",
    sub: "Purchases",
    title: "Collector",
    unit: "items bought",
    thresholds: [1, 3, 5, 10, 20, 35, 50, 75, 100, 150, 200, 300, 500],
    base: 120,
  },
  {
    stat: "collectionsDone",
    cat: "Collectibles & Luxury Assets",
    sub: "Collections",
    title: "Curator",
    unit: "collections",
    thresholds: [1, 2, 3, 5, 8, 12, 16, 20, 25, 30],
    base: 400,
  },
  {
    stat: "researchDone",
    cat: "R&D",
    sub: "Projects",
    title: "Researcher",
    unit: "projects",
    thresholds: [1, 2, 3, 5, 7, 9, 11, 13, 15],
    base: 300,
  },
  {
    stat: "corpContributed",
    cat: "Special Milestones",
    sub: "Corporation",
    title: "Team Player",
    unit: "contributed",
    thresholds: [100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9],
    base: 200,
  },
];

function build(): AchievementDef[] {
  const out: AchievementDef[] = [];
  for (const t of T) {
    t.thresholds.forEach((th, i) => {
      const tier = TIERS[Math.min(4, Math.floor((i / t.thresholds.length) * 5))];
      const mult = BALANCE.achievementTierMult[tier];
      const R = BALANCE.achievementReward;
      const secret = i === t.thresholds.length - 1 && t.thresholds.length > 9;
      out.push({
        id: `${t.stat}-${i}`,
        name: `${t.title} ${toRoman(i + 1)}`,
        category: t.cat,
        sub: t.sub,
        tier,
        stat: t.stat,
        target: th,
        reward: {
          cash: Math.round(t.base * mult * Math.pow(R.cashGrowth, i)),
          xp: 0,
          rp: i >= 3 ? Math.round(R.rpBase * mult * i) : 0,
        },
        secret,
        minLevel: i >= 6 && !secret ? 5 : undefined,
      });
    });
  }
  // Repeatable achievements (progressively scaling, never decreasing)
  const rep: [StatKey, string, number, number][] = [
    ["clicks", "Click Marathon", 5000, 1.15],
    ["stockTrades", "Market Regular", 50, 1.2],
    ["cryptoTrades", "Degen Cycle", 50, 1.2],
    ["upgrades", "Kaizen", 25, 1.15],
    ["collectiblesBought", "Shopping Spree", 10, 1.2],
  ];
  for (const [stat, name, target, growth] of rep)
    out.push({
      id: `rep-${stat}`,
      name,
      category: "Special Milestones",
      sub: "Repeatable",
      tier: "Intermediate",
      stat,
      target,
      repeatable: { growth },
      reward: { cash: 500, xp: 0, rp: 10 },
    });
  return out;
}
function toRoman(n: number) {
  const m: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let s = "";
  for (const [v, r] of m)
    while (n >= v) {
      s += r;
      n -= v;
    }
  return s;
}
export const ACHIEVEMENTS = build();
export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export function repeatTarget(a: AchievementDef, cycle: number) {
  return Math.ceil(a.target * Math.pow(a.repeatable!.growth, cycle) * (cycle + 1));
}
