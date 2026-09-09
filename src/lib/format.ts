/** Wei string -> MON as a JS number (precision loss above 2^53 wei is irrelevant for display). */
export function toMon(wei: string | bigint): number {
  const v = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  return Number(v / 10n ** 12n) / 1e6;
}

export function fmtMon(wei: string | bigint, digits = 0): string {
  return fmtNum(toMon(wei), digits);
}

export function fmtNum(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "–";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(n % 1 === 0 ? 0 : 2);
}

/** Commission is stored as an 18-decimal fraction (0.15e18 = 15 %). */
export function commissionPct(wei: string): number {
  return toMon(wei) * 100;
}

export function fmtPct(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "–";
  return v.toFixed(digits) + "%";
}

export function shortAddr(a: string, n = 6): string {
  if (!a || a.length < 2 * n + 2) return a;
  return `${a.slice(0, n + 2)}…${a.slice(-n)}`;
}

export function shortHex(h: string, n = 8): string {
  if (!h) return "";
  return h.length > 2 * n + 2 ? `${h.slice(0, n + 2)}…${h.slice(-n)}` : h;
}

export function timeAgo(unixSeconds: number, now = Date.now() / 1000): string {
  const s = Math.max(0, Math.floor(now - unixSeconds));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ago`;
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

export function fmtDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function isAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}
