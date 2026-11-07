import { BALANCE } from "./config";
import { hashStr, mulberry, wave } from "./rng";

// ------------------------------------------------------------------ Stocks
export const SECTORS = [
  "Technology",
  "Finance",
  "Energy",
  "Healthcare",
  "Manufacturing",
  "Consumer Goods",
  "Retail",
  "Transportation",
  "Real Estate",
  "Mining",
  "Entertainment",
  "Utilities",
];

export type StockDef = {
  ticker: string;
  name: string;
  sector: string;
  base: number;
  vol: number; // daily-ish volatility
  drift: number; // annual drift
  shares: number; // outstanding
  authorized: number;
  treasury: number;
  dividendYield: number; // annual
  payoutRatio: number;
  revenue: number;
  margin: number;
  assets: number;
  liabilities: number;
  listedAt: number; // ms
  desc: string;
  generated?: boolean;
};

const EPOCH = Date.UTC(2026, 9, 1); // listing schedule epoch
const CURATED: Omit<StockDef, "listedAt">[] = [
  ["NOVA", "Nova Dynamics", "Technology", 182, 0.025, 0.12, 2.1e9, 0.012],
  ["QBIT", "Qubit Labs", "Technology", 64, 0.04, 0.2, 9e8, 0],
  ["MRDN", "Meridian Holdings", "Finance", 92, 0.015, 0.06, 1.4e9, 0.034],
  ["CRSC", "Crescent Bank", "Finance", 41, 0.018, 0.05, 2.6e9, 0.042],
  ["HELX", "Helix Energy", "Energy", 58, 0.022, 0.04, 1.8e9, 0.051],
  ["SOLR", "Solaris Renewables", "Energy", 27, 0.035, 0.15, 1.1e9, 0.008],
  ["VITA", "Vitalis Health", "Healthcare", 134, 0.017, 0.08, 1.3e9, 0.022],
  ["GENX", "GeneX Therapeutics", "Healthcare", 22, 0.05, 0.1, 6e8, 0],
  ["IRON", "Ironclad Industries", "Manufacturing", 76, 0.02, 0.05, 1.2e9, 0.028],
  ["PURE", "PureHome Brands", "Consumer Goods", 110, 0.012, 0.05, 1.6e9, 0.031],
  ["MRKT", "MarketSquare Retail", "Retail", 48, 0.02, 0.03, 1.9e9, 0.025],
  ["SWFT", "SwiftAir Transport", "Transportation", 35, 0.028, 0.04, 1e9, 0.012],
  ["URBN", "Urbana REIT", "Real Estate", 63, 0.014, 0.04, 1.5e9, 0.058],
  ["ORE", "Deepcore Mining", "Mining", 19, 0.033, 0.03, 2e9, 0.035],
  ["STAR", "Starlight Media", "Entertainment", 88, 0.026, 0.09, 1e9, 0.006],
  ["GRID", "Gridline Utilities", "Utilities", 52, 0.01, 0.03, 2.2e9, 0.047],
].map(([ticker, name, sector, base, vol, drift, shares, dy]) => {
  const s = Number(shares);
  return {
    ticker: ticker as string,
    name: name as string,
    sector: sector as string,
    base: base as number,
    vol: vol as number,
    drift: drift as number,
    shares: s,
    authorized: s * 1.5,
    treasury: s * 0.05,
    dividendYield: dy as number,
    payoutRatio: (dy as number) > 0 ? 0.4 + (dy as number) * 5 : 0,
    revenue: s * (base as number) * 0.35,
    margin: 0.08 + (hashStr(ticker as string) % 20) / 100,
    assets: s * (base as number) * 0.9,
    liabilities: s * (base as number) * 0.4,
    desc: `${name} is a ${(sector as string).toLowerCase()} company listed on the Tycoon Exchange.`,
  };
});

const PREFIX = [
  "Apex",
  "Blue",
  "Cobalt",
  "Delta",
  "Ember",
  "Falcon",
  "Granite",
  "Horizon",
  "Ionic",
  "Jade",
  "Kestrel",
  "Lumen",
  "Monarch",
  "Nimbus",
  "Onyx",
  "Pioneer",
  "Quartz",
  "Redwood",
  "Summit",
  "Titan",
  "Unity",
  "Vertex",
  "Willow",
  "Zenith",
];
const SUFFIX = [
  "Systems",
  "Group",
  "Industries",
  "Partners",
  "Works",
  "Corp",
  "Holdings",
  "Labs",
  "Networks",
  "Ventures",
];
const LISTING_EVERY_DAYS = 3;

function generatedStock(i: number): StockDef {
  const r = mulberry(hashStr("stock-list-" + i));
  const name = `${PREFIX[Math.floor(r() * PREFIX.length)]} ${SUFFIX[Math.floor(r() * SUFFIX.length)]}`;
  const sector = SECTORS[Math.floor(r() * SECTORS.length)];
  const base = Math.round((5 + r() * 120) * 100) / 100;
  const shares = Math.round((2 + r() * 15) * 1e8);
  const dy = r() < 0.5 ? 0 : Math.round(r() * 50) / 1000;
  return {
    ticker: name.replace(/[^A-Z]/g, "").slice(0, 3) + String.fromCharCode(65 + (i % 26)),
    name: `${name} ${i + 1}`,
    sector,
    base,
    vol: 0.02 + r() * 0.03,
    drift: -0.02 + r() * 0.15,
    shares,
    authorized: shares * 1.5,
    treasury: shares * 0.05,
    dividendYield: dy,
    payoutRatio: dy ? 0.5 : 0,
    revenue: shares * base * 0.3,
    margin: -0.05 + r() * 0.25,
    assets: shares * base * 0.8,
    liabilities: shares * base * 0.45,
    listedAt: EPOCH + (i + 1) * LISTING_EVERY_DAYS * 86400_000,
    desc: `Newly listed through the Tycoon Exchange IPO programme (listing event #${i + 1}).`,
    generated: true,
  };
}

export function listStocks(now: number): StockDef[] {
  const curated = CURATED.map((c) => ({ ...c, listedAt: EPOCH }));
  const n = Math.max(0, Math.floor((now - EPOCH) / (LISTING_EVERY_DAYS * 86400_000)));
  const gen: StockDef[] = [];
  const seen = new Set(curated.map((c) => c.ticker));
  for (let i = 0; i < Math.min(n, 60); i++) {
    const g = generatedStock(i);
    if (seen.has(g.ticker)) g.ticker = g.ticker + i;
    seen.add(g.ticker);
    gen.push(g);
  }
  return [...curated, ...gen];
}
export function upcomingStockListing(now: number) {
  const n = Math.floor((now - EPOCH) / (LISTING_EVERY_DAYS * 86400_000));
  return { at: EPOCH + (n + 1) * LISTING_EVERY_DAYS * 86400_000, name: generatedStock(n).name };
}

export const stockTick = (t: number) => Math.floor(t / (BALANCE.stockTickMin * 60_000));
export const stockTickTime = (k: number) => k * BALANCE.stockTickMin * 60_000;

function marketCondition(tick: number, perDay: number) {
  return wave(777, tick / perDay) * 0.08; // broad market cycle
}

export function stockPriceAtTick(s: StockDef, tick: number): number {
  const perDay = (24 * 60) / BALANCE.stockTickMin;
  const seed = hashStr(s.ticker);
  const years = (tick - stockTick(s.listedAt)) / (perDay * 365);
  const w = wave(seed, tick / 6) * s.vol * 6 + wave(seed ^ 99, tick / 60) * s.vol * 10;
  const sector = wave(hashStr(s.sector), tick / perDay) * 0.06;
  const p = s.base * Math.exp(s.drift * years + w + sector + marketCondition(tick, perDay));
  return Math.max(0.01, Math.round(p * 100) / 100);
}
export const stockPrice = (s: StockDef, t: number) => stockPriceAtTick(s, stockTick(t));
/** Shares available per tick on the exchange (liquidity, not price-impacting). */
export function stockLiquidity(s: StockDef, tick: number) {
  return Math.max(
    10,
    Math.floor(
      (s.shares * 0.00002 * (0.6 + 0.4 * (wave(hashStr(s.ticker) ^ 5, tick) + 1))) /
        (1 + s.vol * 10),
    ),
  );
}
export function stockProfitable(s: StockDef, day: number) {
  return s.margin + wave(hashStr(s.ticker) ^ 31, day) * 0.12 > 0;
}

// ------------------------------------------------------------------ Crypto
export type CryptoDef = {
  symbol: string;
  name: string;
  base: number;
  profile: "low" | "moderate" | "high" | "very high" | "extreme";
  supplyModel: "fixed" | "inflationary" | "burn";
  circulating: number;
  max: number | null;
  inflation: number; // annual
  burn: number; // annual
  listedAt: number;
  desc: string;
};
const VOL: Record<CryptoDef["profile"], number> = {
  low: 0.02,
  moderate: 0.04,
  high: 0.07,
  "very high": 0.1,
  extreme: 0.15,
};
const CRYPTO_CURATED: Omit<CryptoDef, "listedAt">[] = [
  {
    symbol: "BTX",
    name: "Bitex",
    base: 42_000,
    profile: "moderate",
    supplyModel: "fixed",
    circulating: 19.5e6,
    max: 21e6,
    inflation: 0.017,
    burn: 0,
    desc: "Store-of-value chain with a fixed supply.",
  },
  {
    symbol: "ETR",
    name: "Etheron",
    base: 2_400,
    profile: "high",
    supplyModel: "burn",
    circulating: 120e6,
    max: null,
    inflation: 0.01,
    burn: 0.012,
    desc: "Smart-contract platform with fee burning.",
  },
  {
    symbol: "SOLA",
    name: "Solara",
    base: 95,
    profile: "very high",
    supplyModel: "inflationary",
    circulating: 430e6,
    max: null,
    inflation: 0.05,
    burn: 0,
    desc: "High-throughput chain with inflationary rewards.",
  },
  {
    symbol: "STB",
    name: "StableBit",
    base: 1,
    profile: "low",
    supplyModel: "inflationary",
    circulating: 80e9,
    max: null,
    inflation: 0.1,
    burn: 0,
    desc: "Algorithmically managed low-volatility token.",
  },
  {
    symbol: "DOGO",
    name: "Dogo",
    base: 0.12,
    profile: "extreme",
    supplyModel: "inflationary",
    circulating: 140e9,
    max: null,
    inflation: 0.04,
    burn: 0,
    desc: "Meme token driven by sentiment.",
  },
  {
    symbol: "LNK",
    name: "Linkora",
    base: 14,
    profile: "high",
    supplyModel: "fixed",
    circulating: 550e6,
    max: 1e9,
    inflation: 0.03,
    burn: 0,
    desc: "Oracle network bridging off-chain data.",
  },
  {
    symbol: "AVX",
    name: "Avalux",
    base: 34,
    profile: "very high",
    supplyModel: "fixed",
    circulating: 370e6,
    max: 720e6,
    inflation: 0.04,
    burn: 0,
    desc: "Subnet platform for enterprise chains.",
  },
  {
    symbol: "FLR",
    name: "Flare Grid",
    base: 0.8,
    profile: "extreme",
    supplyModel: "burn",
    circulating: 2e9,
    max: 5e9,
    inflation: 0,
    burn: 0.02,
    desc: "Energy-trading token with scheduled burns.",
  },
];
const CPRE = [
  "Astra",
  "Byte",
  "Chrono",
  "Dash",
  "Echo",
  "Flux",
  "Glyph",
  "Hyper",
  "Ion",
  "Krypt",
  "Luna",
  "Mint",
  "Neo",
  "Orbit",
  "Pulse",
  "Rune",
  "Shard",
  "Terra",
  "Vox",
  "Zeta",
];
const CSUF = ["coin", "chain", "swap", "verse", "net", "fi", "x", "dao"];
function generatedCrypto(i: number): CryptoDef {
  const r = mulberry(hashStr("crypto-list-" + i));
  const name = CPRE[Math.floor(r() * CPRE.length)] + CSUF[Math.floor(r() * CSUF.length)];
  const profiles: CryptoDef["profile"][] = ["high", "very high", "extreme"];
  const model = (["fixed", "inflationary", "burn"] as const)[Math.floor(r() * 3)];
  const circ = Math.round((0.1 + r() * 10) * 1e8);
  return {
    symbol: (name.slice(0, 3) + String.fromCharCode(65 + (i % 26))).toUpperCase(),
    name: `${name}`,
    base: Math.round((0.05 + r() * 20) * 1000) / 1000,
    profile: profiles[Math.floor(r() * 3)],
    supplyModel: model,
    circulating: circ,
    max: model === "fixed" ? circ * 2 : null,
    inflation: model === "inflationary" ? 0.05 + r() * 0.1 : 0.02,
    burn: model === "burn" ? 0.02 + r() * 0.03 : 0,
    listedAt: EPOCH + (i + 1) * 7 * 86400_000,
    desc: `Listed via Crypto Launchpad event #${i + 1}.`,
  };
}
export function listCrypto(now: number): CryptoDef[] {
  const cur = CRYPTO_CURATED.map((c) => ({ ...c, listedAt: EPOCH }));
  const n = Math.max(0, Math.floor((now - EPOCH) / (7 * 86400_000)));
  const seen = new Set(cur.map((c) => c.symbol));
  const names = new Set(cur.map((c) => c.name));
  const gen: CryptoDef[] = [];
  for (let i = 0; i < Math.min(n, 40); i++) {
    const g = generatedCrypto(i);
    while (seen.has(g.symbol)) g.symbol += "X";
    if (names.has(g.name)) g.name += ` ${i + 1}`;
    seen.add(g.symbol);
    names.add(g.name);
    gen.push(g);
  }
  return [...cur, ...gen];
}
export const cryptoTick = (t: number) => Math.floor(t / (BALANCE.cryptoTickMin * 60_000));
export const cryptoTickTime = (k: number) => k * BALANCE.cryptoTickMin * 60_000;
export const CRYPTO_MIN_PRICE = 0.0001;
export function cryptoPriceAtTick(c: CryptoDef, tick: number): number {
  const seed = hashStr(c.symbol);
  const v = VOL[c.profile];
  const perDay = (24 * 60) / BALANCE.cryptoTickMin;
  const sentiment = wave(4242, tick / perDay) * 0.15;
  const w = wave(seed, tick / 4) * v * 4 + wave(seed ^ 7, tick / 90) * v * 12;
  const p = c.base * Math.exp(w + sentiment);
  return Math.max(CRYPTO_MIN_PRICE, Number(p.toPrecision(6)));
}
export const cryptoPrice = (c: CryptoDef, t: number) => cryptoPriceAtTick(c, cryptoTick(t));
export function cryptoSupply(c: CryptoDef, t: number) {
  const years = Math.max(0, (t - c.listedAt) / (365 * 86400_000));
  let circ = c.circulating * Math.pow(1 + c.inflation - c.burn, years);
  if (c.max) circ = Math.min(circ, c.max);
  const burned = c.circulating * c.burn * years;
  return { circulating: circ, burned, max: c.max };
}
export function cryptoLiquidity(c: CryptoDef, tick: number) {
  return c.circulating * 0.000002 * (0.5 + 0.5 * (wave(hashStr(c.symbol) ^ 3, tick) + 1));
}

/** Sample a price series between two times for charts. */
export function series(
  fn: (tick: number) => number,
  tickFn: (t: number) => number,
  tickTime: (k: number) => number,
  from: number,
  to: number,
  points = 60,
) {
  const a = tickFn(from);
  const b = tickFn(to);
  const step = Math.max(1, Math.floor((b - a) / points));
  const out: { t: number; v: number }[] = [];
  for (let k = a; k <= b; k += step) out.push({ t: tickTime(k), v: fn(k) });
  return out;
}
