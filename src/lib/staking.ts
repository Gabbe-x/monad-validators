/**
 * Read helpers for the Monad staking precompile. Every function returns plain,
 * JSON-serialisable data (bigints as decimal strings) so results can be cached.
 */
import type { Address } from "viem";
import { PROTOCOL, type NetworkId } from "./chains";
import { getClient } from "./client";
import { STAKING_ABI } from "./staking-abi";

const PRE = PROTOCOL.stakingPrecompile;

export interface EpochInfo {
  epoch: number;
  inEpochDelayPeriod: boolean;
  /** Block number at which the info was read. */
  block: number;
  /** Unix seconds of that block. */
  timestamp: number;
}

export interface ValidatorOnChain {
  id: number;
  authAddress: Address;
  flags: string;
  stake: string;
  accRewardPerToken: string;
  commission: string;
  unclaimedRewards: string;
  consensusStake: string;
  consensusCommission: string;
  snapshotStake: string;
  snapshotCommission: string;
  secpPubkey: string;
  blsPubkey: string;
}

export interface ValidatorSets {
  consensus: number[];
  snapshot: number[];
  execution: number[];
}

export interface DelegatorPosition {
  valId: number;
  stake: string;
  accRewardPerToken: string;
  unclaimedRewards: string;
  deltaStake: string;
  nextDeltaStake: string;
  deltaEpoch: number;
  nextDeltaEpoch: number;
}

export interface WithdrawalRequest {
  valId: number;
  withdrawId: number;
  amount: string;
  withdrawEpoch: number;
}

type SetFn = "getConsensusValidatorSet" | "getSnapshotValidatorSet" | "getExecutionValidatorSet";

export async function getEpoch(network: NetworkId): Promise<EpochInfo> {
  const client = getClient(network);
  const block = await client.getBlock({ blockTag: "latest" });
  const [epoch, inDelay] = await client.readContract({
    address: PRE,
    abi: STAKING_ABI,
    functionName: "getEpoch",
    blockNumber: block.number,
  });
  return {
    epoch: Number(epoch),
    inEpochDelayPeriod: inDelay,
    block: Number(block.number),
    timestamp: Number(block.timestamp),
  };
}

async function readSet(network: NetworkId, fn: SetFn, blockNumber?: bigint): Promise<number[]> {
  const client = getClient(network);
  const ids: number[] = [];
  let start = 0;
  for (let page = 0; page < 50; page++) {
    const [isDone, nextIndex, valIds] = await client.readContract({
      address: PRE,
      abi: STAKING_ABI,
      functionName: fn,
      args: [start],
      blockNumber,
    });
    ids.push(...valIds.map(Number));
    if (isDone || valIds.length === 0 || nextIndex <= start) break;
    start = nextIndex;
  }
  return ids;
}

export async function getValidatorSets(network: NetworkId, blockNumber?: bigint): Promise<ValidatorSets> {
  const [consensus, snapshot, execution] = await Promise.all([
    readSet(network, "getConsensusValidatorSet", blockNumber),
    readSet(network, "getSnapshotValidatorSet", blockNumber),
    readSet(network, "getExecutionValidatorSet", blockNumber),
  ]);
  return { consensus, snapshot, execution };
}

export async function getValidators(network: NetworkId, ids: number[], blockNumber?: bigint): Promise<ValidatorOnChain[]> {
  if (ids.length === 0) return [];
  const client = getClient(network);
  const out: ValidatorOnChain[] = [];
  // 100 validators per multicall keeps each eth_call comfortably under gateway limits.
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const res = await client.multicall({
      contracts: chunk.map((id) => ({
        address: PRE,
        abi: STAKING_ABI,
        functionName: "getValidator" as const,
        args: [BigInt(id)] as const,
      })),
      allowFailure: true,
      blockNumber,
    });
    res.forEach((r, j) => {
      if (r.status !== "success") return;
      const v = r.result;
      out.push({
        id: chunk[j],
        authAddress: v[0],
        flags: v[1].toString(),
        stake: v[2].toString(),
        accRewardPerToken: v[3].toString(),
        commission: v[4].toString(),
        unclaimedRewards: v[5].toString(),
        consensusStake: v[6].toString(),
        consensusCommission: v[7].toString(),
        snapshotStake: v[8].toString(),
        snapshotCommission: v[9].toString(),
        secpPubkey: v[10],
        blsPubkey: v[11],
      });
    });
  }
  return out;
}

export async function getValidator(network: NetworkId, id: number): Promise<ValidatorOnChain | null> {
  const [v] = await getValidators(network, [id]);
  if (!v) return null;
  // An unregistered id decodes to an all-zero struct.
  if (v.authAddress === "0x0000000000000000000000000000000000000000" && v.stake === "0" && /^0x0*$/.test(v.secpPubkey)) return null;
  return v;
}

/** Proposer (validator id) of each block in [from, to]. Runs `concurrency` eth_calls in parallel. */
export async function getProposers(
  network: NetworkId,
  from: number,
  to: number,
  concurrency = 16,
): Promise<Map<number, number>> {
  const client = getClient(network);
  const out = new Map<number, number>();
  const blocks: number[] = [];
  for (let b = from; b <= to; b++) blocks.push(b);
  let idx = 0;
  async function worker() {
    while (idx < blocks.length) {
      const b = blocks[idx++];
      try {
        const id = await client.readContract({
          address: PRE,
          abi: STAKING_ABI,
          functionName: "getProposerValId",
          blockNumber: BigInt(b),
        });
        out.set(b, Number(id));
      } catch {
        /* leave the block out; callers treat gaps as unknown */
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, blocks.length) }, worker));
  return out;
}

export async function getDelegations(network: NetworkId, delegator: Address): Promise<number[]> {
  const client = getClient(network);
  const ids: number[] = [];
  let start = 0n;
  for (let page = 0; page < 50; page++) {
    const [isDone, next, valIds] = await client.readContract({
      address: PRE,
      abi: STAKING_ABI,
      functionName: "getDelegations",
      args: [delegator, start],
    });
    ids.push(...valIds.map(Number));
    if (isDone || valIds.length === 0 || next <= start) break;
    start = next;
  }
  return ids;
}

export async function getDelegatorPositions(
  network: NetworkId,
  delegator: Address,
  valIds: number[],
): Promise<DelegatorPosition[]> {
  if (valIds.length === 0) return [];
  const client = getClient(network);
  const res = await client.multicall({
    contracts: valIds.map((id) => ({
      address: PRE,
      abi: STAKING_ABI,
      functionName: "getDelegator" as const,
      args: [BigInt(id), delegator] as const,
    })),
    allowFailure: true,
  });
  const out: DelegatorPosition[] = [];
  res.forEach((r, i) => {
    if (r.status !== "success") return;
    const d = r.result;
    out.push({
      valId: valIds[i],
      stake: d[0].toString(),
      accRewardPerToken: d[1].toString(),
      unclaimedRewards: d[2].toString(),
      deltaStake: d[3].toString(),
      nextDeltaStake: d[4].toString(),
      deltaEpoch: Number(d[5]),
      nextDeltaEpoch: Number(d[6]),
    });
  });
  return out;
}

/** Pending withdrawal requests for a delegator across the given validators (withdraw ids 0..255 are probed in one multicall per validator). */
export async function getWithdrawals(network: NetworkId, delegator: Address, valIds: number[]): Promise<WithdrawalRequest[]> {
  if (valIds.length === 0) return [];
  const client = getClient(network);
  const contracts = valIds.flatMap((id) =>
    Array.from({ length: 256 }, (_, w) => ({
      address: PRE,
      abi: STAKING_ABI,
      functionName: "getWithdrawalRequest" as const,
      args: [BigInt(id), delegator, w] as const,
    })),
  );
  const out: WithdrawalRequest[] = [];
  for (let i = 0; i < contracts.length; i += 512) {
    const res = await client.multicall({ contracts: contracts.slice(i, i + 512), allowFailure: true });
    res.forEach((r, j) => {
      if (r.status !== "success") return;
      const [amount, , epoch] = r.result;
      if (amount === 0n) return;
      const k = i + j;
      out.push({ valId: valIds[Math.floor(k / 256)], withdrawId: k % 256, amount: amount.toString(), withdrawEpoch: Number(epoch) });
    });
  }
  return out;
}

export async function getDelegatorsOf(network: NetworkId, valId: number, maxPages = 5): Promise<{ delegators: Address[]; complete: boolean }> {
  const client = getClient(network);
  const out: Address[] = [];
  let start: Address = "0x0000000000000000000000000000000000000000";
  let complete = false;
  for (let page = 0; page < maxPages; page++) {
    const [isDone, next, addrs] = await client.readContract({
      address: PRE,
      abi: STAKING_ABI,
      functionName: "getDelegators",
      args: [BigInt(valId), start],
    });
    out.push(...addrs);
    if (isDone || addrs.length === 0 || next.toLowerCase() === start.toLowerCase()) {
      complete = true;
      break;
    }
    start = next;
  }
  return { delegators: out, complete };
}

export async function getDelegatorStakes(network: NetworkId, valId: number, delegators: Address[]): Promise<{ address: Address; stake: string; unclaimedRewards: string }[]> {
  if (delegators.length === 0) return [];
  const client = getClient(network);
  const out: { address: Address; stake: string; unclaimedRewards: string }[] = [];
  for (let i = 0; i < delegators.length; i += 100) {
    const chunk = delegators.slice(i, i + 100);
    const res = await client.multicall({
      contracts: chunk.map((a) => ({
        address: PRE,
        abi: STAKING_ABI,
        functionName: "getDelegator" as const,
        args: [BigInt(valId), a] as const,
      })),
      allowFailure: true,
    });
    res.forEach((r, j) => {
      if (r.status !== "success") return;
      out.push({ address: chunk[j], stake: r.result[0].toString(), unclaimedRewards: r.result[2].toString() });
    });
  }
  return out;
}

/** Recent block headers (number, timestamp, tx count, gas) for block-time and proposer views. */
export async function getRecentBlocks(network: NetworkId, count: number) {
  const client = getClient(network);
  const head = await client.getBlockNumber();
  const numbers = Array.from({ length: count }, (_, i) => head - BigInt(i));
  const blocks = await Promise.all(numbers.map((n) => client.getBlock({ blockNumber: n })));
  return blocks.map((b) => ({
    number: Number(b.number),
    timestamp: Number(b.timestamp),
    txCount: b.transactions.length,
    gasUsed: b.gasUsed.toString(),
    hash: b.hash,
  }));
}
