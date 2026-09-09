import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Address } from "viem";
import { Header } from "@/components/Header";
import { Empty, Stat, StatusBadge, ValidatorName } from "@/components/ui";
import { isNetworkId, NETWORKS } from "@/lib/chains";
import { fmtNum, fmtPct, isAddress, shortAddr, timeAgo } from "@/lib/format";
import { getDelegatorView } from "@/lib/model";

export const revalidate = 30;

type Props = { params: Promise<{ network: string; address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  return { title: `Delegator ${shortAddr(address)}` };
}

export default async function DelegatorPage({ params }: Props) {
  const { network, address } = await params;
  if (!isNetworkId(network) || !isAddress(address)) notFound();
  const v = await getDelegatorView(network, address.toLowerCase() as Address);
  const net = NETWORKS[network];

  return (
    <>
      <Header network={network} active="delegator" />
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="mb-1 text-sm text-muted"><Link href={`/${network}/delegator`} className="hover:text-fg">Delegator lookup</Link></div>
        <h1 className="font-mono text-xl font-semibold break-all">{v.address}</h1>
        <p className="mt-1 text-sm text-muted">
          <a className="text-accent-2 hover:underline" href={net.explorer.address(v.address)} target="_blank" rel="noopener">View on {net.explorer.name}</a> · epoch {v.epoch} · refreshed {timeAgo(v.generatedAt)}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Delegated stake" value={`${fmtNum(v.totals.stake, 2)} MON`} sub={`${v.positions.length} validator${v.positions.length === 1 ? "" : "s"}`} />
          <Stat label="Unclaimed rewards" value={`${fmtNum(v.totals.unclaimedRewards, 4)} MON`} sub="claim or compound per validator" />
          <Stat label="Pending activation" value={`${fmtNum(v.totals.pendingStake, 2)} MON`} sub="becomes active at the next epoch boundary" />
          <Stat label="Withdrawing" value={`${fmtNum(v.totals.withdrawing, 2)} MON`} sub={`${v.withdrawals.length} request${v.withdrawals.length === 1 ? "" : "s"}`} />
        </div>

        <section className="card mt-6">
          <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Delegations</h2>
          {v.positions.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Validator</th><th>Status</th><th className="text-right">Commission</th><th className="text-right">Active stake</th><th className="text-right">Pending</th><th className="text-right">Unclaimed rewards</th></tr></thead>
                <tbody>
                  {v.positions.map((p) => (
                    <tr key={p.valId}>
                      <td><ValidatorName network={network} id={p.valId} name={p.name} logo={p.logo} /></td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="num text-right">{fmtPct(p.commission, 1)}</td>
                      <td className="num text-right">{fmtNum(p.stake, 4)}</td>
                      <td className="num text-right text-muted">
                        {p.pendingEpoch !== null ? `${fmtNum(p.pendingStake, 4)} (epoch ${p.pendingEpoch})` : ""}
                        {p.nextPendingEpoch !== null ? `${p.pendingEpoch !== null ? " + " : ""}${fmtNum(p.nextPendingStake, 4)} (epoch ${p.nextPendingEpoch})` : ""}
                        {p.pendingEpoch === null && p.nextPendingEpoch === null ? "–" : ""}
                      </td>
                      <td className="num text-right">{fmtNum(p.unclaimedRewards, 6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>This address has no delegations on {net.name}.</Empty>
          )}
        </section>

        <section className="card mt-6">
          <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Withdrawal requests</h2>
          {v.withdrawals.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Validator</th><th>Request id</th><th className="text-right">Amount (MON)</th><th className="text-right">Withdrawable from epoch</th><th>State</th></tr></thead>
                <tbody>
                  {v.withdrawals.map((w) => (
                    <tr key={`${w.valId}-${w.withdrawId}`}>
                      <td><ValidatorName network={network} id={w.valId} name={w.name} /></td>
                      <td className="num">{w.withdrawId}</td>
                      <td className="num text-right">{fmtNum(w.amount, 4)}</td>
                      <td className="num text-right">{w.withdrawEpoch}</td>
                      <td>{w.claimable ? <span className="text-ok">ready to withdraw</span> : <span className="text-warn">waiting ({w.withdrawEpoch - v.epoch} epoch{w.withdrawEpoch - v.epoch === 1 ? "" : "s"})</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No pending withdrawal requests.</Empty>
          )}
        </section>
      </main>
    </>
  );
}
