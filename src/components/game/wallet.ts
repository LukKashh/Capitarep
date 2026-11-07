import type { OwnedCompany, PlayerState } from "@/game/types";

/** Display refresh for temporary wallets (ms). Display-only; the server stays authoritative. */
export const WALLET_REFRESH_MS = 250;

/** Live estimate of a company's business wallet: stored amount plus accrual since the last server tick, at exactly the hourly net rate. */
export function liveCompanyWallet(
  o: OwnedCompany,
  netPerHour: number,
  lastTick: number,
  now: number,
) {
  const hours = Math.max(0, now - lastTick) / 3600_000;
  let net = netPerHour * hours;
  if (net > 0 && o.liabilities > 0) net -= Math.min(o.liabilities, net * 0.25);
  return Math.max(0, o.uncollected + net);
}

/** Live estimate of a property's rent wallet at exactly the hourly net rent. */
export function liveRentWallet(
  pr: PlayerState["properties"][string],
  netPerHour: number,
  lastTick: number,
  now: number,
) {
  const hours = Math.min(24, Math.max(0, now - lastTick) / 3600_000);
  return Math.max(0, (pr.uncollected ?? 0) + netPerHour * hours);
}
