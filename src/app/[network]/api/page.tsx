import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { isNetworkId } from "@/lib/chains";

export const metadata: Metadata = { title: "JSON API" };

export default async function ApiDocs({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (!isNetworkId(network)) notFound();
  const endpoints = [
    { path: `/api/${network}/validators`, desc: "Overview: epoch, head, totals and every validator with status, stake, commission and 24h block production.", cache: "60 s" },
    { path: `/api/${network}/validator/1`, desc: "One validator: on-chain record, registry metadata, hourly and per-epoch block production, delegators.", cache: "60 s" },
    { path: `/api/${network}/epoch`, desc: "Epoch progress, validators joining and leaving next epoch, candidates outside the active set, recent epochs.", cache: "60 s" },
    { path: `/api/${network}/delegator/0x0000000000000000000000000000000000000000`, desc: "Delegations, pending stake, unclaimed rewards and withdrawal requests for an address.", cache: "30 s" },
    { path: `/api/${network}/blocks`, desc: "Proposer of each of the last 60 blocks.", cache: "20 s" },
  ];
  return (
    <>
      <Header network={network} active="api" />
      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <h1 className="text-2xl font-semibold">JSON API</h1>
        <p className="mt-2 text-sm text-muted">
          Every page on this site is backed by a JSON endpoint. Responses are cached on the server for the listed time and served with CORS headers, so they can be
          used directly from browsers, bots and dashboards. Amounts are in MON unless a field name ends in <code>Wei</code>; raw on-chain values inside{" "}
          <code>onchain</code> are wei as decimal strings.
        </p>
        <div className="card mt-6 divide-y divide-line">
          {endpoints.map((e) => (
            <div key={e.path} className="px-4 py-3">
              <a className="font-mono text-sm text-accent-2 hover:underline" href={e.path}>{e.path}</a>
              <div className="mt-1 text-sm text-muted">{e.desc} <span className="text-xs">· cache {e.cache}</span></div>
            </div>
          ))}
        </div>
        <h2 className="mt-8 text-lg font-semibold">History data</h2>
        <p className="mt-2 text-sm text-muted">
          Block-production history is collected every 10 minutes by a GitHub Actions job and published as a single JSON file per network on the{" "}
          <a className="text-accent-2 hover:underline" href="https://github.com/Gabbe-x/monad-validators/tree/data">data branch</a> of the repository:
          hourly proposer counts for 7 days, per-epoch totals and stake snapshots for 30 epochs, and the validator registry.
        </p>
        <pre className="card mt-3 overflow-x-auto p-4 text-xs">{`https://raw.githubusercontent.com/Gabbe-x/monad-validators/data/${network}.json`}</pre>
      </main>
    </>
  );
}
