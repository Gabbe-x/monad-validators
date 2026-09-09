import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Empty, Sparkline, Stat, ValidatorName } from "@/components/ui";
import { isNetworkId, NETWORKS, PROTOCOL } from "@/lib/chains";
import { fmtCompact, fmtDate, fmtDuration, fmtNum, fmtPct, timeAgo } from "@/lib/format";
import { getEpochView, type ValidatorRow } from "@/lib/model";

export const revalidate = 60;

type Props = { params: Promise<{ network: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { network } = await params;
  return { title: `Epoch & validator set changes${isNetworkId(network) ? ` (${NETWORKS[network].name})` : ""}` };
}

export default async function EpochPage({ params }: Props) {
  const { network } = await params;
  if (!isNetworkId(network)) notFound();
  const v = await getEpochView(network);
  const eta = v.epoch.blocksToBoundary !== null && v.head.blockTimeSec > 0 ? fmtDuration(v.epoch.blocksToBoundary * v.head.blockTimeSec) : null;
  const progress = v.epoch.blocksIntoEpoch !== null ? Math.min(100, (v.epoch.blocksIntoEpoch / PROTOCOL.epochLengthBlocks) * 100) : null;

  return (
    <>
      <Header network={network} active="epoch" />
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <h1 className="text-2xl font-semibold">Epoch {v.epoch.epoch}</h1>
        <p className="mt-1 text-sm text-muted">
          {v.epoch.inEpochDelayPeriod
            ? "The boundary block has passed; the new epoch starts after the 5,000-round delay."
            : "Delegations, undelegations and commission changes submitted now take effect in epoch " + (v.epoch.epoch + 1) + "."}
          {" "}Refreshed {timeAgo(v.generatedAt)}.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Current block" value={fmtNum(v.head.number)} sub={`${v.head.blockTimeSec.toFixed(2)} s per block`} />
          <Stat
            label="Boundary block"
            value={v.epoch.boundaryBlock !== null ? fmtNum(v.epoch.boundaryBlock) : "–"}
            sub={v.epoch.blocksToBoundary !== null ? `${fmtNum(v.epoch.blocksToBoundary)} blocks left${eta ? `, ~${eta}` : ""}` : "exact boundary not observed yet"}
          />
          <Stat label="Active set" value={`${v.activeCount} / ${PROTOCOL.activeValsetSize}`} sub={`next epoch: ${v.snapshotCount}`} />
          <Stat label="Min stake in active set" value={`${fmtCompact(v.minActiveStake)} MON`} sub="stake needed to enter the top 200" />
        </div>
        {progress !== null ? (
          <div className="mt-3 h-2 w-full overflow-hidden rounded bg-panel-2" title={`${progress.toFixed(1)}% of the epoch elapsed`}>
            <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SetList network={network} title={`Joining next epoch (${v.joining.length})`} rows={v.joining} empty="No validators are joining the active set next epoch." />
          <SetList network={network} title={`Leaving next epoch (${v.leaving.length})`} rows={v.leaving} empty="No validators are leaving the active set next epoch." />
        </div>

        <section className="card mt-6">
          <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Candidates outside the active set ({v.waiting.length})</h2>
          {v.waiting.length ? (
            <div className="table-wrap max-h-[420px] overflow-y-auto">
              <table className="data">
                <thead><tr><th>Validator</th><th className="text-right">Stake (MON)</th><th className="text-right">Gap to active set</th><th className="text-right">Commission</th></tr></thead>
                <tbody>
                  {v.waiting.map((r) => (
                    <tr key={r.id}>
                      <td><ValidatorName network={network} id={r.id} name={r.name} logo={r.logo} /></td>
                      <td className="num text-right">{fmtNum(r.stake)}</td>
                      <td className="num text-right text-muted">{fmtCompact(Math.max(0, v.minActiveStake - r.stake))}</td>
                      <td className="num text-right">{fmtPct(r.commission, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Every registered validator is in the active set.</Empty>
          )}
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className="card p-4 lg:col-span-1">
            <h2 className="text-sm font-medium text-muted">Blocks observed per hour, last 7 days</h2>
            {v.hours.length > 1 ? (
              <>
                <div className="mt-3"><Sparkline points={v.hours.map((h) => h.blocks)} height={100} /></div>
                <div className="mt-1 flex justify-between text-xs text-muted"><span>{fmtDate(v.hours[0].t)}</span><span>{fmtDate(v.hours[v.hours.length - 1].t)}</span></div>
              </>
            ) : (
              <Empty>No history yet.</Empty>
            )}
          </section>
          <section className="card lg:col-span-2">
            <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Recent epochs</h2>
            {v.epochs.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Epoch</th><th>Started</th><th>Blocks</th><th className="text-right">Observed</th><th className="text-right">Active set</th><th className="text-right">Total stake</th><th>Top proposer</th></tr></thead>
                  <tbody>
                    {v.epochs.map((e) => (
                      <tr key={e.epoch}>
                        <td className="num">{e.epoch}</td>
                        <td className="text-muted">{fmtDate(e.startedAt)}</td>
                        <td className="num text-muted">{fmtNum(e.firstBlock)} – {fmtNum(e.lastBlock)}</td>
                        <td className="num text-right">{fmtNum(e.blocks)}</td>
                        <td className="num text-right">{e.valsetSize}</td>
                        <td className="num text-right">{fmtCompact(e.totalStake)} MON</td>
                        <td>{e.topProposer ? <ValidatorName network={network} id={e.topProposer.id} name={e.topProposer.name} /> : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No epoch history yet.</Empty>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function SetList({ network, title, rows, empty }: { network: string; title: string; rows: ValidatorRow[]; empty: string }) {
  return (
    <section className="card">
      <h2 className="border-b border-line px-4 py-3 text-sm font-medium">{title}</h2>
      {rows.length ? (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Validator</th><th className="text-right">Consensus stake</th><th className="text-right">Snapshot stake</th><th className="text-right">Commission</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><ValidatorName network={network} id={r.id} name={r.name} logo={r.logo} /></td>
                  <td className="num text-right">{fmtCompact(r.consensusStake)}</td>
                  <td className="num text-right">{fmtCompact(r.snapshotStake)}</td>
                  <td className="num text-right">{fmtPct(r.commission, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{empty}</Empty>
      )}
    </section>
  );
}
