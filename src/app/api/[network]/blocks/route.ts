import { badNetwork, json, parseNetwork } from "@/lib/api";
import { getLiveProposers } from "@/lib/model";

export const revalidate = 20;

export async function GET(_req: Request, { params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  const net = parseNetwork(network);
  if (!net) return badNetwork(network);
  return json(await getLiveProposers(net), 20);
}
