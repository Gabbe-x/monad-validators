import { NextResponse } from "next/server";
import { isNetworkId, type NetworkId } from "./chains";

export function json(data: unknown, maxAge: number, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    },
  });
}

export function badNetwork(network: string) {
  return json({ error: `unknown network '${network}', expected mainnet or testnet` }, 0, 404);
}

export function parseNetwork(network: string): NetworkId | null {
  return isNetworkId(network) ? network : null;
}
