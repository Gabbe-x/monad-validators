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

const DATA_BASE =
  process.env.HISTORY_BASE_URL ?? "https://raw.githubusercontent.com/Gabbe-x/monad-validators/data";

async function fetchHistory(network: NetworkId): Promise<HistoryFile | null> {
  // raw.githubusercontent.com caches by URL for ~5 minutes; a slowly changing query
  // string keeps the app from seeing a stale copy for longer than that.
  const bust = Math.floor(Date.now() / 120_000);
  try {
    const res = await fetch(`${DATA_BASE}/${network}.json?v=${bust}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as HistoryFile;
    if (data.schema !== 1) return null;
    return data;
  } catch {
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
