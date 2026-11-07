/* eslint-disable @typescript-eslint/no-explicit-any */
// Casino: pure, server-authoritative game logic played with chips.
// Hidden outcomes (shuffles, mine positions, draws) come from a per-round seed
// that the server derives with a secret key and never stores, so nothing secret
// sits in the player's save while a round is open.
import { CASINO } from "./config";
import { GameError, type PlayerState } from "./types";

export type Card = { r: number; s: number }; // r 1..13 (A..K), s 0..3
export type CasinoActive =
  | {
      game: "blackjack";
      round: number;
      bet: number;
      player: Card[];
      dealer: Card[];
      drawn: number;
      doubled: boolean;
    }
  | { game: "mines"; round: number; bet: number; mines: number; revealed: number[] }
  | {
      game: "hilo";
      round: number;
      bet: number;
      card: Card;
      drawn: number;
      mult: number;
      history: Card[];
    };
export type CasinoResult = {
  game: string;
  bet: number;
  payout: number;
  at: number;
  detail: Record<string, any>;
};
export type CasinoState = {
  chips: number;
  round: number;
  active: CasinoActive | null;
  last: CasinoResult | null;
  stats: { wagered: number; won: number; rounds: number; biggestWin: number };
};

export type RouletteBet = {
  kind: "red" | "black" | "even" | "odd" | "low" | "high" | "dozen" | "column" | "straight";
  value?: number;
  amount: number;
};
export type CasinoAction =
  | { type: "casinoRoulette"; bets: RouletteBet[] }
  | { type: "casinoKeno"; bet: number; picks: number[] }
  | { type: "casinoBlackjack"; move: "start" | "hit" | "stand" | "double"; bet?: number }
  | {
      type: "casinoMines";
      move: "start" | "reveal" | "cashout";
      bet?: number;
      mines?: number;
      tile?: number;
    }
  | { type: "casinoHilo"; move: "start" | "higher" | "lower" | "cashout"; bet?: number };

export const CASINO_TYPES = new Set([
  "casinoRoulette",
  "casinoKeno",
  "casinoBlackjack",
  "casinoMines",
  "casinoHilo",
]);

export function casinoOf(s: PlayerState): CasinoState {
  if (!s.casino)
    s.casino = {
      chips: 0,
      round: 0,
      active: null,
      last: null,
      stats: { wagered: 0, won: 0, rounds: 0, biggestWin: 0 },
    };
  return s.casino;
}

// ---- seeded rng (sfc32 from a 128-bit hex seed)
export function rngFromHex(hex: string) {
  const w = [0, 1, 2, 3].map((i) => parseInt(hex.slice(i * 8, i * 8 + 8) || "9e3779b9", 16) >>> 0);
  let [a, b, c, d] = w as [number, number, number, number];
  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}
function shuffled<T>(arr: T[], rnd: () => number) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
const deck = (rnd: () => number) =>
  shuffled(
    Array.from({ length: 52 }, (_, i) => ({ r: (i % 13) + 1, s: Math.floor(i / 13) })),
    rnd,
  );
const c2 = (v: number) => Math.round(v * 100) / 100;

// ---- shared
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export function handValue(cards: Card[]) {
  let t = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.r === 1) {
      aces++;
      t += 11;
    } else t += Math.min(10, c.r);
  }
  while (t > 21 && aces) {
    t -= 10;
    aces--;
  }
  return { total: t, soft: aces > 0 };
}
export function minesMultiplier(mines: number, safe: number) {
  let m = 1;
  for (let i = 0; i < safe; i++) m *= (25 - i) / (25 - mines - i);
  return safe === 0 ? 1 : m * (1 - CASINO.houseEdge);
}
export function hiloOdds(r: number) {
  return { higher: (14 - r) / 13, lower: r / 13 };
}
export const hiloStepMult = (p: number) => (1 - CASINO.houseEdge) / p;

function stake(cs: CasinoState, bet: number) {
  if (!Number.isFinite(bet) || bet < CASINO.minBet)
    throw new GameError(`Minimum bet is ${CASINO.minBet} chip`);
  if (bet > CASINO.maxBet)
    throw new GameError(`Maximum bet is ${CASINO.maxBet.toLocaleString()} chips`);
  const b = c2(bet);
  if (cs.chips + 1e-9 < b) throw new GameError("Not enough chips");
  cs.chips = c2(cs.chips - b);
  cs.stats.wagered += b;
  return b;
}
function settle(
  cs: CasinoState,
  now: number,
  game: string,
  bet: number,
  payout: number,
  detail: Record<string, any>,
) {
  const p = c2(Math.max(0, payout));
  cs.chips = c2(cs.chips + p);
  cs.stats.won += p;
  cs.stats.rounds += 1;
  if (p - bet > cs.stats.biggestWin) cs.stats.biggestWin = c2(p - bet);
  cs.last = { game, bet, payout: p, at: now, detail };
  cs.active = null;
  cs.round += 1;
}

/** `seedHex` is the secret per-round seed for `casino.round`. */
export function applyCasino(s: PlayerState, a: CasinoAction, seedHex: string, now: number) {
  const cs = casinoOf(s);
  const rnd = rngFromHex(seedHex);
  const busy = (g: string) => {
    if (cs.active && cs.active.game !== g) throw new GameError("Finish your current game first");
  };

  switch (a.type) {
    case "casinoRoulette": {
      busy("roulette");
      if (cs.active) throw new GameError("Finish your current game first");
      if (!Array.isArray(a.bets) || !a.bets.length || a.bets.length > 40)
        throw new GameError("Place at least one bet");
      const total = a.bets.reduce((t, b) => t + (Number(b.amount) || 0), 0);
      for (const b of a.bets)
        if (!(b.amount >= CASINO.minBet)) throw new GameError("Each bet needs at least 1 chip");
      const bet = stake(cs, total);
      const n = Math.floor(rnd() * 37);
      let payout = 0;
      for (const b of a.bets) {
        const v = b.value ?? 0;
        const hit =
          b.kind === "straight"
            ? n === v
            : n === 0
              ? false
              : b.kind === "red"
                ? RED.has(n)
                : b.kind === "black"
                  ? !RED.has(n)
                  : b.kind === "even"
                    ? n % 2 === 0
                    : b.kind === "odd"
                      ? n % 2 === 1
                      : b.kind === "low"
                        ? n <= 18
                        : b.kind === "high"
                          ? n >= 19
                          : b.kind === "dozen"
                            ? Math.ceil(n / 12) === v
                            : b.kind === "column"
                              ? ((n - 1) % 3) + 1 === v
                              : false;
        if (b.kind === "straight" && (v < 0 || v > 36 || !Number.isInteger(v)))
          throw new GameError("Invalid number");
        if ((b.kind === "dozen" || b.kind === "column") && ![1, 2, 3].includes(v))
          throw new GameError("Invalid bet");
        const odds = b.kind === "straight" ? 35 : b.kind === "dozen" || b.kind === "column" ? 2 : 1;
        if (hit) payout += b.amount * (odds + 1);
      }
      settle(cs, now, "roulette", bet, payout, { number: n });
      break;
    }
    case "casinoKeno": {
      if (cs.active) throw new GameError("Finish your current game first");
      const picks = [...new Set(a.picks)].filter((x) => Number.isInteger(x) && x >= 1 && x <= 80);
      if (picks.length < 1 || picks.length > 10 || picks.length !== a.picks.length)
        throw new GameError("Pick 1 to 10 numbers");
      const bet = stake(cs, a.bet);
      const draw = shuffled(
        Array.from({ length: 80 }, (_, i) => i + 1),
        rnd,
      ).slice(0, 20);
      const hits = picks.filter((x) => draw.includes(x)).length;
      const mult = CASINO.kenoPay[picks.length]![hits] ?? 0;
      settle(cs, now, "keno", bet, bet * mult, { draw, picks, hits, mult });
      break;
    }
    case "casinoBlackjack": {
      busy("blackjack");
      const d = deck(rnd);
      if (a.move === "start") {
        if (cs.active) throw new GameError("Hand already in progress");
        const bet = stake(cs, a.bet ?? 0);
        const st: Extract<CasinoActive, { game: "blackjack" }> = {
          game: "blackjack",
          round: cs.round,
          bet,
          player: [d[0]!, d[2]!],
          dealer: [d[1]!],
          drawn: 4,
          doubled: false,
        };
        cs.active = st;
        const pv = handValue(st.player).total;
        const dv = handValue([d[1]!, d[3]!]).total;
        if (pv === 21 || dv === 21) finishBj(cs, st, d, now);
        break;
      }
      const st = cs.active;
      if (!st || st.game !== "blackjack") throw new GameError("No hand in progress");
      if (a.move === "hit") {
        st.player.push(d[st.drawn++]!);
        if (handValue(st.player).total >= 21) finishBj(cs, st, d, now);
      } else if (a.move === "double") {
        if (st.player.length !== 2)
          throw new GameError("You can only double on your first two cards");
        stake(cs, st.bet);
        st.bet *= 2;
        st.doubled = true;
        st.player.push(d[st.drawn++]!);
        finishBj(cs, st, d, now);
      } else finishBj(cs, st, d, now);
      break;
    }
    case "casinoMines": {
      busy("mines");
      if (a.move === "start") {
        if (cs.active) throw new GameError("Game already in progress");
        const mines = Math.floor(a.mines ?? 3);
        if (mines < 1 || mines > 24) throw new GameError("Choose 1 to 24 mines");
        const bet = stake(cs, a.bet ?? 0);
        cs.active = { game: "mines", round: cs.round, bet, mines, revealed: [] };
        break;
      }
      const st = cs.active;
      if (!st || st.game !== "mines") throw new GameError("No game in progress");
      const field = shuffled(
        Array.from({ length: 25 }, (_, i) => i),
        rnd,
      ).slice(0, st.mines);
      if (a.move === "cashout") {
        if (!st.revealed.length) throw new GameError("Reveal at least one tile first");
        settle(cs, now, "mines", st.bet, st.bet * minesMultiplier(st.mines, st.revealed.length), {
          mines: field,
          revealed: st.revealed,
          boom: false,
        });
        break;
      }
      const t = Math.floor(a.tile ?? -1);
      if (t < 0 || t > 24 || st.revealed.includes(t)) throw new GameError("Invalid tile");
      if (field.includes(t)) {
        settle(cs, now, "mines", st.bet, 0, {
          mines: field,
          revealed: st.revealed,
          boom: true,
          hit: t,
        });
        break;
      }
      st.revealed.push(t);
      if (st.revealed.length === 25 - st.mines)
        settle(cs, now, "mines", st.bet, st.bet * minesMultiplier(st.mines, st.revealed.length), {
          mines: field,
          revealed: st.revealed,
          boom: false,
        });
      break;
    }
    case "casinoHilo": {
      busy("hilo");
      const d = deck(rnd);
      // Infinite-deck style: card i is d[i % 52] of a fresh shuffle per round.
      const at = (i: number) => d[i % 52]!;
      if (a.move === "start") {
        if (cs.active) throw new GameError("Game already in progress");
        const bet = stake(cs, a.bet ?? 0);
        cs.active = {
          game: "hilo",
          round: cs.round,
          bet,
          card: at(0),
          drawn: 1,
          mult: 1,
          history: [at(0)],
        };
        break;
      }
      const st = cs.active;
      if (!st || st.game !== "hilo") throw new GameError("No game in progress");
      if (a.move === "cashout") {
        if (st.mult <= 1) throw new GameError("Make at least one correct guess first");
        settle(cs, now, "hilo", st.bet, st.bet * st.mult, { history: st.history, won: true });
        break;
      }
      const odds = hiloOdds(st.card.r);
      const p = a.move === "higher" ? odds.higher : odds.lower;
      const next = at(st.drawn++);
      const ok = a.move === "higher" ? next.r >= st.card.r : next.r <= st.card.r;
      st.history.push(next);
      if (!ok) {
        settle(cs, now, "hilo", st.bet, 0, { history: st.history, won: false });
        break;
      }
      st.mult = Math.round(st.mult * hiloStepMult(p) * 10000) / 10000;
      st.card = next;
      if (st.mult >= CASINO.hiloMaxMult)
        settle(cs, now, "hilo", st.bet, st.bet * CASINO.hiloMaxMult, {
          history: st.history,
          won: true,
        });
      break;
    }
  }
}

function finishBj(
  cs: CasinoState,
  st: Extract<CasinoActive, { game: "blackjack" }>,
  d: Card[],
  now: number,
) {
  const hole = d[3]!;
  const dealer = [st.dealer[0]!, hole];
  const pv = handValue(st.player).total;
  const natural = st.player.length === 2 && pv === 21;
  const dNatural = handValue(dealer).total === 21;
  let i = st.drawn;
  if (pv <= 21 && !natural) {
    while (true) {
      const h = handValue(dealer);
      if (h.total > 17 || h.total === 17) break;
      dealer.push(d[i++]!);
    }
  }
  const dv = handValue(dealer).total;
  let payout = 0;
  let outcome: string;
  if (pv > 21) outcome = "bust";
  else if (natural && !dNatural) {
    payout = st.bet * 2.5;
    outcome = "blackjack";
  } else if (dNatural && !natural) outcome = "dealer blackjack";
  else if (dv > 21 || pv > dv) {
    payout = st.bet * 2;
    outcome = "win";
  } else if (pv === dv) {
    payout = st.bet;
    outcome = "push";
  } else outcome = "lose";
  settle(cs, now, "blackjack", st.bet, payout, { player: st.player, dealer, outcome, pv, dv });
}
