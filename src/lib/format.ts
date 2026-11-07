export function money(v: number, opts: { compact?: boolean; sign?: boolean } = {}) {
  const sign = opts.sign && v > 0 ? "+" : "";
  const abs = Math.abs(v);
  if (opts.compact !== false && abs >= 1e6) {
    const units: [number, string][] = [
      [1e15, "Q"],
      [1e12, "T"],
      [1e9, "B"],
      [1e6, "M"],
    ];
    for (const [u, s] of units)
      if (abs >= u) return `${sign}${v < 0 ? "-" : ""}$${(abs / u).toFixed(2)}${s}`;
  }
  const digits = abs < 10 ? 2 : abs < 1000 ? 2 : 0;
  return `${sign}${v < 0 ? "-" : ""}$${abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
export function price(v: number) {
  if (v >= 1000)
    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (v >= 1) return "$" + v.toFixed(2);
  return "$" + v.toPrecision(4);
}
export function num(v: number, d = 0) {
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
  return v.toLocaleString("en-US", { maximumFractionDigits: d });
}
export function pct(v: number, d = 1, sign = false) {
  return `${sign && v > 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;
}
export function duration(ms: number) {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}
export function ago(t: number, now: number) {
  return duration(now - t) + " ago";
}
export function date(t: number) {
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
