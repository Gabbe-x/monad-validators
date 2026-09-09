import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Empty, PerfBar, Sparkline, Stat, StatusBadge, ValidatorName } from "@/components/ui";
import { isNetworkId, NETWORKS } from "@/lib/chains";
import { fmtCompact, fmtDate, fmtNum, fmtPct, shortAddr, shortHex } from "@/lib/format";
import { getValidatorDetail } from "@/lib/model";

export const revalidate = 60;

type Props = { params: Promise<{ network: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { network, id } = await params;
  if (!isNetworkId(network) || !/^\d+$/.test(id)) return { title: "Validator" };
  const d = await getValidatorDetail(network, Number(id));
  return { title: d ? `${d.row.name ?? `Validator #${id}`} (${NETWORKS[network].name})` : "Validator not found" };
}

export default async function ValidatorPage({ params }: Props) {
  const { network, id } = await params;
  if (!isNetworkId(network) || !/^\d+$/.test(id)) notFound();
  const d = await getValidatorDetail(network, Number(id));
  if (!d) notFound();
  const { row, onchain, registry } = d;
  const net = NETWORKS[network];

  return (
    <>
      <Header network={network} active="validators" />
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="mb-1 text-sm text-muted">
          <Link href={`/${network}`} className="hover:text-fg">Validators</Link> / #{row.id}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-semibold">
            <ValidatorName network={network} id={row.id} name={row.name} logo={row.logo} link={false} />
          </h1>
          <StatusBadge status={row.status} />
          {d.rank ? <span className="text-sm text-muted">rank #{d.rank} by stake</span> : null}
          {row.vdp ? <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent-2">Validator Delegation Program</span> : null}
          {row.decommissioned ? <span className="rounded bg-bad/15 px-2 py-0.5 text-xs text-bad">decommissioned in registry</span> : null}
        </div>
        {registry?.description ? <p className="mt-2 max-w-3xl text-sm text-muted">{registry.description}</p> : null}
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          {registry?.website ? <a className="text-accent-2 hover:underline" href={registry.website} target="_blank" rel="noopener">Website</a> : null}
          {registry?.x ? <a className="text-accent-2 hover:underline" href={registry.x} target="_blank" rel="noopener">X</a> : null}
          <a className="text-accent-2 hover:underline" href={net.explorer.address(row.authAddress)} target="_blank" rel="noopener">Auth address on {net.explorer.name}</a>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Consensus stake" value={`${fmtCompact(row.consensusStake)} MON`} sub={row.inConsensus ? `${fmtPct(row.stakeShare)} of network` : "not in consensus set"} />
          <Stat label="Current stake" value={`${fmtCompact(row.stake)} MON`} sub={`snapshot ${fmtCompact(row.snapshotStake)} MON`} />
          <Stat label="Commission" value={fmtPct(row.commission, 1)} sub={`unclaimed ${fmtCompact(Number(onchain.unclaimedRewards) / 1e18)} MON`} />
          {d.windows.map((w) => (
            <Stat
              key={w.label}
              label={`Blocks ${w.label}`}
              value={w.ratio === null && w.blocks === 0 ? "–" : fmtNum(w.blocks)}
              sub={w.expected > 0 ? <span className="inline-flex items-center gap-2">expected {fmtNum(w.expected)} <PerfBar ratio={w.ratio} /></span> : "no history yet"}
            />
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className="card p-4 lg:col-span-2">
            <h2 className="text-sm font-medium text-muted">Blocks proposed per hour, last 7 days (dashed: expected from stake share)</h2>
            {d.hourly.length > 1 ? (
              <>
                <div className="mt-3">
                  <Sparkline points={d.hourly.map((h) => h.mine)} expected={d.hourly.map((h) => h.expected)} height={120} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted">
                  <span>{fmtDate(d.hourly[0].t)}</span>
                  <span>{fmtDate(d.hourly[d.hourly.length - 1].t)}</span>
                </div>
              </>
            ) : (
              <Empty>No history yet.</Empty>
            )}
          </section>
          <section className="card p-4 text-sm">
            <h2 className="text-sm font-medium text-muted">On-chain record</h2>
            <dl className="mt-3 space-y-2">
              <Row k="Validator id" v={row.id} />
              <Row k="Auth address" v={<span className="font-mono text-xs" title={row.authAddress}>{shortAddr(row.authAddress, 8)}</span>} />
              <Row k="Flags" v={onchain.flags} />
              <Row k="In consensus set" v={row.inConsensus ? "yes" : "no"} />
              <Row k="In snapshot set (next epoch)" v={row.inSnapshot ? "yes" : "no"} />
              <Row k="In execution set" v={row.inExecution ? "yes" : "no"} />
              <Row k="Consensus commission" v={fmtPct(Number(onchain.consensusCommission) / 1e16, 1)} />
              <Row k="Snapshot commission" v={fmtPct(Number(onchain.snapshotCommission) / 1e16, 1)} />
              <Row k="secp pubkey" v={<span className="font-mono text-xs" title={onchain.secpPubkey}>{shortHex(onchain.secpPubkey, 10)}</span>} />
              <Row k="BLS pubkey" v={<span className="font-mono text-xs" title={onchain.blsPubkey}>{shortHex(onchain.blsPubkey, 10)}</span>} />
              {registry?.registration_date ? <Row k="Registered (registry)" v={registry.registration_date} /> : null}
            </dl>
          </section>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="card">
            <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Epoch history</h2>
            {d.epochHistory.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Epoch</th><th>Started</th><th className="text-right">Stake</th><th className="text-right">Share</th><th className="text-right">Blocks</th><th className="text-right">Expected</th><th>Ratio</th></tr>
                  </thead>
                  <tbody>
                    {d.epochHistory.map((e) => {
                      const expected = (e.blocks * e.share) / 100;
                      return (
                        <tr key={e.epoch}>
                          <td className="num">{e.epoch}</td>
                          <td className="text-muted">{fmtDate(e.startedAt)}</td>
                          <td className="num text-right">{fmtCompact(e.stake)}</td>
                          <td className="num text-right">{fmtPct(e.share)}</td>
                          <td className="num text-right">{fmtNum(e.mine)}</td>
                          <td className="num text-right text-muted">{fmtNum(expected)}</td>
                          <td>{expected > 0 ? <PerfBar ratio={e.mine / expected} /> : "–"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No epoch history yet.</Empty>
            )}
            <p className="px-4 py-2 text-xs text-muted">Only blocks observed by the collector are counted; the current and first recorded epochs are partial.</p>
          </section>
          <section className="card">
            <h2 className="border-b border-line px-4 py-3 text-sm font-medium">
              Delegators <span className="text-muted">({d.delegatorsComplete ? d.delegatorCount : `first ${d.delegatorCount}`})</span>
            </h2>
            {d.delegators.length ? (
              <div className="table-wrap max-h-[480px] overflow-y-auto">
                <table className="data">
                  <thead>
                    <tr><th>Address</th><th className="text-right">Stake (MON)</th><th className="text-right">Share of validator</th><th className="text-right">Unclaimed</th></tr>
                  </thead>
                  <tbody>
                    {d.delegators.slice(0, 200).map((x) => (
                      <tr key={x.address}>
                        <td className="font-mono text-xs">
                          <Link href={`/${network}/delegator/${x.address.toLowerCase()}`} className="hover:text-accent-2" title={x.address}>{shortAddr(x.address, 8)}</Link>
                          {x.address.toLowerCase() === row.authAddress.toLowerCase() ? <span className="ml-2 text-[10px] text-accent-2">self</span> : null}
                        </td>
                        <td className="num text-right">{fmtNum(x.stake, 2)}</td>
                        <td className="num text-right text-muted">{row.stake > 0 ? fmtPct((x.stake / row.stake) * 100) : "–"}</td>
                        <td className="num text-right text-muted">{fmtNum(x.unclaimedRewards, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No delegators found.</Empty>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="num text-right">{v}</dd>
    </div>
  );
}
