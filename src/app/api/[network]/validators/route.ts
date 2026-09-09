import { badNetwork, json, parseNetwork } from "@/lib/api";
import { getOverview } from "@/lib/model";

export const revalidate = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  const net = parseNetwork(network);
  if (!net) return badNetwork(network);
  return json(await getOverview(net), 60);
}
