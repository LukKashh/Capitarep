import { GlobalMods } from "./config";
import { hashStr, mulberry, wave } from "./rng";

export const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical"] as const;
export type Rarity = (typeof RARITIES)[number];
export const RARITY_DIST: Record<Rarity, number> = {
  Common: 0.42,
  Uncommon: 0.27,
  Rare: 0.16,
  Epic: 0.09,
  Legendary: 0.045,
  Mythical: 0.015,
};
const RARITY_MULT: Record<Rarity, number> = {
  Common: 1,
  Uncommon: 3,
  Rare: 10,
  Epic: 40,
  Legendary: 200,
  Mythical: 1500,
};
export const RESALE_PCT: Record<Rarity, number> = {
  Common: 0.7,
  Uncommon: 0.72,
  Rare: 0.75,
  Epic: 0.78,
  Legendary: 0.8,
  Mythical: 0.85,
};
export const HOLD_HOURS: Record<Rarity, number> = {
  Common: 1,
  Uncommon: 3,
  Rare: 6,
  Epic: 12,
  Legendary: 24,
  Mythical: 72,
};

type CatDef = {
  id: string;
  name: string;
  base: number;
  count: number;
  updateHours: number;
  volatility: number;
  bonus: keyof GlobalMods | null;
  bonusScale: number;
  subs: string[];
  words: string[];
};
export const CATEGORIES: CatDef[] = [
  {
    id: "vehicles",
    name: "Vehicles",
    base: 20_000,
    count: 45,
    updateHours: 6,
    volatility: 0.12,
    bonus: "businessPct",
    bonusScale: 0.004,
    subs: ["Sports car", "Classic", "SUV", "Supercar"],
    words: [
      "Viper",
      "Comet",
      "Stallion",
      "Phantom",
      "Raptor",
      "Aurora",
      "Vortex",
      "Monza",
      "Spectre",
      "Tempest",
      "Mirage",
      "Nomad",
      "Bolt",
      "Corsair",
      "Duke",
    ],
  },
  {
    id: "aircraft",
    name: "Aircraft",
    base: 400_000,
    count: 20,
    updateHours: 12,
    volatility: 0.1,
    bonus: "offlineHours",
    bonusScale: 0.25,
    subs: ["Light jet", "Helicopter", "Business jet"],
    words: [
      "Skyhawk",
      "Albatross",
      "Condor",
      "Swift",
      "Gulf",
      "Falcon",
      "Heron",
      "Osprey",
      "Zephyr",
      "Kite",
    ],
  },
  {
    id: "yachts",
    name: "Yachts",
    base: 900_000,
    count: 20,
    updateHours: 12,
    volatility: 0.1,
    bonus: "rentPct",
    bonusScale: 0.005,
    subs: ["Sailing yacht", "Motor yacht", "Superyacht"],
    words: [
      "Serenity",
      "Odyssey",
      "Poseidon",
      "Marlin",
      "Coral",
      "Neptune",
      "Siren",
      "Tide",
      "Atlantis",
      "Breeze",
    ],
  },
  {
    id: "watches",
    name: "Watches",
    base: 5_000,
    count: 40,
    updateHours: 6,
    volatility: 0.08,
    bonus: "clickPct",
    bonusScale: 0.005,
    subs: ["Dress", "Diver", "Chronograph", "Tourbillon"],
    words: [
      "Regent",
      "Oyster",
      "Meridian",
      "Calibre",
      "Heritage",
      "Admiral",
      "Equinox",
      "Sovereign",
      "Orbit",
      "Pilot",
    ],
  },
  {
    id: "paintings",
    name: "Paintings",
    base: 15_000,
    count: 40,
    updateHours: 24,
    volatility: 0.15,
    bonus: "xpPct",
    bonusScale: 0.004,
    subs: ["Impressionist", "Modern", "Renaissance", "Abstract"],
    words: [
      "Twilight",
      "Harbor",
      "Garden",
      "Portrait",
      "Storm",
      "Reverie",
      "Lilies",
      "Mountains",
      "Nocturne",
      "Bloom",
    ],
  },
  {
    id: "stamps",
    name: "Stamps",
    base: 500,
    count: 35,
    updateHours: 24,
    volatility: 0.06,
    bonus: "rpPct",
    bonusScale: 0.006,
    subs: ["Victorian", "Airmail", "Error print"],
    words: [
      "Penny",
      "Blue",
      "Crown",
      "Eagle",
      "Jubilee",
      "Post",
      "Inverted",
      "Empire",
      "Liberty",
      "Rose",
    ],
  },
  {
    id: "antiques",
    name: "Antiques",
    base: 3_000,
    count: 30,
    updateHours: 24,
    volatility: 0.07,
    bonus: "rentPct",
    bonusScale: 0.004,
    subs: ["Furniture", "Porcelain", "Clock"],
    words: [
      "Ming",
      "Louis",
      "Regency",
      "Baroque",
      "Tudor",
      "Georgian",
      "Rococo",
      "Empire",
      "Gothic",
      "Victorian",
    ],
  },
  {
    id: "jewelry",
    name: "Jewelry",
    base: 8_000,
    count: 30,
    updateHours: 12,
    volatility: 0.07,
    bonus: "feeCut",
    bonusScale: 0.01,
    subs: ["Ring", "Necklace", "Tiara"],
    words: [
      "Starlight",
      "Royal",
      "Empress",
      "Solitaire",
      "Halo",
      "Cascade",
      "Aurora",
      "Duchess",
      "Eternity",
      "Celeste",
    ],
  },
  {
    id: "nfts",
    name: "NFTs",
    base: 1_000,
    count: 25,
    updateHours: 3,
    volatility: 0.3,
    bonus: "clickPct",
    bonusScale: 0.004,
    subs: ["Generative", "Pixel art", "3D"],
    words: ["Ape", "Punk", "Glitch", "Voxel", "Cyber", "Neon", "Meme", "Pixel", "Void", "Drift"],
  },
  {
    id: "luxprop",
    name: "Luxury Properties",
    base: 2_000_000,
    count: 15,
    updateHours: 24,
    volatility: 0.05,
    bonus: "businessPct",
    bonusScale: 0.006,
    subs: ["Château", "Island", "Ranch"],
    words: [
      "Bellevue",
      "Montclair",
      "Silverlake",
      "Rosewood",
      "Eden",
      "Highcliff",
      "Lakeshore",
      "Avalon",
      "Crestview",
      "Ivory",
    ],
  },
];
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export type CollectibleDef = {
  id: string;
  name: string;
  category: string;
  sub: string;
  rarity: Rarity;
  price: number;
  baseValue: number;
  limited: number | null; // global max copies
  releaseAt: number | null;
  restrictedResale: boolean;
  bonus: { key: keyof GlobalMods; value: number } | null;
};

const RELEASE_EPOCH = Date.UTC(2026, 10, 1);
function pickRarity(x: number): Rarity {
  let acc = 0;
  for (const r of RARITIES) {
    acc += RARITY_DIST[r];
    if (x < acc) return r;
  }
  return "Common";
}

function build(): CollectibleDef[] {
  const out: CollectibleDef[] = [];
  let limitedIdx = 0;
  for (const cat of CATEGORIES) {
    const r = mulberry(hashStr("cat-" + cat.id));
    for (let i = 0; i < cat.count; i++) {
      const rarity = pickRarity(r());
      const sub = cat.subs[i % cat.subs.length];
      const word = cat.words[i % cat.words.length];
      const series = Math.floor(i / cat.words.length) + 1;
      const value = Math.round(cat.base * RARITY_MULT[rarity] * (0.7 + r() * 0.6));
      const limited = rarity === "Legendary" || rarity === "Mythical" || r() < 0.06;
      const bonusIdx = ["Common", "Uncommon"].includes(rarity) ? 0 : RARITIES.indexOf(rarity);
      out.push({
        id: `${cat.id}-${String(i + 1).padStart(3, "0")}`,
        name: `${word} ${sub}${series > 1 ? ` S${series}` : ""}`,
        category: cat.id,
        sub,
        rarity,
        price: Math.round(value * 1.05),
        baseValue: value,
        limited: limited ? Math.max(1, Math.round(500 / RARITY_MULT[rarity]) + 3) : null,
        releaseAt: limited ? RELEASE_EPOCH + limitedIdx++ * 12 * 3600_000 : null,
        restrictedResale: rarity === "Mythical",
        bonus:
          cat.bonus && bonusIdx > 0
            ? { key: cat.bonus, value: Number((cat.bonusScale * bonusIdx).toFixed(4)) }
            : null,
      });
    }
  }
  return out;
}
export const COLLECTIBLES = build(); // 300 items
export const COLLECTIBLE_BY_ID = Object.fromEntries(COLLECTIBLES.map((c) => [c.id, c]));

export function valueMultiplier(item: CollectibleDef, t: number) {
  const cat = CATEGORY_BY_ID[item.category];
  const k = Math.floor(t / (cat.updateHours * 3600_000));
  const rarityBoost = RARITIES.indexOf(item.rarity) * 0.01;
  const w =
    wave(hashStr(item.id), k / 3) * cat.volatility +
    wave(hashStr(cat.id), k / 10) * cat.volatility * 0.5;
  return Math.max(0.2, 1 + w + rarityBoost + (item.limited ? 0.05 : 0));
}
export const currentValue = (item: CollectibleDef, t: number) =>
  Math.round(item.baseValue * valueMultiplier(item, t));
export function demandLabel(item: CollectibleDef, t: number) {
  const d = wave(hashStr(item.id) ^ 11, t / 86400_000);
  return d > 0.3 ? "High" : d < -0.3 ? "Low" : "Moderate";
}
export function valueSeries(item: CollectibleDef, from: number, to: number, points = 60) {
  const cat = CATEGORY_BY_ID[item.category];
  const step = Math.max(cat.updateHours * 3600_000, (to - from) / points);
  const out: { t: number; v: number }[] = [];
  for (let t = from; t <= to; t += step) out.push({ t, v: currentValue(item, t) });
  return out;
}

// Collections: themed sets of specific items + category starter sets
export type CollectionDef = {
  id: string;
  name: string;
  items: string[];
  reward: { cash: number; xp: number };
  bonus: { key: keyof GlobalMods; value: number };
};
function buildCollections(): CollectionDef[] {
  const out: CollectionDef[] = [];
  for (const cat of CATEGORIES) {
    const items = COLLECTIBLES.filter((c) => c.category === cat.id);
    const commons = items.filter((c) => c.rarity === "Common").slice(0, 4);
    if (commons.length >= 3)
      out.push({
        id: `col-${cat.id}-starter`,
        name: `${cat.name} Starter Set`,
        items: commons.map((c) => c.id),
        reward: { cash: Math.round(cat.base * 0.5), xp: 200 },
        bonus: { key: cat.bonus ?? "xpPct", value: 0.01 },
      });
    const subs = cat.subs;
    for (const sub of subs) {
      const set = items.filter((c) => c.sub === sub).slice(0, 5);
      if (set.length >= 4)
        out.push({
          id: `col-${cat.id}-${sub.toLowerCase().replace(/\W+/g, "-")}`,
          name: `${sub} Collection`,
          items: set.map((c) => c.id),
          reward: { cash: Math.round(cat.base * 3), xp: 600 },
          bonus: { key: cat.bonus ?? "xpPct", value: 0.015 },
        });
    }
  }
  // cross-category themed
  const legend = COLLECTIBLES.filter((c) => c.rarity === "Legendary").slice(0, 6);
  out.push({
    id: "col-legends",
    name: "Hall of Legends",
    items: legend.map((c) => c.id),
    reward: { cash: 5_000_000, xp: 5_000 },
    bonus: { key: "businessPct", value: 0.03 },
  });
  return out;
}
export const COLLECTIONS = buildCollections();
