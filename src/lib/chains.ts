export type NetworkId = "mainnet" | "testnet";

export interface Network {
  id: NetworkId;
  name: string;
  chainId: number;
  /** Public JSON-RPC endpoints, tried in order with automatic fallback. */
  rpcs: string[];
  explorer: {
    name: string;
    address: (addr: string) => string;
    block: (n: number | bigint) => string;
    tx: (hash: string) => string;
  };
  /** Symbol of the native token. */
  symbol: string;
  /** Sub-directory in the monad-developers/validator-info registry. */
  registryDir: string;
}

export const NETWORKS: Record<NetworkId, Network> = {
  mainnet: {
    id: "mainnet",
    name: "Monad Mainnet",
    chainId: 143,
    rpcs: [
      "https://rpc.monad.xyz",
      "https://rpc.ankr.com/monad_mainnet",
      "https://monad-mainnet.drpc.org",
      "https://rpc-mainnet.monadinfra.com",
      "https://monad.gateway.tenderly.co",
    ],
    explorer: {
      name: "MonadVision",
      address: (a) => `https://monadvision.com/address/${a}`,
      block: (n) => `https://monadvision.com/block/${n}`,
      tx: (h) => `https://monadvision.com/tx/${h}`,
    },
    symbol: "MON",
    registryDir: "mainnet",
  },
  testnet: {
    id: "testnet",
    name: "Monad Testnet",
    chainId: 10143,
    rpcs: [
      "https://testnet-rpc.monad.xyz",
      "https://rpc.ankr.com/monad_testnet",
      "https://monad-testnet.drpc.org",
      "https://rpc-testnet.monadinfra.com",
      "https://monad-testnet.gateway.tenderly.co",
    ],
    explorer: {
      name: "MonadVision",
      address: (a) => `https://testnet.monadvision.com/address/${a}`,
      block: (n) => `https://testnet.monadvision.com/block/${n}`,
      tx: (h) => `https://testnet.monadvision.com/tx/${h}`,
    },
    symbol: "MON",
    registryDir: "testnet",
  },
};

export const DEFAULT_NETWORK: NetworkId = "mainnet";

export function isNetworkId(v: string | undefined | null): v is NetworkId {
  return v === "mainnet" || v === "testnet";
}

/** Protocol constants from docs.monad.xyz (staking reference). */
export const PROTOCOL = {
  stakingPrecompile: "0x0000000000000000000000000000000000001000" as const,
  epochLengthBlocks: 50_000,
  epochDelayRounds: 5_000,
  activeValsetSize: 200,
  activeValidatorStakeMon: 10_000_000,
  minAuthAddressStakeMon: 100_000,
  rewardPerBlockMon: 18,
  withdrawalDelayEpochs: 1,
  paginatedResultsSize: 100,
};
