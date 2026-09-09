import type { Address } from "viem";
import { badNetwork, json, parseNetwork } from "@/lib/api";
import { isAddress } from "@/lib/format";
import { getDelegatorView } from "@/lib/model";

export const revalidate = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ network: string; address: string }> }) {
  const { network, address } = await params;
  const net = parseNetwork(network);
  if (!net) return badNetwork(network);
  if (!isAddress(address)) return json({ error: "address must be a 0x-prefixed 20-byte hex string" }, 0, 400);
  return json(await getDelegatorView(net, address.toLowerCase() as Address), 30);
}
