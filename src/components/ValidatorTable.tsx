"use client";

import { useMemo, useState } from "react";
import type { ValidatorRow } from "@/lib/model";
import { fmtCompact, fmtNum, fmtPct, shortAddr } from "@/lib/format";
import { PerfBar, StatusBadge, ValidatorName } from "./ui";

type SortKey = "rank" | "name" | "stake" | "share" | "commission" | "blocks24h" | "performance";
type Filter = "all" | "active" | "joining" | "leaving" | "candidate" | "inactive";

export function ValidatorTable({
  network,
  rows,
  initialQuery = "",
  historyAvailable,
}: {
  network: string;
  rows: ValidatorRow[];
  initialQuery?: string;
  historyAvailable: boolean;
}) {
  const [q, setQ] = useState(initialQuery);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });

  const ranked = useMemo(() => rows.map((r, i) => ({ ...r, rank: i + 1 })), [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = ranked.filter((r) => {
      if (filter === "active" && !r.inConsensus) return false;
      if (filter !== "all" && filter !== "active" && r.status !== filter) return false;
      if (!needle) return true;
      return (
        String(r.id) === needle ||
        (r.name ?? "").toLowerCase().includes(needle) ||
        r.authAddress.toLowerCase().includes(needle)
      );
    });
    const dir = sort.dir;
    const val = (r: (typeof ranked)[number]): number | string => {
      switch (sort.key) {
        case "rank":
          return r.rank;
        case "name":
          return (r.name ?? `zzz${r.id}`).toLowerCase();
        case "stake":
          return r.inConsensus ? r.consensusStake : r.stake;
        case "share":
          return r.stakeShare;
        case "commission":
          return r.commission;
        case "blocks24h":
          return r.blocks24h ?? -1;
        case "performance":
          return r.performance ?? -1;
      }
    };
    list = [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return a.rank - b.rank;
    });
    return list;
  }, [ranked, q, filter, sort]);

  function th(key: SortKey, label: string, cls = "") {
    const active = sort.key === key;
    return (
      <th
        className={`sortable ${cls}`}
        onClick={() => setSort({ key, dir: active ? ((sort.dir * -1) as 1 | -1) : key === "rank" || key === "name" ? 1 : -1 })}
      >
        {label}
        {active ? <span className="ml-1 text-accent-2">{sort.dir === 1 ? "▲" : "▼"}</span> : null}
      </th>
    );
  }

  const filters: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: rows.length },
    { key: "active", label: "Active", n: rows.filter((r) => r.inConsensus).length },
    { key: "joining", label: "Joining", n: rows.filter((r) => r.status === "joining").length },
    { key: "leaving", label: "Leaving", n: rows.filter((r) => r.status === "leaving").length },
    { key: "candidate", label: "Candidates", n: rows.filter((r) => r.status === "candidate").length },
    { key: "inactive", label: "Inactive", n: rows.filter((r) => r.status === "inactive").length },
  ];

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex flex-wrap gap-1 text-sm">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-2.5 py-1 ${filter === f.key ? "bg-accent/20 text-accent-2" : "text-muted hover:bg-panel-2 hover:text-fg"}`}
            >
              {f.label} <span className="num opacity-70">{f.n}</span>
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name, id or auth address"
          className="ml-auto w-full sm:w-72 rounded-md border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {th("rank", "#")}
              {th("name", "Validator")}
              <th>Status</th>
              {th("stake", "Stake (MON)", "text-right")}
              {th("share", "Share", "text-right")}
              {th("commission", "Commission", "text-right")}
              {th("blocks24h", "Blocks 24h", "text-right")}
              {th("performance", "vs expected")}
              <th>Auth address</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td className="num text-muted">{r.rank}</td>
                <td className="max-w-[260px]">
                  <ValidatorName network={network} id={r.id} name={r.name} logo={r.logo} />
                  {r.vdp ? <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent-2" title="Validator Delegation Program">VDP</span> : null}
                  {r.flags !== "0" ? <span className="ml-2 rounded bg-bad/15 px-1.5 py-0.5 text-[10px] text-bad" title={`flags = ${r.flags}`}>flagged</span> : null}
                </td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td className="num text-right" title={`${fmtNum(r.inConsensus ? r.consensusStake : r.stake, 2)} MON`}>
                  {fmtCompact(r.inConsensus ? r.consensusStake : r.stake)}
                </td>
                <td className="num text-right">{r.inConsensus ? fmtPct(r.stakeShare) : "–"}</td>
                <td className="num text-right">{fmtPct(r.commission, r.commission % 1 === 0 ? 0 : 1)}</td>
                <td className="num text-right">
                  {r.blocks24h === null ? "–" : fmtNum(r.blocks24h)}
                  {r.expected24h !== null && r.inConsensus ? <span className="text-muted"> / {fmtNum(r.expected24h)}</span> : null}
                </td>
                <td>{r.inConsensus ? <PerfBar ratio={r.performance} /> : <span className="text-muted">–</span>}</td>
                <td className="font-mono text-xs text-muted" title={r.authAddress}>
                  {shortAddr(r.authAddress)}
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted">
                  No validators match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {!historyAvailable ? (
        <div className="border-t border-line px-4 py-2 text-xs text-muted">
          Block-production history is not available yet; the collector publishes it every 10 minutes.
        </div>
      ) : null}
    </div>
  );
}
