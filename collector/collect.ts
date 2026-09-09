/**
 * Proposer / epoch history collector.
 *
 * Runs from GitHub Actions every 10 minutes (see .github/workflows/collect.yml):
 *   1. loads the previous <network>.json from the `data` branch,
 *   2. reads the proposer of every block produced since the last run,
 *   3. folds the results into hourly buckets (7 days) and per-epoch records (30 epochs),
 *   4. refreshes the validator registry (monad-developers/validator-info) every 6 hours,
 *   5. writes out/<network>.json; the workflow force-pushes `out/` as the new `data` branch.
 *
 * Usage: npx tsx collector/collect.ts <mainnet|testnet> [--max-blocks N] [--in DIR] [--out DIR]
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isNetworkId, NETWORKS, PROTOCOL, type NetworkId } from "../src/lib/chains";
import type { EpochRecord, HistoryFile, HourBucket, RegistryEntry } from "../src/lib/history";
import { getClient } from "../src/lib/client";
import { STAKING_ABI } from "../src/lib/staking-abi";
import { getEpoch, getProposers, getValidatorSets, getValidators } from "../src/lib/staking";

const HOURS_KEPT = 7 * 24 + 1;
const EPOCHS_KEPT = 30;
const REGISTRY_TTL = 6 * 3600;

function arg(name: string, dflt: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

async function fetchRegistry(network: NetworkId, previous: HistoryFile["registry"] | undefined): Promise<HistoryFile["registry"]> {
  const now = Math.floor(Date.now() / 1000);
  if (previous && now - previous.updatedAt < REGISTRY_TTL) return previous;
  const dir = NETWORKS[network].registryDir;
  const headers: Record<string, string> = { "user-agent": "monad-validators-collector" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const tree = (await (
      await fetch("https://api.github.com/repos/monad-developers/validator-info/git/trees/main?recursive=1", { headers })
    ).json()) as { tree: { path: string; type: string }[] };
    const files = tree.tree.filter((t) => t.type === "blob" && t.path.startsWith(`${dir}/`) && t.path.endsWith(".json") && !t.path.includes("_validators"));
    const byId: Record<string, RegistryEntry> = {};
    let idx = 0;
    async function worker() {
      while (idx < files.length) {
        const f = files[idx++];
        try {
          const res = await fetch(`https://raw.githubusercontent.com/monad-developers/validator-info/main/${f.path}`, { headers: { "user-agent": headers["user-agent"] } });
          if (!res.ok) continue;
          const e = (await res.json()) as RegistryEntry;
          if (typeof e.id === "number" && e.name) byId[String(e.id)] = e;
        } catch {
          /* skip unreadable file */
        }
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker));
    console.log(`registry: ${Object.keys(byId).length} validators from ${files.length} files`);
    if (Object.keys(byId).length === 0 && previous) return previous;
    return { updatedAt: now, byId };
  } catch (err) {
    console.warn("registry refresh failed:", err);
    return previous ?? { updatedAt: 0, byId: {} };
  }
}

async function main() {
  const network = process.argv[2];
  if (!isNetworkId(network)) throw new Error("usage: collect.ts <mainnet|testnet>");
  const maxBlocks = Number(arg("--max-blocks", "6000"));
  const inDir = arg("--in", "data");
  const outDir = arg("--out", "out");
  const inPath = join(inDir, `${network}.json`);
  const prev: HistoryFile | null = existsSync(inPath) ? (JSON.parse(readFileSync(inPath, "utf8")) as HistoryFile) : null;
  if (prev) console.log(`loaded previous state: head ${prev.head}, ${prev.hours.length} hour buckets, ${prev.epochs.length} epochs`);

  const epochInfo = await getEpoch(network);
  const head = epochInfo.block;
  const headTs = epochInfo.timestamp;

  // Range to scan.
  let from = prev ? prev.head + 1 : head - Math.min(maxBlocks, 2000) + 1;
  const gaps: [number, number][] = prev?.scan.gaps ?? [];
  if (head - from + 1 > maxBlocks) {
    gaps.push([from, head - maxBlocks]);
    console.warn(`behind by ${head - from + 1} blocks; skipping ${from}..${head - maxBlocks}`);
    from = head - maxBlocks + 1;
  }
  const to = head;
  console.log(`scanning ${from}..${to} (${to - from + 1} blocks)`);
  const t0 = Date.now();
  const [proposers, fromBlock] = await Promise.all([
    getProposers(network, from, to, 12),
    getClient(network).getBlock({ blockNumber: BigInt(from) }),
  ]);
  const fromTs = Number(fromBlock.timestamp);
  const blockTime = to > from ? (headTs - fromTs) / (to - from) : 0.3;
  const tsOf = (b: number) => Math.round(fromTs + (b - from) * blockTime);
  console.log(`got ${proposers.size} proposers in ${((Date.now() - t0) / 1000).toFixed(1)}s, block time ${blockTime.toFixed(3)}s`);

  // Epoch bookkeeping: determine the epoch of scanned blocks. Epoch changes are rare
  // (every 50k blocks) so we only need to locate the boundary when the epoch differs
  // from the previous run.
  const epochs: EpochRecord[] = prev?.epochs ? prev.epochs.map((e) => ({ ...e })) : [];
  let current = epochs.find((e) => e.epoch === epochInfo.epoch);
  let boundary: number | null = null; // first block of the current epoch, if inside the scanned range
  if (!current || (prev && prev.epoch !== epochInfo.epoch)) {
    boundary = await findBoundary(network, epochInfo.epoch, from, to);
    console.log(`epoch ${epochInfo.epoch} starts at block ${boundary ?? "unknown (before scan range)"}`);
  }
  if (!current) {
    const sets = await getValidatorSets(network);
    const vals = await getValidators(network, sets.consensus);
    const stake: Record<string, string> = {};
    for (const v of vals) stake[String(v.id)] = v.consensusStake;
    current = {
      epoch: epochInfo.epoch,
      firstBlock: boundary ?? from,
      lastBlock: to,
      startedAt: tsOf(boundary ?? from),
      blocks: 0,
      p: {},
      stake,
      valset: sets.consensus,
    };
    epochs.push(current);
  }
  const previousEpoch = epochs.find((e) => e.epoch === epochInfo.epoch - 1);

  // Hour buckets.
  const hours = new Map<number, HourBucket>();
  for (const h of prev?.hours ?? []) hours.set(h.t, { ...h, p: { ...h.p } });

  for (let b = from; b <= to; b++) {
    const p = proposers.get(b);
    if (p === undefined) continue;
    const ts = tsOf(b);
    const hourStart = ts - (ts % 3600);
    let bucket = hours.get(hourStart);
    if (!bucket) {
      bucket = { t: hourStart, blocks: 0, p: {} };
      hours.set(hourStart, bucket);
    }
    bucket.blocks++;
    bucket.p[String(p)] = (bucket.p[String(p)] ?? 0) + 1;

    const rec = boundary !== null && b < boundary && previousEpoch ? previousEpoch : current;
    rec.blocks++;
    rec.p[String(p)] = (rec.p[String(p)] ?? 0) + 1;
    if (b > rec.lastBlock) rec.lastBlock = b;
    if (b < rec.firstBlock) rec.firstBlock = b;
  }
  if (boundary !== null) {
    current.firstBlock = boundary;
    if (previousEpoch) previousEpoch.lastBlock = boundary - 1;
  }

  const hoursOut = Array.from(hours.values())
    .sort((a, b) => a.t - b.t)
    .slice(-HOURS_KEPT);
  const epochsOut = epochs.sort((a, b) => a.epoch - b.epoch).slice(-EPOCHS_KEPT);
  const registry = await fetchRegistry(network, prev?.registry);

  const out: HistoryFile = {
    schema: 1,
    network,
    updatedAt: Math.floor(Date.now() / 1000),
    head,
    headTimestamp: headTs,
    epoch: epochInfo.epoch,
    inEpochDelayPeriod: epochInfo.inEpochDelayPeriod,
    scan: { fromBlock: from, toBlock: to, blocksScanned: proposers.size, gaps: gaps.slice(-50) },
    hours: hoursOut,
    epochs: epochsOut,
    registry,
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${network}.json`), JSON.stringify(out));
  console.log(`wrote ${join(outDir, `${network}.json`)} (${hoursOut.length} hours, ${epochsOut.length} epochs, ${Object.keys(registry.byId).length} registry entries)`);
}

/** Binary-search the first block of `epoch` inside [lo, hi]; null if the epoch already started before `lo`. */
async function findBoundary(network: NetworkId, epoch: number, lo: number, hi: number): Promise<number | null> {
  const epochAt = async (b: number) => {
    const [e] = await getClient(network).readContract({
      address: PROTOCOL.stakingPrecompile,
      abi: STAKING_ABI,
      functionName: "getEpoch",
      blockNumber: BigInt(b),
    });
    return Number(e);
  };
  if ((await epochAt(lo)) >= epoch) return null;
  let a = lo;
  let b = hi;
  while (b - a > 1) {
    const mid = Math.floor((a + b) / 2);
    if ((await epochAt(mid)) >= epoch) b = mid;
    else a = mid;
  }
  return b;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
