import Link from "next/link";
import type { ValidatorStatus } from "@/lib/model";

export function Stat({ label, value, sub, mono = true }: { label: string; value: React.ReactNode; sub?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${mono ? "num" : ""}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

const STATUS: Record<ValidatorStatus, { label: string; cls: string; title: string }> = {
  active: { label: "active", cls: "bg-ok/15 text-ok", title: "In the consensus set and in the snapshot for the next epoch" },
  joining: { label: "joining", cls: "bg-info/15 text-info", title: "In the snapshot set: becomes active next epoch" },
  leaving: { label: "leaving", cls: "bg-warn/15 text-warn", title: "Active now but not in the snapshot: drops out next epoch" },
  candidate: { label: "candidate", cls: "bg-panel-2 text-muted", title: "Registered with stake but outside the top 200" },
  inactive: { label: "inactive", cls: "bg-panel-2 text-muted", title: "Registered but in no validator set: total stake below 10M MON, or the auth address holds less than the 100k MON self-delegation minimum" },
};

export function StatusBadge({ status }: { status: ValidatorStatus }) {
  const s = STATUS[status];
  return (
    <span title={s.title} className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function PerfBar({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <span className="text-muted">–</span>;
  const pct = Math.min(150, ratio * 100);
  const color = ratio >= 0.9 ? "bg-ok" : ratio >= 0.6 ? "bg-warn" : "bg-bad";
  return (
    <span className="inline-flex items-center gap-2" title={`${(ratio * 100).toFixed(0)}% of the blocks expected from stake share`}>
      <span className="inline-block h-2 w-20 rounded bg-panel-2 overflow-hidden">
        <span className={`block h-full ${color}`} style={{ width: `${Math.min(100, pct / 1.5)}%` }} />
      </span>
      <span className="num text-xs">{(ratio * 100).toFixed(0)}%</span>
    </span>
  );
}

export function ValidatorName({
  network,
  id,
  name,
  logo,
  link = true,
}: {
  network: string;
  id: number;
  name: string | null;
  logo?: string | null;
  link?: boolean;
}) {
  const inner = (
    <span className="inline-flex items-center gap-2 min-w-0">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-6 w-6 rounded-full bg-panel-2 object-cover shrink-0" loading="lazy" />
      ) : (
        <span className="h-6 w-6 rounded-full bg-panel-2 shrink-0 inline-flex items-center justify-center text-[10px] text-muted">{id}</span>
      )}
      <span className="truncate">
        <span className="font-medium">{name ?? `Validator #${id}`}</span>
        {name ? <span className="ml-1.5 text-xs text-muted">#{id}</span> : null}
      </span>
    </span>
  );
  return link ? (
    <Link href={`/${network}/validator/${id}`} className="hover:text-accent-2">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function Sparkline({ points, expected, height = 48 }: { points: number[]; expected?: number[]; height?: number }) {
  if (points.length === 0) return null;
  const w = 320;
  const max = Math.max(1, ...points, ...(expected ?? []));
  const step = w / points.length;
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`).join(" ");
  const exp = expected
    ? expected.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`).join(" ")
    : null;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden>
      {exp ? <path d={exp} fill="none" stroke="var(--muted)" strokeDasharray="3 3" strokeWidth="1" /> : null}
      <path d={path} fill="none" stroke="var(--accent-2)" strokeWidth="1.5" />
    </svg>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card px-4 py-8 text-center text-sm text-muted">{children}</div>;
}

export function Footer() {
  return (
    <footer className="mt-12 border-t border-line py-6 text-xs text-muted">
      <div className="mx-auto max-w-7xl px-4 flex flex-wrap gap-x-6 gap-y-2">
        <span>Data read live from the Monad staking precompile through public RPC; block-production history collected every 10 minutes.</span>
        <a className="hover:text-fg" href="https://github.com/Gabbe-x/monad-validators">Source on GitHub</a>
        <a className="hover:text-fg" href="https://github.com/monad-developers/validator-info">Validator registry</a>
        <a className="hover:text-fg" href="https://docs.monad.xyz/developer-essentials/staking/staking-precompile">Staking docs</a>
      </div>
    </footer>
  );
}
