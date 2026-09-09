/**
 * Assembles the view models used by pages and the JSON API. All functions are
 * cached for a short time so a burst of visitors costs a handful of RPC calls.
 */
import { unstable_cache } from "next/cache";
import type { Address } from "viem";
import { NETWORKS, PROTOCOL, type NetworkId } from "./chains";
import { commissionPct, toMon } from "./format";
import { getHistory, proposerTotals, type EpochRecord, type HourBucket, type RegistryEntry } from "./history";
import {
  getDelegations,
  getDelegatorPositions,
  getDelegatorsOf,
  getDelegatorStakes,
  getEpoch,
  getProposers,
  getRecentBlocks,
  getValidator,
  getValidatorSets,
  getValidators,
  getWithdrawals,
  type EpochInfo,
  type ValidatorOnChain,
} from "./staking";

export type ValidatorStatus = "active" | "joining" | "leaving" | "candidate" | "inactive";

export interface ValidatorRow {
  id: number;
  name: string | null;
  logo: string | null;
  authAddress: Address;
  status: ValidatorStatus;
  inConsensus: boolean;
  inSnapshot: boolean;
  inExecution: boolean;
  /** MON */
  stake: number;
  consensusStake: number;
  snapshotStake: number;
  /** Share of total consensus stake, in percent. */
  stakeShare: number;
  commission: number;
  flags: string;
  /** Blocks proposed in the last 24h / expected from stake share (null when no history). */
  blocks24h: number | null;
  expected24h: number | null;
  blocks1h: number | null;
  /** blocks24h / expected24h, 1.0 = exactly its share. */
  performance: number | null;
  vdp: boolean | null;
  decommissioned: boolean | null;
}

export interface Overview {
  network: NetworkId;
  chainId: number;
  generatedAt: number;
  epoch: EpochInfo & { blocksIntoEpoch: number | null; blocksToBoundary: number | null; boundaryBlock: number | null };
  head: { number: number; timestamp: number; blockTimeSec: number };
  totals: {
    validators: number;
    active: number;
    candidates: number;
    consensusStakeMon: number;
    executionStakeMon: number;
    avgCommission: number;
    medianCommission: number;
    nakamoto: number;
  };
  history: { available: boolean; updatedAt: number | null; coveredHours: number; blocks24h: number } ;
  validators: ValidatorRow[];
}

function status(inC: boolean, inS: boolean, inE: boolean): ValidatorStatus {
  if (inC && inS) return "active";
  if (inC && !inS) return "leaving";
  if (!inC && inS) return "joining";
  if (inE) return "candidate";
  return "inactive";
}

async function buildOverview(network: NetworkId): Promise<Overview> {
  const [epoch, sets, history, recent] = await Promise.all([
    getEpoch(network),
    getValidatorSets(network),
    getHistory(network),
    getRecentBlocks(network, 30),
  ]);
  const allIds = Array.from(new Set([...sets.consensus, ...sets.snapshot, ...sets.execution])).sort((a, b) => a - b);
  const validators = await getValidators(network, allIds);
  const cSet = new Set(sets.consensus);
  const sSet = new Set(sets.snapshot);
  const eSet = new Set(sets.execution);

  const consensusTotalWei = validators.filter((v) => cSet.has(v.id)).reduce((a, v) => a + BigInt(v.consensusStake), 0n);
  const consensusTotal = toMon(consensusTotalWei);
  const executionTotal = toMon(validators.filter((v) => eSet.has(v.id)).reduce((a, v) => a + BigInt(v.stake), 0n));

  const now = Date.now() / 1000;
  const totals24 = history ? proposerTotals(history.hours, now - 86_400) : null;
  const totals1 = history ? proposerTotals(history.hours, now - 3_600) : null;
  const registry = history?.registry.byId ?? {};

  const rows: ValidatorRow[] = validators.map((v) => {
    const inC = cSet.has(v.id);
    const share = inC && consensusTotal > 0 ? (toMon(v.consensusStake) / consensusTotal) * 100 : 0;
    const reg: RegistryEntry | undefined = registry[String(v.id)];
    const b24 = totals24 ? (totals24.byId.get(v.id) ?? 0) : null;
    const b1 = totals1 ? (totals1.byId.get(v.id) ?? 0) : null;
    const exp24 = totals24 && inC ? (totals24.total * share) / 100 : null;
    return {
      id: v.id,
      name: reg?.name ?? null,
      logo: reg?.logo ?? null,
      authAddress: v.authAddress,
      status: status(inC, sSet.has(v.id), eSet.has(v.id)),
      inConsensus: inC,
      inSnapshot: sSet.has(v.id),
      inExecution: eSet.has(v.id),
      stake: toMon(v.stake),
      consensusStake: toMon(v.consensusStake),
      snapshotStake: toMon(v.snapshotStake),
      stakeShare: share,
      commission: commissionPct(v.commission),
      flags: v.flags,
      blocks24h: b24,
      expected24h: exp24,
      blocks1h: b1,
      performance: exp24 && exp24 > 0 && b24 !== null ? b24 / exp24 : null,
      vdp: reg?.vdp ?? null,
      decommissioned: reg?.decommissioned ?? null,
    };
  });
  rows.sort((a, b) => b.consensusStake - a.consensusStake || b.stake - a.stake || a.id - b.id);

  const active = rows.filter((r) => r.inConsensus);
  const commissions = active.map((r) => r.commission).sort((a, b) => a - b);
  const median = commissions.length ? commissions[Math.floor(commissions.length / 2)] : 0;
  let acc = 0;
  let nakamoto = 0;
  for (const r of active) {
    acc += r.stakeShare;
    nakamoto++;
    if (acc > 100 / 3) break;
  }

  const sorted = [...recent].sort((a, b) => a.number - b.number);
  const blockTime =
    sorted.length > 1 ? (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / (sorted[sorted.length - 1].number - sorted[0].number) : 0;

  const epochStart = epochStartBlock(history?.epochs ?? [], epoch.epoch);
  const coveredHours = history ? history.hours.filter((h) => h.blocks > 0 && h.t + 3600 > now - 86_400).length : 0;

  return {
    network,
    chainId: NETWORKS[network].chainId,
    generatedAt: Math.floor(now),
    epoch: {
      ...epoch,
      blocksIntoEpoch: epochStart ? epoch.block - epochStart : null,
      blocksToBoundary: epochStart ? Math.max(0, epochStart + PROTOCOL.epochLengthBlocks - epoch.block) : null,
      boundaryBlock: epochStart ? epochStart + PROTOCOL.epochLengthBlocks : null,
    },
    head: { number: epoch.block, timestamp: epoch.timestamp, blockTimeSec: blockTime },
    totals: {
      validators: rows.length,
      active: active.length,
      candidates: rows.filter((r) => r.status === "candidate").length,
      consensusStakeMon: consensusTotal,
      executionStakeMon: executionTotal,
      avgCommission: active.length ? active.reduce((a, r) => a + r.commission, 0) / active.length : 0,
      medianCommission: median,
      nakamoto,
    },
    history: {
      available: !!history,
      updatedAt: history?.updatedAt ?? null,
      coveredHours,
      blocks24h: totals24?.total ?? 0,
    },
    validators: rows,
  };
}

/** First block of `epoch` as recorded by the collector (exact only if the collector saw the boundary). */
function epochStartBlock(epochs: EpochRecord[], epoch: number): number | null {
  const rec = epochs.find((e) => e.epoch === epoch);
  if (!rec) return null;
  const prev = epochs.find((e) => e.epoch === epoch - 1);
  // The boundary is exact when the previous epoch's last block is adjacent to this epoch's first block.
  if (prev && prev.lastBlock + 1 === rec.firstBlock) return rec.firstBlock;
  return null;
}

export const getOverview = unstable_cache(buildOverview, ["overview-v1"], { revalidate: 60 });

// ---------------------------------------------------------------- validator page

export interface ValidatorDetail {
  network: NetworkId;
  generatedAt: number;
  row: ValidatorRow;
  onchain: ValidatorOnChain;
  registry: RegistryEntry | null;
  rank: number | null;
  totals: Overview["totals"];
  epoch: Overview["epoch"];
  /** Hourly proposer counts for the last 7 days (oldest first). */
  hourly: { t: number; blocks: number; mine: number; expected: number }[];
  windows: { label: string; blocks: number; expected: number; ratio: number | null }[];
  epochHistory: { epoch: number; startedAt: number; blocks: number; mine: number; stake: number; share: number; valsetSize: number }[];
  delegators: { address: Address; stake: number; unclaimedRewards: number }[];
  delegatorsComplete: boolean;
  delegatorCount: number;
}

async function buildValidatorDetail(network: NetworkId, id: number): Promise<ValidatorDetail | null> {
  const [overview, onchain, history] = await Promise.all([getOverview(network), getValidator(network, id), getHistory(network)]);
  if (!onchain) return null;
  const idx = overview.validators.findIndex((r) => r.id === id);
  let row = idx >= 0 ? overview.validators[idx] : null;
  if (!row) {
    // Registered but outside every set: build a minimal row.
    row = {
      id,
      name: history?.registry.byId[String(id)]?.name ?? null,
      logo: history?.registry.byId[String(id)]?.logo ?? null,
      authAddress: onchain.authAddress,
      status: "inactive",
      inConsensus: false,
      inSnapshot: false,
      inExecution: false,
      stake: toMon(onchain.stake),
      consensusStake: toMon(onchain.consensusStake),
      snapshotStake: toMon(onchain.snapshotStake),
      stakeShare: 0,
      commission: commissionPct(onchain.commission),
      flags: onchain.flags,
      blocks24h: null,
      expected24h: null,
      blocks1h: null,
      performance: null,
      vdp: null,
      decommissioned: null,
    };
  }
  const share = row.stakeShare / 100;
  const hours: HourBucket[] = history?.hours ?? [];
  const now = Date.now() / 1000;
  const hourly = hours
    .filter((h) => h.t + 3600 > now - 7 * 86_400)
    .map((h) => ({ t: h.t, blocks: h.blocks, mine: h.p[String(id)] ?? 0, expected: h.blocks * share }));
  const windows = [
    ["1h", 3_600],
    ["24h", 86_400],
    ["7d", 7 * 86_400],
  ].map(([label, secs]) => {
    const t = proposerTotals(hours, now - Number(secs));
    const mine = t.byId.get(id) ?? 0;
    const expected = t.total * share;
    return { label: String(label), blocks: mine, expected, ratio: expected > 0 ? mine / expected : null };
  });
  const epochHistory = (history?.epochs ?? [])
    .slice()
    .sort((a, b) => b.epoch - a.epoch)
    .map((e) => {
      const stakeWei = e.stake[String(id)];
      const total = Object.values(e.stake).reduce((a, s) => a + BigInt(s), 0n);
      const stake = stakeWei ? toMon(stakeWei) : 0;
      return {
        epoch: e.epoch,
        startedAt: e.startedAt,
        blocks: e.blocks,
        mine: e.p[String(id)] ?? 0,
        stake,
        share: total > 0n && stakeWei ? (toMon(stakeWei) / toMon(total)) * 100 : 0,
        valsetSize: e.valset.length,
      };
    });

  const { delegators, complete } = await getDelegatorsOf(network, id, 3);
  const stakes = await getDelegatorStakes(network, id, delegators);
  const delegatorRows = stakes
    .map((s) => ({ address: s.address, stake: toMon(s.stake), unclaimedRewards: toMon(s.unclaimedRewards) }))
    .sort((a, b) => b.stake - a.stake);

  return {
    network,
    generatedAt: Math.floor(now),
    row,
    onchain,
    registry: history?.registry.byId[String(id)] ?? null,
    rank: idx >= 0 ? idx + 1 : null,
    totals: overview.totals,
    epoch: overview.epoch,
    hourly,
    windows,
    epochHistory,
    delegators: delegatorRows,
    delegatorsComplete: complete,
    delegatorCount: delegators.length,
  };
}

export const getValidatorDetail = unstable_cache(buildValidatorDetail, ["validator-v1"], { revalidate: 60 });

// ---------------------------------------------------------------- epoch page

export interface EpochView {
  network: NetworkId;
  generatedAt: number;
  epoch: Overview["epoch"];
  head: Overview["head"];
  joining: ValidatorRow[];
  leaving: ValidatorRow[];
  waiting: ValidatorRow[];
  activeCount: number;
  snapshotCount: number;
  minActiveStake: number;
  epochs: { epoch: number; startedAt: number; firstBlock: number; lastBlock: number; blocks: number; valsetSize: number; totalStake: number; topProposer: { id: number; name: string | null; blocks: number } | null }[];
  hours: { t: number; blocks: number; proposers: number }[];
}

async function buildEpochView(network: NetworkId): Promise<EpochView> {
  const [overview, history] = await Promise.all([getOverview(network), getHistory(network)]);
  const rows = overview.validators;
  const names = new Map(rows.map((r) => [r.id, r.name]));
  const active = rows.filter((r) => r.inConsensus);
  const epochs = (history?.epochs ?? [])
    .slice()
    .sort((a, b) => b.epoch - a.epoch)
    .map((e) => {
      const top = Object.entries(e.p).sort((a, b) => b[1] - a[1])[0];
      return {
        epoch: e.epoch,
        startedAt: e.startedAt,
        firstBlock: e.firstBlock,
        lastBlock: e.lastBlock,
        blocks: e.blocks,
        valsetSize: e.valset.length,
        totalStake: toMon(Object.values(e.stake).reduce((a, s) => a + BigInt(s), 0n)),
        topProposer: top ? { id: Number(top[0]), name: names.get(Number(top[0])) ?? null, blocks: top[1] } : null,
      };
    });
  return {
    network,
    generatedAt: overview.generatedAt,
    epoch: overview.epoch,
    head: overview.head,
    joining: rows.filter((r) => r.status === "joining"),
    leaving: rows.filter((r) => r.status === "leaving"),
    waiting: rows.filter((r) => r.status === "candidate").sort((a, b) => b.stake - a.stake),
    activeCount: active.length,
    snapshotCount: rows.filter((r) => r.inSnapshot).length,
    minActiveStake: active.length ? Math.min(...active.map((r) => r.consensusStake)) : 0,
    epochs,
    hours: (history?.hours ?? []).map((h) => ({ t: h.t, blocks: h.blocks, proposers: Object.keys(h.p).length })),
  };
}

export const getEpochView = unstable_cache(buildEpochView, ["epoch-v1"], { revalidate: 60 });

// ---------------------------------------------------------------- delegator page

export interface DelegatorView {
  network: NetworkId;
  generatedAt: number;
  address: Address;
  epoch: number;
  positions: {
    valId: number;
    name: string | null;
    logo: string | null;
    status: ValidatorStatus;
    commission: number;
    stake: number;
    unclaimedRewards: number;
    pendingStake: number;
    pendingEpoch: number | null;
    nextPendingStake: number;
    nextPendingEpoch: number | null;
  }[];
  withdrawals: { valId: number; name: string | null; withdrawId: number; amount: number; withdrawEpoch: number; claimable: boolean }[];
  totals: { stake: number; unclaimedRewards: number; pendingStake: number; withdrawing: number };
}

async function buildDelegatorView(network: NetworkId, address: Address): Promise<DelegatorView> {
  const [overview, valIds] = await Promise.all([getOverview(network), getDelegations(network, address)]);
  const [positions, withdrawals] = await Promise.all([
    getDelegatorPositions(network, address, valIds),
    getWithdrawals(network, address, valIds),
  ]);
  const byId = new Map(overview.validators.map((r) => [r.id, r]));
  const rows = positions.map((p) => {
    const v = byId.get(p.valId);
    return {
      valId: p.valId,
      name: v?.name ?? null,
      logo: v?.logo ?? null,
      status: v?.status ?? ("inactive" as ValidatorStatus),
      commission: v?.commission ?? 0,
      stake: toMon(p.stake),
      unclaimedRewards: toMon(p.unclaimedRewards),
      pendingStake: toMon(p.deltaStake),
      pendingEpoch: p.deltaStake !== "0" ? p.deltaEpoch : null,
      nextPendingStake: toMon(p.nextDeltaStake),
      nextPendingEpoch: p.nextDeltaStake !== "0" ? p.nextDeltaEpoch : null,
    };
  });
  const w = withdrawals.map((x) => ({
    valId: x.valId,
    name: byId.get(x.valId)?.name ?? null,
    withdrawId: x.withdrawId,
    amount: toMon(x.amount),
    withdrawEpoch: x.withdrawEpoch,
    claimable: overview.epoch.epoch >= x.withdrawEpoch,
  }));
  return {
    network,
    generatedAt: overview.generatedAt,
    address,
    epoch: overview.epoch.epoch,
    positions: rows.sort((a, b) => b.stake - a.stake),
    withdrawals: w,
    totals: {
      stake: rows.reduce((a, r) => a + r.stake, 0),
      unclaimedRewards: rows.reduce((a, r) => a + r.unclaimedRewards, 0),
      pendingStake: rows.reduce((a, r) => a + r.pendingStake + r.nextPendingStake, 0),
      withdrawing: w.reduce((a, r) => a + r.amount, 0),
    },
  };
}

export const getDelegatorView = unstable_cache(buildDelegatorView, ["delegator-v1"], { revalidate: 30 });

// ---------------------------------------------------------------- live proposers (last N blocks)

export interface LiveProposers {
  from: number;
  to: number;
  blocks: { number: number; proposer: number; name: string | null }[];
}

async function buildLiveProposers(network: NetworkId): Promise<LiveProposers> {
  const overview = await getOverview(network);
  const to = overview.head.number;
  const from = to - 59;
  const map = await getProposers(network, from, to, 12);
  const names = new Map(overview.validators.map((r) => [r.id, r.name]));
  const blocks = [];
  for (let b = to; b >= from; b--) {
    const p = map.get(b);
    if (p !== undefined) blocks.push({ number: b, proposer: p, name: names.get(p) ?? null });
  }
  return { from, to, blocks };
}

export const getLiveProposers = unstable_cache(buildLiveProposers, ["live-v1"], { revalidate: 20 });
