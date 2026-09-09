/**
 * Historical data produced by the collector (collector/collect.ts) and published
 * on the `data` branch of this repository. The app only reads it.
 */
import { unstable_cache } from "next/cache";
import type { NetworkId } from "./chains";

export interface RegistryEntry {
  id: number;
  name: string;
  secp: string;
  bls?: string;
  website?: string;
  description?: string;
  logo?: string;
  x?: string;
  registration_date?: string;
  decommissioned?: boolean;
  vdp?: boolean;
}

export interface HourBucket {
  /** Unix seconds, start of the hour. */
  t: number;
  /** Blocks observed in the hour. */
  blocks: number;
  /** Validator id -> blocks proposed. */
  p: Record<string, number>;
}

export interface EpochRecord {
  epoch: number;
  firstBlock: number;
  lastBlock: number;
  /** Unix seconds of the first block seen in this epoch. */
  startedAt: number;
  blocks: number;
  p: Record<string, number>;
  /** Validator id -> consensus stake (wei, decimal string) captured at the first scan inside the epoch. */
  stake: Record<string, string>;
  /** Consensus validator set at the first scan inside the epoch. */
  valset: number[];
}

export interface HistoryFile {
  schema: 1;
  network: NetworkId;
  updatedAt: number;
  head: number;
  headTimestamp: number;
  epoch: number;
  inEpochDelayPeriod: boolean;
  scan: { fromBlock: number; toBlock: number; blocksScanned: number; gaps: [number, number][] };
  hours: HourBucket[];
  epochs: EpochRecord[];
  registry: { updatedAt: number; byId: Record<string, RegistryEntry> };
}

const STALE_AFTER_S = 12 * 60;
let lastDispatch = 0;

/**
 * GitHub's cron for scheduled workflows is best-effort and, on busy days, fires only every
 * few hours. When GITHUB_DISPATCH_TOKEN (a fine-grained token with Actions: write on this
 * repository) is configured, the app kicks the collector itself whenever the published
 * history is older than STALE_AFTER_S. Visitors therefore keep the data fresh; the workflow's
 * concurrency group makes duplicate dispatches harmless.
 */
function maybeDispatchCollector(updatedAt: number | null): void {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_DISPATCH_REPO ?? "Gabbe-x/monad-validators";
  if (!token) return;
  const now = Date.now() / 1000;
  if (updatedAt !== null && now - updatedAt < STALE_AFTER_S) return;
  if (now - lastDispatch < STALE_AFTER_S / 2) return;
  lastDispatch = now;
  fetch(`https://api.github.com/repos/${repo}/actions/workflows/collect.yml/dispatches`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" },
    body: JSON.stringify({ ref: "main" }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined);
}

const DATA_REPO = process.env.GITHUB_DISPATCH_REPO ?? "Gabbe-x/monad-validators";
const DATA_BRANCH = "data";
let refMemo: { sha: string; at: number } | null = null;

/**
 * raw.githubusercontent.com serves branch URLs from a CDN that ignores query strings and
 * can return a copy that is well over its 5-minute TTL. Content addressed by commit SHA is
 * immutable and therefore always correct, so resolve the branch head first (one small API
 * call, memoised for two minutes) and fetch by SHA. Falls back to the branch URL if the API
 * is unavailable or rate limited.
 */
async function resolveDataUrl(network: NetworkId): Promise<string> {
  if (process.env.HISTORY_BASE_URL) return `${process.env.HISTORY_BASE_URL}/${network}.json`;
  const now = Date.now();
  if (!refMemo || now - refMemo.at > 120_000) {
    try {
      const headers: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "monad-validators" };
      const token = process.env.GITHUB_DISPATCH_TOKEN;
      if (token) headers.authorization = `Bearer ${token}`;
      const res = await fetch(`https://api.github.com/repos/${DATA_REPO}/git/ref/heads/${DATA_BRANCH}`, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const ref = (await res.json()) as { object?: { sha?: string } };
        if (ref.object?.sha) refMemo = { sha: ref.object.sha, at: now };
      }
    } catch {
      /* fall through to the branch URL */
    }
  }
  const rev = refMemo?.sha ?? DATA_BRANCH;
  return `https://raw.githubusercontent.com/${DATA_REPO}/${rev}/${network}.json`;
}

async function fetchHistory(network: NetworkId): Promise<HistoryFile | null> {
  try {
    const res = await fetch(await resolveDataUrl(network), { cache: "no-store" });
    if (!res.ok) {
      maybeDispatchCollector(null);
      return null;
    }
    const data = (await res.json()) as HistoryFile;
    if (data.schema !== 1) return null;
    maybeDispatchCollector(data.updatedAt);
    return data;
  } catch {
    maybeDispatchCollector(null);
    return null;
  }
}

export const getHistory = unstable_cache(fetchHistory, ["history-v1"], { revalidate: 120 });

/** Sum of blocks proposed per validator over the buckets that start after `sinceTs`. */
export function proposerTotals(hours: HourBucket[], sinceTs: number): { total: number; byId: Map<number, number> } {
  const byId = new Map<number, number>();
  let total = 0;
  for (const h of hours) {
    if (h.t + 3600 <= sinceTs) continue;
    total += h.blocks;
    for (const [id, n] of Object.entries(h.p)) byId.set(Number(id), (byId.get(Number(id)) ?? 0) + n);
  }
  return { total, byId };
}
