import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Header } from "@/components/Header";
import { ValidatorTable } from "@/components/ValidatorTable";
import { Stat } from "@/components/ui";
import { isNetworkId, NETWORKS, PROTOCOL } from "@/lib/chains";
import { fmtCompact, fmtDuration, fmtNum, fmtPct, timeAgo } from "@/lib/format";
import { getOverview } from "@/lib/model";

export const revalidate = 60;

type Props = { params: Promise<{ network: string }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { network } = await params;
  return { title: isNetworkId(network) ? `${NETWORKS[network].name} validators` : "Validators" };
}

export default async function NetworkPage({ params, searchParams }: Props) {
  const { network } = await params;
  const { q } = await searchParams;
  if (!isNetworkId(network)) notFound();
  const o = await getOverview(network);
  const blocksLeft = o.epoch.blocksToBoundary;
  const eta = blocksLeft !== null && o.head.blockTimeSec > 0 ? fmtDuration(blocksLeft * o.head.blockTimeSec) : null;

  return (
    <>
      <Header network={network} active="validators" />
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{NETWORKS[network].name} validators</h1>
            <p className="mt-1 text-sm text-muted">
              Chain {o.chainId} · block <span className="num">{fmtNum(o.head.number)}</span> {timeAgo(o.head.timestamp, o.generatedAt)} · data refreshed{" "}
              {timeAgo(o.generatedAt)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Epoch" value={o.epoch.epoch} sub={o.epoch.inEpochDelayPeriod ? "in epoch delay period" : eta ? `boundary in ~${eta}` : `${fmtNum(PROTOCOL.epochLengthBlocks)} blocks per epoch`} />
          <Stat label="Active validators" value={o.totals.active} sub={`${o.totals.candidates} candidates waiting`} />
          <Stat label="Consensus stake" value={`${fmtCompact(o.totals.consensusStakeMon)} MON`} sub={`${fmtCompact(o.totals.executionStakeMon)} MON incl. candidates`} />
          <Stat label="Median commission" value={fmtPct(o.totals.medianCommission, 1)} sub={`avg ${fmtPct(o.totals.avgCommission, 1)}`} />
          <Stat label="Nakamoto coefficient" value={o.totals.nakamoto} sub="validators to reach 1/3 of stake" />
          <Stat label="Block time" value={`${o.head.blockTimeSec.toFixed(2)} s`} sub={o.history.available ? `${fmtNum(o.history.blocks24h)} blocks tracked in 24h` : "history not published yet"} />
        </div>

        <div className="mt-6">
          <Suspense>
            <ValidatorTable network={network} rows={o.validators} initialQuery={q ?? ""} historyAvailable={o.history.available} />
          </Suspense>
        </div>
        <p className="mt-3 text-xs text-muted">
          Stake shown for active validators is the consensus stake (weight used in the current epoch). “Blocks 24h” compares blocks actually proposed
          with the number expected from the validator’s stake share; leader selection in MonadBFT is stake-weighted, so a healthy validator sits near 100%.
        </p>
      </main>
    </>
  );
}
