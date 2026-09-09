import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { monad, monadTestnet } from "viem/chains";
import { NETWORKS, type NetworkId } from "./chains";

const clients = new Map<NetworkId, PublicClient>();

/**
 * One viem client per network. RPC endpoints are tried in order; a failing endpoint
 * is ranked down automatically. JSON-RPC batching is deliberately off because several
 * public gateways reject batches; multicall batching (one eth_call) is on.
 */
export function getClient(network: NetworkId): PublicClient {
  let c = clients.get(network);
  if (c) return c;
  const net = NETWORKS[network];
  const chain = network === "mainnet" ? monad : monadTestnet;
  c = createPublicClient({
    chain,
    transport: fallback(
      net.rpcs.map((url) => http(url, { timeout: 12_000, retryCount: 1, retryDelay: 200 })),
      { rank: false, retryCount: 0 },
    ),
    batch: { multicall: { batchSize: 8_192, wait: 8 } },
  }) as PublicClient;
  clients.set(network, c);
  return c;
}
