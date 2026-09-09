import { badNetwork, json, parseNetwork } from "@/lib/api";
import { getValidatorDetail } from "@/lib/model";

export const revalidate = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ network: string; id: string }> }) {
  const { network, id } = await params;
  const net = parseNetwork(network);
  if (!net) return badNetwork(network);
  if (!/^\d+$/.test(id)) return json({ error: "validator id must be an integer" }, 0, 400);
  const d = await getValidatorDetail(net, Number(id));
  if (!d) return json({ error: `validator ${id} is not registered` }, 0, 404);
  return json(d, 60);
}
