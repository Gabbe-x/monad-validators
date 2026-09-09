/**
 * Read-only subset of the Monad staking precompile ABI
 * (docs.monad.xyz/developer-essentials/staking/staking-precompile).
 * The precompile declares its getters as nonpayable, not view; eth_call works regardless.
 */
export const STAKING_ABI = [
  {
    type: "function",
    name: "getEpoch",
    inputs: [],
    outputs: [
      { name: "epoch", type: "uint64" },
      { name: "inEpochDelayPeriod", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getProposerValId",
    inputs: [],
    outputs: [{ name: "valId", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getValidator",
    inputs: [{ name: "valId", type: "uint64" }],
    outputs: [
      { name: "authAddress", type: "address" },
      { name: "flags", type: "uint64" },
      { name: "stake", type: "uint256" },
      { name: "accRewardPerToken", type: "uint256" },
      { name: "commission", type: "uint256" },
      { name: "unclaimedRewards", type: "uint256" },
      { name: "consensusStake", type: "uint256" },
      { name: "consensusCommission", type: "uint256" },
      { name: "snapshotStake", type: "uint256" },
      { name: "snapshotCommission", type: "uint256" },
      { name: "secpPubkey", type: "bytes" },
      { name: "blsPubkey", type: "bytes" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getDelegator",
    inputs: [
      { name: "valId", type: "uint64" },
      { name: "delegator", type: "address" },
    ],
    outputs: [
      { name: "stake", type: "uint256" },
      { name: "accRewardPerToken", type: "uint256" },
      { name: "unclaimedRewards", type: "uint256" },
      { name: "deltaStake", type: "uint256" },
      { name: "nextDeltaStake", type: "uint256" },
      { name: "deltaEpoch", type: "uint64" },
      { name: "nextDeltaEpoch", type: "uint64" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getWithdrawalRequest",
    inputs: [
      { name: "valId", type: "uint64" },
      { name: "delegator", type: "address" },
      { name: "withdrawId", type: "uint8" },
    ],
    outputs: [
      { name: "withdrawalAmount", type: "uint256" },
      { name: "accRewardPerToken", type: "uint256" },
      { name: "withdrawEpoch", type: "uint64" },
    ],
    stateMutability: "view",
  },
  ...(["getConsensusValidatorSet", "getSnapshotValidatorSet", "getExecutionValidatorSet"] as const).map(
    (name) =>
      ({
        type: "function",
        name,
        inputs: [{ name: "startIndex", type: "uint32" }],
        outputs: [
          { name: "isDone", type: "bool" },
          { name: "nextIndex", type: "uint32" },
          { name: "valIds", type: "uint64[]" },
        ],
        stateMutability: "view",
      }) as const,
  ),
  {
    type: "function",
    name: "getDelegations",
    inputs: [
      { name: "delegator", type: "address" },
      { name: "startValId", type: "uint64" },
    ],
    outputs: [
      { name: "isDone", type: "bool" },
      { name: "nextValId", type: "uint64" },
      { name: "valIds", type: "uint64[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getDelegators",
    inputs: [
      { name: "valId", type: "uint64" },
      { name: "startDelegator", type: "address" },
    ],
    outputs: [
      { name: "isDone", type: "bool" },
      { name: "nextDelegator", type: "address" },
      { name: "delegators", type: "address[]" },
    ],
    stateMutability: "view",
  },
] as const;

/** Multicall3 is deployed at the canonical address on Monad. */
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;
